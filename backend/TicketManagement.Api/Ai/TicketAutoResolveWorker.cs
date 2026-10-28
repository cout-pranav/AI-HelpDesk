using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TicketManagement.Api.Data;
using TicketManagement.Api.Models;

namespace TicketManagement.Api.Ai;

// Auto-resolves queued tickets one at a time, off the request path: New -> Processing, then try to
// answer from the knowledge base -> Resolved (with a reply) or Open (left for an agent). The reply
// is posted as a real user (see FindReplyAuthorAsync), exactly like a manual reply. Classification
// runs separately (TicketClassificationWorker). AI failures are logged and never affect ticket
// creation; the ticket just ends up Open.
public class TicketAutoResolveWorker(
    TicketAutoResolveQueue queue,
    KnowledgeBase knowledgeBase,
    IServiceScopeFactory scopeFactory,
    IConfiguration config,
    IOptions<GeminiOptions> geminiOptions,
    ILogger<TicketAutoResolveWorker> logger) : BackgroundService
{
    private const string ReplyAsEmailConfigKey = "AutoResolve:ReplyAsEmail";

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Without a key the inbound-email endpoint creates tickets as Open and enqueues nothing.
        if (string.IsNullOrEmpty(geminiOptions.Value.ApiKey))
        {
            logger.LogWarning("Gemini:ApiKey is not set; skipping automatic ticket resolution.");
            return;
        }

        await foreach (var ticketId in queue.ReadAllAsync(stoppingToken))
        {
            try
            {
                await AutoResolveAsync(ticketId, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to auto-resolve ticket {TicketId}.", ticketId);
            }
        }
    }

    private async Task AutoResolveAsync(int ticketId, CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TicketManagementDbContext>();
        var ai = scope.ServiceProvider.GetRequiredService<IAiService>();

        // Claim the ticket; anything but New means it was already handled (or deleted).
        var claimed = await db.Tickets
            .Where(t => t.Id == ticketId && t.Status == TicketStatuses.New)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.Status, TicketStatuses.Processing), cancellationToken);
        if (claimed == 0)
            return;

        var resolved = false;
        try
        {
            var ticket = await db.Tickets
                .AsNoTracking()
                .Include(t => t.Messages)
                .FirstOrDefaultAsync(t => t.Id == ticketId, cancellationToken);
            if (ticket is null)
                return;

            resolved = await TryResolveAsync(db, ai, ticket, cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !cancellationToken.IsCancellationRequested)
        {
            logger.LogError(ex, "Auto-resolve failed for ticket {TicketId}; opening it for an agent.", ticketId);
        }
        finally
        {
            // Not answerable, the AI call failed, or the app is stopping mid-call: hand it to the agents,
            // so a ticket is never left hidden in Processing.
            if (!resolved)
                await OpenTicketAsync(db, ticketId);
        }
    }

    // Processing -> Open. Runs even while the app is stopping (no cancellation token).
    private async Task OpenTicketAsync(TicketManagementDbContext db, int ticketId)
    {
        try
        {
            var opened = await db.Tickets
                .Where(t => t.Id == ticketId && t.Status == TicketStatuses.Processing)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(t => t.Status, TicketStatuses.Open)
                    .SetProperty(t => t.UpdatedAt, DateTime.UtcNow), CancellationToken.None);
            if (opened > 0)
                logger.LogInformation("Ticket {TicketId} left Open for an agent.", ticketId);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to open ticket {TicketId}; it is stuck in Processing.", ticketId);
        }
    }

    // Returns true when the ticket was answered from the knowledge base and marked Resolved.
    private async Task<bool> TryResolveAsync(
        TicketManagementDbContext db, IAiService ai, Ticket ticket, CancellationToken cancellationToken)
    {
        if (knowledgeBase.Content is not string kb)
            return false;

        var author = await FindReplyAuthorAsync(db, cancellationToken);
        if (author is null)
        {
            logger.LogWarning("No active user to send auto-resolve replies as; ticket {TicketId} left for agents.", ticket.Id);
            return false;
        }

        var resolution = await ai.TryResolveTicketAsync(ticket, kb, author.DisplayName, cancellationToken);
        if (resolution is null)
            return false;

        // The status change and the AI's reply are saved together, so a Resolved ticket always shows
        // the answer that resolved it.
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var now = DateTime.UtcNow;
        var updated = await db.Tickets
            .Where(t => t.Id == ticket.Id && t.Status == TicketStatuses.Processing)
            .ExecuteUpdateAsync(s => s
                .SetProperty(t => t.Status, TicketStatuses.Resolved)
                .SetProperty(t => t.UpdatedAt, now), cancellationToken);
        if (updated == 0)
            return false;

        db.TicketMessages.Add(new TicketMessage
        {
            TicketId = ticket.Id,
            Direction = MessageDirections.Outbound,
            AuthorId = author.Id,
            SenderEmail = author.Email,
            SenderName = author.DisplayName,
            Body = resolution.Reply,
            CreatedAt = now,
        });
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        logger.LogInformation("Auto-resolved ticket {TicketId} from the knowledge base, replying as user {UserId}.",
            ticket.Id, author.Id);
        return true;
    }

    // The user auto-resolve replies are sent as: the active user at AutoResolve:ReplyAsEmail, or
    // else the longest-standing active admin (normally the seeded one). Null when there is neither.
    private async Task<User?> FindReplyAuthorAsync(TicketManagementDbContext db, CancellationToken cancellationToken)
    {
        var activeUsers = db.Users.AsNoTracking().Where(u => u.IsActive);
        if (config[ReplyAsEmailConfigKey] is { Length: > 0 } email)
        {
            var normalized = User.NormalizeEmail(email);
            if (await activeUsers.FirstOrDefaultAsync(u => u.Email == normalized, cancellationToken) is { } configured)
                return configured;
            logger.LogWarning("{Key} is not an active user; replying as the first active admin instead.", ReplyAsEmailConfigKey);
        }
        return await activeUsers
            .Where(u => u.Role == Roles.Admin)
            .OrderBy(u => u.CreatedAt).ThenBy(u => u.Id)
            .FirstOrDefaultAsync(cancellationToken);
    }
}
