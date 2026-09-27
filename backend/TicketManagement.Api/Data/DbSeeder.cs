using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TicketManagement.Api.Models;

namespace TicketManagement.Api.Data;

public static class DbSeeder
{
    // Runs on startup: applies migrations and creates the admin user from the SeedAdmin:Email /
    // SeedAdmin:Password configuration keys (dotnet user-secrets in Development, or SeedAdmin__Email /
    // SeedAdmin__Password environment variables elsewhere). Idempotent.
    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var config = scope.ServiceProvider.GetRequiredService<IConfiguration>();
        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger(nameof(DbSeeder));
        var db = scope.ServiceProvider.GetRequiredService<TicketManagementDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<User>>();

        await db.Database.MigrateAsync();

        var email = config["SeedAdmin:Email"];
        var password = config["SeedAdmin:Password"];
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            logger.LogWarning("SeedAdmin:Email and SeedAdmin:Password are not set (dotnet user-secrets or SeedAdmin__* environment variables); skipping admin seeding.");
            return;
        }

        var normalizedEmail = User.NormalizeEmail(email);
        if (await db.Users.AnyAsync(u => u.Email == normalizedEmail))
        {
            logger.LogInformation("User {Email} already seeded; nothing to do.", normalizedEmail);
            return;
        }

        var admin = new User
        {
            Email = normalizedEmail,
            DisplayName = config["SeedAdmin:DisplayName"] ?? "Administrator",
            Role = Roles.Admin,
            IsActive = true,
        };
        admin.Accounts.Add(new Account
        {
            Provider = AuthProviders.Credential,
            PasswordHash = hasher.HashPassword(admin, password),
        });

        db.Users.Add(admin);
        await db.SaveChangesAsync();

        logger.LogInformation("Seeded admin user {Email}.", normalizedEmail);
    }
}
