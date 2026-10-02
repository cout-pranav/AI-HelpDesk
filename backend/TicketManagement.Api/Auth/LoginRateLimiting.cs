using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace TicketManagement.Api.Auth;

// Throttles password guessing on POST /api/auth/login at two levels:
// - per client IP, via the rate limiter middleware (policy applied with RequireRateLimiting);
// - per target email, via LoginAttemptLimiter inside the handler, since the middleware runs
//   before the request body is bound and can't see the email.
public static class LoginRateLimiting
{
    public const string PolicyName = "login";

    private const int PermitsPerIp = 10;
    private static readonly TimeSpan IpWindow = TimeSpan.FromMinutes(1);

    public static IServiceCollection AddLoginRateLimiting(this IServiceCollection services)
    {
        services.AddSingleton<LoginAttemptLimiter>();

        return services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            // RemoteIpAddress is the direct peer; behind a reverse proxy, configure
            // UseForwardedHeaders first or every client will share one partition.
            options.AddPolicy(PolicyName, context =>
                RateLimitPartition.GetFixedWindowLimiter(
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

// Caps login attempts per normalized email, regardless of source IP, so a distributed
// guessing attack against one account is still throttled.
public sealed class LoginAttemptLimiter : IDisposable
{
    private const int PermitsPerEmail = 10;
    private static readonly TimeSpan EmailWindow = TimeSpan.FromMinutes(15);

    private readonly PartitionedRateLimiter<string> _limiter = PartitionedRateLimiter.Create<string, string>(email =>
        RateLimitPartition.GetSlidingWindowLimiter(email, _ => new SlidingWindowRateLimiterOptions
        {
            PermitLimit = PermitsPerEmail,
            Window = EmailWindow,
            SegmentsPerWindow = 3,
            QueueLimit = 0,
        }));

    public bool TryAcquire(string normalizedEmail)
    {
        using var lease = _limiter.AttemptAcquire(normalizedEmail);
        return lease.IsAcquired;
    }

    public void Dispose() => _limiter.Dispose();
}
