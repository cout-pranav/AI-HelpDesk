using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace TicketManagement.Api.Auth;

// Throttles password guessing on POST /api/auth/login at two levels:
// - per client IP, via the rate limiter middleware (policy applied with RequireRateLimiting);
// - per target email (failed attempts only), via LoginAttemptLimiter inside the handler, since
//   the middleware runs before the request body is bound and can't see the email.
// Both only limit when enabled (Production); elsewhere the policy is a no-op and the
// per-email limiter never blocks, so local dev and E2E runs can log in freely.
public static class LoginRateLimiting
{
    public const string PolicyName = "login";

    private const int PermitsPerIp = 10;
    private static readonly TimeSpan IpWindow = TimeSpan.FromMinutes(1);

    public static IServiceCollection AddLoginRateLimiting(this IServiceCollection services, bool enabled)
    {
        services.AddSingleton(_ => new LoginAttemptLimiter(enabled));

        return services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            // RemoteIpAddress is the direct peer; behind a reverse proxy, configure
            // UseForwardedHeaders first or every client will share one partition.
            // The policy is always registered because the login endpoint requires it by name.
            options.AddPolicy(PolicyName, context => !enabled
                ? RateLimitPartition.GetNoLimiter("disabled")
                : RateLimitPartition.GetFixedWindowLimiter(
                    context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = PermitsPerIp,
                        Window = IpWindow,
                        QueueLimit = 0,
                    }));

            options.OnRejected = async (context, cancellationToken) =>
            {
                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                    context.HttpContext.Response.Headers.RetryAfter = ((int)retryAfter.TotalSeconds).ToString();

                await TooManyAttempts().ExecuteAsync(context.HttpContext);
            };
        });
    }

    public static IResult TooManyAttempts() => Results.Problem(
        "Too many login attempts. Please wait a few minutes and try again.",
        statusCode: StatusCodes.Status429TooManyRequests);
}

// Caps failed login attempts per normalized email. Only failures count, so a correct password
// is never what uses up the budget. Two limits apply:
// - per (email, IP): strict, stops a single source guessing one account's password;
// - per email: loose, still throttles a distributed attack on one account while making it
//   impractical to lock a user out from a single IP.
public sealed class LoginAttemptLimiter(bool enabled) : IDisposable
{
    private const int FailuresPerEmailAndIp = 5;
    private const int FailuresPerEmail = 50;
    private static readonly TimeSpan Window = TimeSpan.FromMinutes(15);

    private readonly PartitionedRateLimiter<string> _perEmailAndIp = CreateLimiter(FailuresPerEmailAndIp);
    private readonly PartitionedRateLimiter<string> _perEmail = CreateLimiter(FailuresPerEmail);

    private static PartitionedRateLimiter<string> CreateLimiter(int permitLimit) =>
        PartitionedRateLimiter.Create<string, string>(key =>
            RateLimitPartition.GetSlidingWindowLimiter(key, _ => new SlidingWindowRateLimiterOptions
            {
                PermitLimit = permitLimit,
                Window = Window,
                SegmentsPerWindow = 3,
                QueueLimit = 0,
            }));

    // A zero-permit acquire only reports whether permits remain; it consumes nothing.
    public bool IsBlocked(string normalizedEmail, string ip)
    {
        if (!enabled)
            return false;

        using var perEmailAndIp = _perEmailAndIp.AttemptAcquire(PairKey(normalizedEmail, ip), 0);
        using var perEmail = _perEmail.AttemptAcquire(normalizedEmail, 0);
        return !perEmailAndIp.IsAcquired || !perEmail.IsAcquired;
    }

    public void RecordFailure(string normalizedEmail, string ip)
    {
        if (!enabled)
            return;

        _perEmailAndIp.AttemptAcquire(PairKey(normalizedEmail, ip)).Dispose();
        _perEmail.AttemptAcquire(normalizedEmail).Dispose();
    }

    private static string PairKey(string normalizedEmail, string ip) => $"{normalizedEmail}|{ip}";

    public void Dispose()
    {
        _perEmailAndIp.Dispose();
        _perEmail.Dispose();
    }
}
