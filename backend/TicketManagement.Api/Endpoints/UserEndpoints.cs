using System.Net.Mail;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TicketManagement.Api.Data;
using TicketManagement.Api.Models;

namespace TicketManagement.Api.Endpoints;

public record UserListItemDto(int Id, string Email, string DisplayName, string Role, bool IsActive, DateTime CreatedAt)
{
    public static UserListItemDto From(User user) =>
        new(user.Id, user.Email, user.DisplayName, user.Role, user.IsActive, user.CreatedAt);
}

public record CreateUserRequest(string? DisplayName, string? Email, string? Password);

public static class UserEndpoints
{
    private const int MinDisplayNameLength = 3;
    private const int MaxDisplayNameLength = 100; // Users.DisplayName column length
    private const int MaxEmailLength = 256; // Users.Email column length
    private const int MinPasswordLength = 8;
    private const int MaxPasswordLength = 128;
    private const long MaxCreateUserBodyBytes = 4096;

    public static IEndpointRouteBuilder MapUserEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/users")
            .RequireAuthorization(p => p.RequireRole(Roles.Admin));

        group.MapGet("/", async (TicketManagementDbContext db) =>
        {
            // Project in the query so Accounts (password hashes) are never loaded.
            var users = await db.Users
                .AsNoTracking()
                .OrderBy(u => u.DisplayName)
                .ThenBy(u => u.Email)
                .Select(u => new UserListItemDto(u.Id, u.Email, u.DisplayName, u.Role, u.IsActive, u.CreatedAt))
                .ToListAsync();

            return Results.Ok(users);
        });

        // Creates an agent with a password (credential) account. Admins are only created by the seeder.
        group.MapPost("/", async (
            CreateUserRequest request,
            TicketManagementDbContext db,
            IPasswordHasher<User> hasher) =>
        {
            var displayName = request.DisplayName?.Trim() ?? string.Empty;
            var email = request.Email?.Trim() ?? string.Empty;
            var password = request.Password ?? string.Empty;

            var errors = new Dictionary<string, string[]>();
            if (displayName.Length < MinDisplayNameLength || displayName.Length > MaxDisplayNameLength)
                errors["displayName"] = [$"Name must be between {MinDisplayNameLength} and {MaxDisplayNameLength} characters."];
            if (email.Length == 0 || email.Length > MaxEmailLength
                || !MailAddress.TryCreate(email, out var parsed) || parsed.Address != email)
                errors["email"] = ["Enter a valid email address."];
            if (password.Length < MinPasswordLength || password.Length > MaxPasswordLength)
                errors["password"] = [$"Password must be between {MinPasswordLength} and {MaxPasswordLength} characters."];
            if (errors.Count > 0)
                return Results.ValidationProblem(errors);

            var duplicate = Results.Problem("A user with this email already exists.", statusCode: StatusCodes.Status409Conflict);
            var normalizedEmail = User.NormalizeEmail(email);
            if (await db.Users.AnyAsync(u => u.Email == normalizedEmail))
                return duplicate;

            var user = new User
            {
                Email = normalizedEmail,
                DisplayName = displayName,
                Role = Roles.Agent,
                IsActive = true,
            };
            user.Accounts.Add(new Account
            {
                Provider = AuthProviders.Credential,
                PasswordHash = hasher.HashPassword(user, password),
            });
            db.Users.Add(user);

            try
            {
                await db.SaveChangesAsync();
            }
            catch (DbUpdateException)
            {
                // Lost a race with a concurrent create of the same email (unique index on Users.Email).
                if (await db.Users.AsNoTracking().AnyAsync(u => u.Email == normalizedEmail))
                    return duplicate;
                throw;
            }

            return Results.Created($"/api/users/{user.Id}", UserListItemDto.From(user));
        })
        .WithMetadata(new RequestSizeLimitAttribute(MaxCreateUserBodyBytes));

        return app;
    }
}
