using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using TicketManagement.Api.Data;
using TicketManagement.Api.Models;

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

        // Sorted by sortBy/sortDir (default newest first); Id breaks ties so paging is stable.
        group.MapGet("/", async (
            int? page, int? pageSize, string? sortBy, string? sortDir, TicketManagementDbContext db) =>
        {
            var pageNumber = page ?? 1;
            var size = pageSize ?? DefaultPageSize;
            var sortKey = sortBy ?? DefaultSortBy;
            var direction = sortDir ?? "desc";
            var errors = new Dictionary<string, string[]>();
            if (pageNumber < 1)
                errors["page"] = ["Page must be 1 or greater."];
            if (size < 1 || size > MaxPageSize)
                errors["pageSize"] = [$"Page size must be between 1 and {MaxPageSize}."];
            if (!SortColumns.Contains(sortKey))
                errors["sortBy"] = [$"Sort column must be one of: {string.Join(", ", SortColumns)}."];
            var descending = direction.Equals("desc", StringComparison.OrdinalIgnoreCase);
            if (!descending && !direction.Equals("asc", StringComparison.OrdinalIgnoreCase))
                errors["sortDir"] = ["Sort direction must be asc or desc."];
            if (errors.Count > 0)
                return Results.ValidationProblem(errors);

            var totalCount = await db.Tickets.CountAsync();
            var tickets = await ApplySort(db.Tickets.AsNoTracking(), sortKey, descending)
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

    // Values match the frontend's column ids.
    private const string DefaultSortBy = "createdAt";
    private static readonly HashSet<string> SortColumns = new(StringComparer.OrdinalIgnoreCase)
    {
        "id", "subject", "submitter", "status", "category", "createdAt",
    };

    private static IQueryable<Ticket> ApplySort(IQueryable<Ticket> query, string sortBy, bool descending)
    {
        if (sortBy.Equals("id", StringComparison.OrdinalIgnoreCase))
            return descending ? query.OrderByDescending(t => t.Id) : query.OrderBy(t => t.Id);

        IOrderedQueryable<Ticket> ordered = sortBy.ToLowerInvariant() switch
        {
            "subject" => OrderBy(query, t => t.Subject, descending),
            // The list shows the name, falling back to the email, so sort the same way.
            "submitter" => OrderBy(query, t => t.SubmitterName ?? t.SubmitterEmail, descending),
            "status" => OrderBy(query, t => t.Status, descending),
            "category" => OrderBy(query, t => t.Category, descending),
            _ => OrderBy(query, t => t.CreatedAt, descending),
        };
        return descending ? ordered.ThenByDescending(t => t.Id) : ordered.ThenBy(t => t.Id);
    }

    private static IOrderedQueryable<Ticket> OrderBy<TKey>(
        IQueryable<Ticket> query, Expression<Func<Ticket, TKey>> key, bool descending) =>
        descending ? query.OrderByDescending(key) : query.OrderBy(key);
}
