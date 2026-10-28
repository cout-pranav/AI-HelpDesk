using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TicketManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDashboardFunctions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Dashboard stats, read by DashboardEndpoints. Like TicketEndpoints.VisibleTickets, both skip
            // tickets the AI is still processing (New/Processing); keep the two in sync.

            // One row: total, open and AI-resolved counts, and the mean seconds from creation to
            // resolution (AVG skips unresolved tickets, whose DATEDIFF is NULL; NULL when none is resolved).
            migrationBuilder.Sql("""
                CREATE OR ALTER FUNCTION dbo.GetDashboardStats()
                RETURNS TABLE
                AS RETURN
                SELECT
                    COUNT(*) AS TotalTickets,
                    COUNT(CASE WHEN Status = 'Open' THEN 1 END) AS OpenTickets,
                    COUNT(CASE WHEN ResolvedByAi = 1 THEN 1 END) AS ResolvedByAi,
                    AVG(CAST(DATEDIFF(SECOND, CreatedAt, ResolvedAt) AS float)) AS AverageResolutionSeconds
                FROM dbo.Tickets
                WHERE Status NOT IN ('New', 'Processing');
                """);

            // One row per day for the last @Days days (today included, at most 100), with zero for days
            // without tickets. Days are calendar days at @UtcOffsetMinutes (local time minus UTC), and
            // each day's bounds are converted to UTC so the CreatedAt index can be used.
            migrationBuilder.Sql("""
                CREATE OR ALTER FUNCTION dbo.GetTicketsPerDay(@UtcOffsetMinutes int, @Days int)
                RETURNS TABLE
                AS RETURN
                WITH Digits AS (
                    SELECT d FROM (VALUES (0), (1), (2), (3), (4), (5), (6), (7), (8), (9)) AS v(d)
                ),
                Days AS (
                    SELECT DATEADD(DAY, -(tens.d * 10 + ones.d),
                        CAST(DATEADD(MINUTE, @UtcOffsetMinutes, SYSUTCDATETIME()) AS date)) AS [Date]
                    FROM Digits AS tens CROSS JOIN Digits AS ones
                    WHERE tens.d * 10 + ones.d < @Days
                )
                SELECT d.[Date], COUNT(t.Id) AS [Count]
                FROM Days AS d
                LEFT JOIN dbo.Tickets AS t
                    ON t.Status NOT IN ('New', 'Processing')
                    AND t.CreatedAt >= DATEADD(MINUTE, -@UtcOffsetMinutes, CAST(d.[Date] AS datetime2))
                    AND t.CreatedAt < DATEADD(MINUTE, -@UtcOffsetMinutes, CAST(DATEADD(DAY, 1, d.[Date]) AS datetime2))
                GROUP BY d.[Date];
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP FUNCTION IF EXISTS dbo.GetTicketsPerDay;");
            migrationBuilder.Sql("DROP FUNCTION IF EXISTS dbo.GetDashboardStats;");
        }
    }
}
