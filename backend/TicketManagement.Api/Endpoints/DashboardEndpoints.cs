using Microsoft.EntityFrameworkCore;
using TicketManagement.Api.Data;

namespace TicketManagement.Api.Endpoints;

// AverageResolutionSeconds is null when no ticket has been resolved yet.
public record DashboardStatsDto(
    int TotalTickets,
    int OpenTickets,
    int ResolvedByAi,
    double? AverageResolutionSeconds);

// Tickets created on one calendar day in the caller's time zone.
public record TicketsPerDayDto(DateOnly Date, int Count);

public static class DashboardEndpoints
{
    private const int TicketsPerDayDays = 30;

    // UTC offsets in use range from -12:00 to +14:00.
    private const int MaxUtcOffsetMinutes = 14 * 60;

    public static IEndpointRouteBuilder MapDashboardEndpoints(this IEndpointRouteBuilder app)
    {
        // Both are computed by SQL functions (migration AddDashboardFunctions), which count only the
        // tickets the rest of the API shows, so tickets the AI is still processing don't appear until
        // they are resolved or opened.
        var group = app.MapGroup("/api/dashboard").RequireAuthorization();

        // ResolvedByAi counts tickets still resolved or closed (reopening clears the flag). The average
        // covers every resolved or closed ticket, whether the AI or an agent resolved it.
        group.MapGet("/", async (TicketManagementDbContext db) =>
            Results.Ok(await db.Database
                .SqlQuery<DashboardStatsDto>($"SELECT * FROM dbo.GetDashboardStats()")
                .SingleAsync()));

        // Tickets created on each of the last 30 days, today included, oldest first, with a zero for
        // days without any. Days are bucketed in the caller's time zone, given as utcOffsetMinutes
        // (local time minus UTC, e.g. 330 for IST; default 0 = UTC).
        group.MapGet("/tickets-per-day", async (int? utcOffsetMinutes, TicketManagementDbContext db) =>
        {
            var offset = utcOffsetMinutes ?? 0;
            if (Math.Abs(offset) > MaxUtcOffsetMinutes)
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["utcOffsetMinutes"] = [$"UTC offset must be between -{MaxUtcOffsetMinutes} and {MaxUtcOffsetMinutes} minutes."],
                });

            var days = await db.Database
                .SqlQuery<TicketsPerDayDto>($"SELECT * FROM dbo.GetTicketsPerDay({offset}, {TicketsPerDayDays})")
                .OrderBy(d => d.Date)
                .ToListAsync();
            return Results.Ok(days);
        });

        return app;
    }
}
