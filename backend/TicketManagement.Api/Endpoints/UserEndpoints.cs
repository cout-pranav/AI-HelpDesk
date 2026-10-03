using Microsoft.EntityFrameworkCore;
using TicketManagement.Api.Data;
using TicketManagement.Api.Models;

namespace TicketManagement.Api.Endpoints;

public record UserListItemDto(int Id, string Email, string DisplayName, string Role, bool IsActive, DateTime CreatedAt);

public static class UserEndpoints
{
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

        return app;
    }
}
