using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.JsonWebTokens;
using TicketManagement.Api.Auth;
using TicketManagement.Api.Data;
using TicketManagement.Api.Models;

namespace TicketManagement.Api.Endpoints;

public record LoginRequest(string Email, string Password);

public record UserDto(int Id, string Email, string DisplayName, string Role)
{
    public static UserDto From(User user) => new(user.Id, user.Email, user.DisplayName, user.Role);
}

public record LoginResponse(string Token, DateTime ExpiresAt, UserDto User);

public static class AuthEndpoints
{
    private const int MaxPasswordLength = 128;
    private const int MaxEmailLength = 256; // Users.Email column length
    private const long MaxLoginBodyBytes = 4096;

    // Verified against when there's no usable account, so unknown emails cost the same
    // PBKDF2 work as wrong passwords and response timing doesn't reveal which emails exist.
    private static readonly string DummyHash =
        new PasswordHasher<User>().HashPassword(new User(), Guid.NewGuid().ToString());

    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth");

        group.MapPost("/login", async (
            LoginRequest request,
            HttpContext http,
            TicketManagementDbContext db,
            IPasswordHasher<User> hasher,
            TokenService tokens,
            LoginAttemptLimiter attemptLimiter) =>
        {
            // Same response for unknown email, wrong password, and inactive user.
            var invalid = Results.Problem("Invalid email or password.", statusCode: StatusCodes.Status401Unauthorized);

            // Match the client-side caps; also bound the PBKDF2 work and the size of limiter keys.
            if (string.IsNullOrWhiteSpace(request.Email) || request.Email.Length > MaxEmailLength
                || string.IsNullOrEmpty(request.Password) || request.Password.Length > MaxPasswordLength)
                return invalid;

            var email = User.NormalizeEmail(request.Email);
            var ip = http.Connection.RemoteIpAddress?.ToString() ?? "unknown";
            if (attemptLimiter.IsBlocked(email, ip))
                return LoginRateLimiting.TooManyAttempts();

            var account = await db.Accounts
                .Include(a => a.User)
                .SingleOrDefaultAsync(a => a.Provider == AuthProviders.Credential && a.User.Email == email);
            if (account?.PasswordHash is null || !account.User.IsActive)
            {
                hasher.VerifyHashedPassword(new User(), DummyHash, request.Password);
                attemptLimiter.RecordFailure(email, ip);
                return invalid;
            }

            var user = account.User;
            var result = hasher.VerifyHashedPassword(user, account.PasswordHash, request.Password);
            if (result == PasswordVerificationResult.Failed)
            {
                attemptLimiter.RecordFailure(email, ip);
                return invalid;
            }

            if (result == PasswordVerificationResult.SuccessRehashNeeded)
            {
                account.PasswordHash = hasher.HashPassword(user, request.Password);
                await db.SaveChangesAsync();
            }

            var (token, expiresAt) = tokens.CreateToken(user);
            return Results.Ok(new LoginResponse(token, expiresAt, UserDto.From(user)));
        })
        .RequireRateLimiting(LoginRateLimiting.PolicyName)
        .WithMetadata(new RequestSizeLimitAttribute(MaxLoginBodyBytes));

        group.MapGet("/me", async (HttpContext http, TicketManagementDbContext db) =>
        {
            var sub = http.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
            if (!int.TryParse(sub, out var userId))
                return Results.Unauthorized();

            var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(u => u.Id == userId);
            return user is null ? Results.Unauthorized() : Results.Ok(UserDto.From(user));
        }).RequireAuthorization();

        return app;
    }
}
