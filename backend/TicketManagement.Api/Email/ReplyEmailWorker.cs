using System.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SendGrid;
using SendGrid.Helpers.Mail;
using TicketManagement.Api.Data;
using TicketManagement.Api.Models;

namespace TicketManagement.Api.Email;

// Emails Pending replies to the ticket's submitter through SendGrid, one at a time, off the request
// path. Transient failures (network, 429, 5xx) are retried a few times; then the reply is marked
// Failed and an agent can resend it. The reply's content is always kept, whatever happens to the email.
public class ReplyEmailWorker(
    ReplyEmailQueue queue,
    IServiceScopeFactory scopeFactory,
    IOptions<SendGridOptions> options,
    ILogger<ReplyEmailWorker> logger) : BackgroundService
{
    private const int MaxDeliveryErrorLength = 500; // TicketMessages.DeliveryError column length
    // Waits before the 2nd and 3rd attempts.
    private static readonly TimeSpan[] RetryDelays = [TimeSpan.FromSeconds(2), TimeSpan.FromSeconds(10)];

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Without it, replies are saved with no delivery status and nothing is enqueued.
        if (!options.Value.IsConfigured)
        {
            logger.LogWarning("SendGrid:ApiKey or SendGrid:FromEmail is not set; replies will not be emailed.");
            return;
        }

        try
        {
            // Replies still Pending from before a restart (or dropped from a full queue).
            foreach (var messageId in await LoadPendingIdsAsync(stoppingToken))
                await SendSafelyAsync(messageId, stoppingToken);

            // A reply enqueued while the backlog ran is skipped here, as it is no longer Pending.
            await foreach (var messageId in queue.ReadAllAsync(stoppingToken))
                await SendSafelyAsync(messageId, stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
        }
    }

    private async Task<List<int>> LoadPendingIdsAsync(CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TicketManagementDbContext>();
        return await db.TicketMessages
            .Where(m => m.DeliveryStatus == MessageDeliveryStatuses.Pending)
            .OrderBy(m => m.Id)
            .Select(m => m.Id)
            .ToListAsync(cancellationToken);
    }

    private async Task SendSafelyAsync(int messageId, CancellationToken stoppingToken)
    {
        try
        {
            await SendAsync(messageId, stoppingToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !stoppingToken.IsCancellationRequested)
        {
            logger.LogError(ex, "Failed to email reply {MessageId}; it stays Pending until the next restart.", messageId);
        }
    }

    private async Task SendAsync(int messageId, CancellationToken stoppingToken)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TicketManagementDbContext>();
        var client = scope.ServiceProvider.GetRequiredService<ISendGridClient>();

        // Anything but Pending was already sent, failed, or never meant to be emailed.
        var reply = await db.TicketMessages
            .Include(m => m.Ticket)
            .FirstOrDefaultAsync(m => m.Id == messageId && m.DeliveryStatus == MessageDeliveryStatuses.Pending,
                stoppingToken);
        if (reply is null)
            return;

        // Threads the reply under the customer's original email in their mail client.
        var originalMessageId = await db.TicketMessages
            .Where(m => m.TicketId == reply.TicketId
                && m.Direction == MessageDirections.Inbound
                && m.ExternalMessageId != null)
            .OrderBy(m => m.CreatedAt).ThenBy(m => m.Id)
            .Select(m => m.ExternalMessageId)
            .FirstOrDefaultAsync(stoppingToken);

        var email = BuildEmail(reply, originalMessageId);
        string error;
        var attempt = 0;
        while (true)
        {
            attempt++;
            bool transient;
            try
            {
                var response = await client.SendEmailAsync(email, stoppingToken);
                if (response.IsSuccessStatusCode)
                {
                    reply.DeliveryStatus = MessageDeliveryStatuses.Sent;
                    reply.DeliveryAttempts += attempt;
                    reply.SentAt = DateTime.UtcNow;
                    reply.DeliveryError = null;
                    reply.ProviderMessageId = response.Headers.TryGetValues("X-Message-Id", out var ids)
                        ? ids.FirstOrDefault()
                        : null;
                    // SendGrid has the email now; record that even if the app is stopping.
                    await db.SaveChangesAsync(CancellationToken.None);
                    logger.LogInformation("Emailed reply {MessageId} on ticket {TicketId} to the submitter.",
                        reply.Id, reply.TicketId);
                    return;
                }

                var body = await response.Body.ReadAsStringAsync(stoppingToken);
                error = $"SendGrid returned {(int)response.StatusCode}: {body}";
                transient = response.StatusCode == HttpStatusCode.TooManyRequests || (int)response.StatusCode >= 500;
            }
            catch (Exception ex) when (ex is not OperationCanceledException || !stoppingToken.IsCancellationRequested)
            {
                // Network errors and HttpClient timeouts.
                error = ex.Message;
                transient = true;
            }

            logger.LogWarning("Attempt {Attempt} to email reply {MessageId} failed: {Error}", attempt, reply.Id, error);
            if (!transient || attempt > RetryDelays.Length)
                break;
            await Task.Delay(RetryDelays[attempt - 1], stoppingToken);
        }

        reply.DeliveryStatus = MessageDeliveryStatuses.Failed;
        reply.DeliveryAttempts += attempt;
        reply.DeliveryError = error.Length > MaxDeliveryErrorLength ? error[..MaxDeliveryErrorLength] : error;
        await db.SaveChangesAsync(CancellationToken.None);
        logger.LogError("Giving up on emailing reply {MessageId} on ticket {TicketId}: {Error}",
            reply.Id, reply.TicketId, error);
    }

    private SendGridMessage BuildEmail(TicketMessage reply, string? originalMessageId)
    {
        var ticket = reply.Ticket;
        var settings = options.Value;
        var subject = ticket.Subject.StartsWith("Re:", StringComparison.OrdinalIgnoreCase)
            ? ticket.Subject
            : $"Re: {ticket.Subject}";

        var email = MailHelper.CreateSingleEmail(
            new EmailAddress(settings.FromEmail, settings.FromName),
            new EmailAddress(ticket.SubmitterEmail, ticket.SubmitterName),
            subject,
            reply.Body,
            htmlContent: null);
        if (originalMessageId is not null)
        {
            email.AddHeader("In-Reply-To", originalMessageId);
            email.AddHeader("References", originalMessageId);
        }
        return email;
    }
}
