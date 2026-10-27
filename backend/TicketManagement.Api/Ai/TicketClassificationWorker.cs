using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TicketManagement.Api.Data;
using TicketManagement.Api.Models;

namespace TicketManagement.Api.Ai;

// Classifies queued tickets with IAiService, one at a time, off the request path. A failure is
// logged and leaves the ticket uncategorized; it never affects ticket creation.
public class TicketClassificationWorker(
    TicketClassificationQueue queue,
    IServiceScopeFactory scopeFactory,
    IOptions<GeminiOptions> geminiOptions,
    ILogger<TicketClassificationWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var warnedNotConfigured = false;

        await foreach (var ticketId in queue.ReadAllAsync(stoppingToken))
        {
            if (string.IsNullOrEmpty(geminiOptions.Value.ApiKey))
            {
                if (!warnedNotConfigured)
                {
                    logger.LogWarning("Gemini:ApiKey is not set; skipping automatic ticket classification.");
                    warnedNotConfigured = true;
                }
                continue;
            }

            try
            {
                await ClassifyAsync(ticketId, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to auto-classify ticket {TicketId}.", ticketId);
            }
        }
    }

    private async Task ClassifyAsync(int ticketId, CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TicketManagementDbContext>();

        var ticket = await db.Tickets
            .AsNoTracking()
            .Where(t => t.Id == ticketId && t.Category == null)
            .Select(t => new
            {
                t.Subject,
                Body = t.Messages
                    .Where(m => m.Direction == MessageDirections.Inbound)
                    .OrderBy(m => m.CreatedAt).ThenBy(m => m.Id)
                    .Select(m => m.Body)
                    .FirstOrDefault(),
            })
            .FirstOrDefaultAsync(cancellationToken);
        if (ticket is null)
            return; // Deleted, or an agent already set a category.

        var ai = scope.ServiceProvider.GetRequiredService<IAiService>();
        var category = await ai.ClassifyTicketAsync(ticket.Subject, ticket.Body ?? string.Empty, cancellationToken);
        if (category is null)
        {
            logger.LogWarning("AI returned no usable category for ticket {TicketId}.", ticketId);
            return;
        }

        // Only fill an empty category, so a choice an agent made meanwhile is never overwritten.
        var updated = await db.Tickets
            .Where(t => t.Id == ticketId && t.Category == null)
            .ExecuteUpdateAsync(s => s
                .SetProperty(t => t.Category, category)
                .SetProperty(t => t.UpdatedAt, DateTime.UtcNow), cancellationToken);
        if (updated > 0)
            logger.LogInformation("Auto-classified ticket {TicketId} as {Category}.", ticketId, category);
    }
}
