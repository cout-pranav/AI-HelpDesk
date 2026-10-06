using Microsoft.EntityFrameworkCore;
using TicketManagement.Api.Data;

namespace TicketManagement.Api.Endpoints;

public record TicketListItemDto(
    int Id,
    string Subject,
    string Status,
    string? Category,
    string Source,
    string SubmitterEmail,
    string? SubmitterName,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public record TicketListResponse(List<TicketListItemDto> Items, int Page, int PageSize, int TotalCount);

public static class TicketEndpoints
{
    private const int DefaultPageSize = 25;
    private const int MaxPageSize = 100;

    public static IEndpointRouteBuilder MapTicketEndpoints(this IEndpointRouteBuilder app)
    {
        // Agents and admins both work tickets, so any signed-in user may read them.
        var group = app.MapGroup("/api/tickets").RequireAuthorization();

        // Newest first; Id breaks ties so paging is stable when tickets share a timestamp.
        group.MapGet("/", async (int? page, int? pageSize, TicketManagementDbContext db) =>
        {
            var pageNumber = page ?? 1;
            var size = pageSize ?? DefaultPageSize;
            var errors = new Dictionary<string, string[]>();
            if (pageNumber < 1)
                errors["page"] = ["Page must be 1 or greater."];
            if (size < 1 || size > MaxPageSize)
                errors["pageSize"] = [$"Page size must be between 1 and {MaxPageSize}."];
            if (errors.Count > 0)
                return Results.ValidationProblem(errors);

            var totalCount = await db.Tickets.CountAsync();
            var tickets = await db.Tickets
                .AsNoTracking()
                .OrderByDescending(t => t.CreatedAt)
                .ThenByDescending(t => t.Id)
                .Skip((pageNumber - 1) * size)
                .Take(size)
                .Select(t => new TicketListItemDto(
                    t.Id,
                    t.Subject,
                    t.Status,
                    t.Category,
                    t.Source,
                    t.SubmitterEmail,
                    t.SubmitterName,
                    // Stored as UTC; mark it so JSON carries a "Z" and browsers don't read it as local time.
                    DateTime.SpecifyKind(t.CreatedAt, DateTimeKind.Utc),
                    DateTime.SpecifyKind(t.UpdatedAt, DateTimeKind.Utc)))
                .ToListAsync();

            return Results.Ok(new TicketListResponse(tickets, pageNumber, size, totalCount));
        });

        return app;
    }
}
