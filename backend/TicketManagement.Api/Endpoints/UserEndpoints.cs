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

// A null or empty Password leaves the user's current password unchanged.
public record UpdateUserRequest(string? DisplayName, string? Email, string? Password);

public static class UserEndpoints
{
    private const int MinDisplayNameLength = 3;
    private const int MaxDisplayNameLength = 100; // Users.DisplayName column length
    private const int MaxEmailLength = 256; // Users.Email column length
    private const int MinPasswordLength = 8;
    private const int MaxPasswordLength = 128;
    private const long MaxUserBodyBytes = 4096;

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

            var errors = ValidateProfile(displayName, email);
            if (!IsValidPassword(password))
                errors["password"] = [PasswordLengthMessage];
            if (errors.Count > 0)
                return Results.ValidationProblem(errors);

            var duplicate = DuplicateEmail();
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
        .WithMetadata(new RequestSizeLimitAttribute(MaxUserBodyBytes));

        // Updates name and email, and the password only when one is given. Role and status are left as they are.
        group.MapPut("/{id:int}", async (
            int id,
            UpdateUserRequest request,
            TicketManagementDbContext db,
            IPasswordHasher<User> hasher) =>
        {
            var displayName = request.DisplayName?.Trim() ?? string.Empty;
            var email = request.Email?.Trim() ?? string.Empty;
            var password = request.Password;

            var errors = ValidateProfile(displayName, email);
            if (!string.IsNullOrEmpty(password) && !IsValidPassword(password))
                errors["password"] = [PasswordLengthMessage];
            if (errors.Count > 0)
                return Results.ValidationProblem(errors);

            var user = await db.Users.Include(u => u.Accounts).FirstOrDefaultAsync(u => u.Id == id);
            if (user is null)
                return Results.Problem("User not found.", statusCode: StatusCodes.Status404NotFound);

            var duplicate = DuplicateEmail();
            var normalizedEmail = User.NormalizeEmail(email);
            if (await db.Users.AnyAsync(u => u.Email == normalizedEmail && u.Id != id))
                return duplicate;

            user.DisplayName = displayName;
            user.Email = normalizedEmail;

            if (!string.IsNullOrEmpty(password))
            {
                var credential = user.Accounts.FirstOrDefault(a => a.Provider == AuthProviders.Credential);
                if (credential is null)
                {
                    credential = new Account { Provider = AuthProviders.Credential };
                    user.Accounts.Add(credential);
                }
                credential.PasswordHash = hasher.HashPassword(user, password);
            }

            try
            {
                await db.SaveChangesAsync();
            }
            catch (DbUpdateException)
            {
                // Lost a race with a concurrent change to the same email (unique index on Users.Email).
                if (await db.Users.AsNoTracking().AnyAsync(u => u.Email == normalizedEmail && u.Id != id))
                    return duplicate;
                throw;
            }

            return Results.Ok(UserListItemDto.From(user));
        })
        .WithMetadata(new RequestSizeLimitAttribute(MaxUserBodyBytes));

        return app;
    }

    private static readonly string PasswordLengthMessage =
        $"Password must be between {MinPasswordLength} and {MaxPasswordLength} characters.";

    // Name and email rules shared by create and update.
    private static Dictionary<string, string[]> ValidateProfile(string displayName, string email)
    {
        var errors = new Dictionary<string, string[]>();
        if (displayName.Length < MinDisplayNameLength || displayName.Length > MaxDisplayNameLength)
            errors["displayName"] = [$"Name must be between {MinDisplayNameLength} and {MaxDisplayNameLength} characters."];
        if (email.Length == 0 || email.Length > MaxEmailLength
            || !MailAddress.TryCreate(email, out var parsed) || parsed.Address != email)
            errors["email"] = ["Enter a valid email address."];
        return errors;
    }

    private static bool IsValidPassword(string password) =>
        password.Length >= MinPasswordLength && password.Length <= MaxPasswordLength;

    private static IResult DuplicateEmail() =>
        Results.Problem("A user with this email already exists.", statusCode: StatusCodes.Status409Conflict);
}
