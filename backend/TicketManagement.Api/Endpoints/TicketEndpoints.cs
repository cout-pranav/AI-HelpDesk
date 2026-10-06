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
    TicketAssigneeDto? Assignee,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public record TicketListResponse(List<TicketListItemDto> Items, int Page, int PageSize, int TotalCount);

public record TicketMessageDto(
    int Id,
    string SenderEmail,
    string? SenderName,
    string Body,
    List<string> AttachmentNames,
    DateTime CreatedAt);

public record TicketAssigneeDto(int Id, string DisplayName, string Email);

// A null UserId unassigns the ticket.
public record AssignTicketRequest(int? UserId);

public record TicketDetailDto(
    int Id,
    string Subject,
    string Status,
    string? Category,
    string Source,
    string SubmitterEmail,
    string? SubmitterName,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    TicketAssigneeDto? Assignee,
    List<TicketMessageDto> Messages);

public static class TicketEndpoints
{
    private const int DefaultPageSize = 25;
    private const int MaxPageSize = 100;

    public static IEndpointRouteBuilder MapTicketEndpoints(this IEndpointRouteBuilder app)
    {
        // Agents and admins both work tickets, so any signed-in user may read them.
        var group = app.MapGroup("/api/tickets").RequireAuthorization();

        // Optionally filtered by status/category/assignee and a search term, sorted by sortBy/sortDir
        // (default newest first); Id breaks ties so paging is stable.
        group.MapGet("/", async (
            int? page, int? pageSize, string? sortBy, string? sortDir, string? status, string? category,
            string? assignee, string? search, TicketManagementDbContext db) =>
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
            // Matched case-insensitively, then compared in SQL using the stored spelling.
            var statusFilter = status is null ? null : TicketStatuses.All.FirstOrDefault(
                s => s.Equals(status, StringComparison.OrdinalIgnoreCase));
            if (status is not null && statusFilter is null)
                errors["status"] = [$"Status must be one of: {string.Join(", ", TicketStatuses.All)}."];
            var uncategorized = category?.Equals(Uncategorized, StringComparison.OrdinalIgnoreCase) == true;
            var categoryFilter = category is null || uncategorized ? null : TicketCategories.All.FirstOrDefault(
                c => c.Equals(category, StringComparison.OrdinalIgnoreCase));
            if (category is not null && !uncategorized && categoryFilter is null)
                errors["category"] =
                    [$"Category must be one of: {string.Join(", ", TicketCategories.All)}, {Uncategorized}."];
            // "unassigned" or a user id.
            var unassigned = assignee?.Equals(Unassigned, StringComparison.OrdinalIgnoreCase) == true;
            int? assigneeFilter = int.TryParse(assignee, out var assigneeId) ? assigneeId : null;
            if (assignee is not null && !unassigned && assigneeFilter is null)
                errors["assignee"] = [$"Assignee must be a user id or {Unassigned}."];
                        var term = string.IsNullOrWhiteSpace(search) ? null : search.Trim();
            if (term?.Length > MaxSearchLength)
                errors["search"] = [$"Search must be at most {MaxSearchLength} characters."];
            if (errors.Count > 0)
                return Results.ValidationProblem(errors);

            var query = db.Tickets.AsNoTracking();
            if (statusFilter is not null)
                query = query.Where(t => t.Status == statusFilter);
            if (uncategorized)
                query = query.Where(t => t.Category == null);
            else if (categoryFilter is not null)
                query = query.Where(t => t.Category == categoryFilter);
            if (unassigned)
                query = query.Where(t => t.AssigneeId == null);
            else if (assigneeFilter is not null)
                query = query.Where(t => t.AssigneeId == assigneeFilter);
            if (term is not null)
            {
                // Substring match on what the list shows; the DB collation makes it case-insensitive.
                // "42" or "#42" also finds ticket 42.
                var ticketId = int.TryParse(term.TrimStart('#'), out var id) ? id : (int?)null;
                query = query.Where(t =>
                    t.Subject.Contains(term) ||
                    (t.SubmitterName != null && t.SubmitterName.Contains(term)) ||
                    t.SubmitterEmail.Contains(term) ||
                    t.Id == ticketId);
            }

            var totalCount = await query.CountAsync();
            var tickets = await ApplySort(query, sortKey, descending)
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
                    t.Assignee == null
                        ? null
                        : new TicketAssigneeDto(t.Assignee.Id, t.Assignee.DisplayName, t.Assignee.Email),
                    // Stored as UTC; mark it so JSON carries a "Z" and browsers don't read it as local time.
                    DateTime.SpecifyKind(t.CreatedAt, DateTimeKind.Utc),
                    DateTime.SpecifyKind(t.UpdatedAt, DateTimeKind.Utc)))
                .ToListAsync();

            return Results.Ok(new TicketListResponse(tickets, pageNumber, size, totalCount));
        });

        // One ticket with its assignee and message thread, oldest message first.
        group.MapGet("/{id:int}", async (int id, TicketManagementDbContext db) =>
        {
            var ticket = await LoadDetail(db, id);
            return ticket is null ? TicketNotFound() : Results.Ok(ticket);
        });

        // Assigns the ticket to an active user (agent or admin), or unassigns it. Returns the updated ticket.
        group.MapPut("/{id:int}/assignee", async (int id, AssignTicketRequest request, TicketManagementDbContext db) =>
        {
            var ticket = await db.Tickets.FirstOrDefaultAsync(t => t.Id == id);
            if (ticket is null)
                return TicketNotFound();

            if (request.UserId is int userId)
            {
                // Soft-deleted users are hidden by the query filter, so they fail this check too.
                var assignable = await db.Users.AnyAsync(u => u.Id == userId && u.IsActive);
                if (!assignable)
                    return Results.ValidationProblem(new Dictionary<string, string[]>
                    {
                        ["userId"] = ["Assignee must be an active user."],
                    });
            }

            if (ticket.AssigneeId != request.UserId)
            {
                ticket.AssigneeId = request.UserId;
                ticket.UpdatedAt = DateTime.UtcNow;
                await db.SaveChangesAsync();
            }

            return Results.Ok(await LoadDetail(db, id));
        })
        .RequireAuthorization(p => p.RequireRole(Roles.Admin));

        return app;
    }

    private static IResult TicketNotFound() =>
        Results.Problem("Ticket not found.", statusCode: StatusCodes.Status404NotFound);

    private static async Task<TicketDetailDto?> LoadDetail(TicketManagementDbContext db, int id)
    {
        var ticket = await db.Tickets
            .AsNoTracking()
            .Include(t => t.Assignee)
            .Include(t => t.Messages.OrderBy(m => m.CreatedAt).ThenBy(m => m.Id))
            .FirstOrDefaultAsync(t => t.Id == id);
        if (ticket is null)
            return null;

        return new TicketDetailDto(
            ticket.Id,
            ticket.Subject,
            ticket.Status,
            ticket.Category,
            ticket.Source,
            ticket.SubmitterEmail,
            ticket.SubmitterName,
            // Stored as UTC but read back as Unspecified; see the list projection.
            DateTime.SpecifyKind(ticket.CreatedAt, DateTimeKind.Utc),
            DateTime.SpecifyKind(ticket.UpdatedAt, DateTimeKind.Utc),
            ticket.Assignee is { } assignee
                ? new TicketAssigneeDto(assignee.Id, assignee.DisplayName, assignee.Email)
                : null,
            ticket.Messages.Select(m => new TicketMessageDto(
                m.Id,
                m.SenderEmail,
                m.SenderName,
                m.Body,
                m.AttachmentNames,
                DateTime.SpecifyKind(m.CreatedAt, DateTimeKind.Utc))).ToList());
    }

    private const int MaxSearchLength = 200;

    // The category filter value for tickets that haven't been classified yet.
    private const string Uncategorized = "uncategorized";

    // The assignee filter value for tickets nobody is assigned to.
    private const string Unassigned = "unassigned";

    // Values match the frontend's column ids.
    private const string DefaultSortBy = "createdAt";
    private static readonly HashSet<string> SortColumns = new(StringComparer.OrdinalIgnoreCase)
    {
        "id", "subject", "submitter", "status", "category", "assignee", "createdAt",
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
            // Unassigned tickets have no name, so they sort first ascending.
            "assignee" => OrderBy(query, t => t.Assignee == null ? null : t.Assignee.DisplayName, descending),
            _ => OrderBy(query, t => t.CreatedAt, descending),
        };
        return descending ? ordered.ThenByDescending(t => t.Id) : ordered.ThenBy(t => t.Id);
    }

    private static IOrderedQueryable<Ticket> OrderBy<TKey>(
        IQueryable<Ticket> query, Expression<Func<Ticket, TKey>> key, bool descending) =>
        descending ? query.OrderByDescending(key) : query.OrderBy(key);
}
