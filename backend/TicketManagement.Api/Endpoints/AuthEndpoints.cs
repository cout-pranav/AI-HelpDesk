using Microsoft.AspNetCore.Identity;
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
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth");

        group.MapPost("/login", async (
            LoginRequest request,
            TicketManagementDbContext db,
            IPasswordHasher<User> hasher,
            TokenService tokens) =>
        {
            // Same response for unknown email, wrong password, and inactive user.
            var invalid = Results.Problem("Invalid email or password.", statusCode: StatusCodes.Status401Unauthorized);

            if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrEmpty(request.Password))
                return invalid;

            var email = User.NormalizeEmail(request.Email);
            var account = await db.Accounts
                .Include(a => a.User)
                .SingleOrDefaultAsync(a => a.Provider == AuthProviders.Credential && a.User.Email == email);
            if (account?.PasswordHash is null || !account.User.IsActive)
                return invalid;

            var user = account.User;
            var result = hasher.VerifyHashedPassword(user, account.PasswordHash, request.Password);
            if (result == PasswordVerificationResult.Failed)
                return invalid;

            if (result == PasswordVerificationResult.SuccessRehashNeeded)
            {
                account.PasswordHash = hasher.HashPassword(user, request.Password);
                await db.SaveChangesAsync();
            }

            var (token, expiresAt) = tokens.CreateToken(user);
            return Results.Ok(new LoginResponse(token, expiresAt, UserDto.From(user)));
        });

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
