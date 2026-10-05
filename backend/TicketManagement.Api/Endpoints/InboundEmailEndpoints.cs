using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TicketManagement.Api.Data;
using TicketManagement.Api.Email;
using TicketManagement.Api.Models;

namespace TicketManagement.Api.Endpoints;

public record InboundEmailAddress(string? Email, string? Name);

public record InboundEmailAttachment(string? FileName);

// Provider-agnostic shape of a received email. A provider's webhook (Brevo, SendGrid, ...) or a
// mailbox poller maps its own payload onto this. Attachment contents are not sent, only names.
public record InboundEmailRequest(
    string? MessageId,
    InboundEmailAddress? From,
    string? Subject,
    string? Text,
    string? Html,
    List<InboundEmailAttachment>? Attachments);

// Duplicate is true when this Message-ID was already received; TicketId is then the existing ticket.
public record InboundEmailResponse(int TicketId, bool Duplicate);

public static class InboundEmailEndpoints
{
    public const string SecretHeader = "X-Inbound-Email-Secret";
    private const string SecretConfigKey = "InboundEmail:Secret";
    private const int MaxSubjectLength = 200; // Tickets.Subject column length
    private const int MaxNameLength = 100; // Tickets.SubmitterName / TicketMessages.SenderName column length
    private const int MaxEmailLength = 256; // Tickets.SubmitterEmail column length
    private const int MaxMessageIdLength = 500; // TicketMessages.ExternalMessageId column length
    private const int MaxAttachmentNameLength = 255;
    private const long MaxInboundEmailBodyBytes = 2 * 1024 * 1024;
    private const string NoSubject = "(no subject)";

    public static IEndpointRouteBuilder MapInboundEmailEndpoints(this IEndpointRouteBuilder app)
    {
        // Called machine-to-machine (no user JWT), so it's guarded by a shared secret header instead.
        // Every email creates a new ticket; replies are not threaded onto existing tickets yet.
        app.MapPost("/api/inbound-email", async (
            InboundEmailRequest request,
            HttpContext http,
            IConfiguration config,
            TicketManagementDbContext db,
            ILogger<InboundEmailRequest> logger) =>
        {
            var secret = config[SecretConfigKey];
            if (string.IsNullOrEmpty(secret))
            {
                logger.LogWarning("Rejected an inbound email because {Key} is not configured.", SecretConfigKey);
                return Results.Problem("Inbound email is not configured.", statusCode: StatusCodes.Status503ServiceUnavailable);
            }
            if (!SecretMatches(http.Request.Headers[SecretHeader].ToString(), secret))
                return Results.Problem("Invalid inbound email secret.", statusCode: StatusCodes.Status401Unauthorized);

            var fromEmail = request.From?.Email?.Trim() ?? string.Empty;
            if (fromEmail.Length == 0 || fromEmail.Length > MaxEmailLength
                || !MailAddress.TryCreate(fromEmail, out var parsed) || parsed.Address != fromEmail)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["from.email"] = ["A valid sender email address is required."],
                });
            }

            var senderEmail = User.NormalizeEmail(fromEmail);
            var senderName = Truncate(request.From?.Name?.Trim(), MaxNameLength);
            if (string.IsNullOrEmpty(senderName))
                senderName = null;
            var subject = Truncate(request.Subject?.Trim(), MaxSubjectLength);
            if (string.IsNullOrEmpty(subject))
                subject = NoSubject;
            var body = !string.IsNullOrWhiteSpace(request.Text)
                ? HtmlText.Normalize(request.Text)
                : HtmlText.ToPlainText(request.Html ?? string.Empty);
            // An over-long Message-ID can't be stored intact, so that email just isn't deduplicated.
            var messageId = request.MessageId?.Trim();
            if (string.IsNullOrEmpty(messageId) || messageId.Length > MaxMessageIdLength)
                messageId = null;
            var attachmentNames = (request.Attachments ?? [])
                .Select(a => Truncate(a?.FileName?.Trim(), MaxAttachmentNameLength))
                .OfType<string>()
                .Where(n => n.Length > 0)
                .ToList();

            // Webhook providers retry deliveries, so the same email can arrive more than once.
            if (messageId is not null && await FindTicketIdByMessageId(db, messageId) is int existingId)
                return Results.Ok(new InboundEmailResponse(existingId, Duplicate: true));

            var now = DateTime.UtcNow;
            var ticket = new Ticket
            {
                Subject = subject,
                Status = TicketStatuses.Open,
                Source = TicketSources.Email,
                SubmitterEmail = senderEmail,
                SubmitterName = senderName,
                CreatedAt = now,
                UpdatedAt = now,
            };
            ticket.Messages.Add(new TicketMessage
            {
                SenderEmail = senderEmail,
                SenderName = senderName,
                Body = body,
                ExternalMessageId = messageId,
                AttachmentNames = attachmentNames,
                CreatedAt = now,
            });
            db.Tickets.Add(ticket);

            try
            {
                await db.SaveChangesAsync();
            }
            catch (DbUpdateException) when (messageId is not null)
            {
                // Lost a race with a concurrent delivery of the same email (unique index on ExternalMessageId).
                db.ChangeTracker.Clear();
                if (await FindTicketIdByMessageId(db, messageId) is int racedId)
                    return Results.Ok(new InboundEmailResponse(racedId, Duplicate: true));
                throw;
            }

            logger.LogInformation("Created ticket {TicketId} from an inbound email.", ticket.Id);
            return Results.Created($"/api/tickets/{ticket.Id}", new InboundEmailResponse(ticket.Id, Duplicate: false));
        })
        .AllowAnonymous()
        .WithMetadata(new RequestSizeLimitAttribute(MaxInboundEmailBodyBytes));

        return app;
    }

    private static async Task<int?> FindTicketIdByMessageId(TicketManagementDbContext db, string messageId) =>
        await db.TicketMessages
            .AsNoTracking()
            .Where(m => m.ExternalMessageId == messageId)
            .Select(m => (int?)m.TicketId)
            .FirstOrDefaultAsync();

    // Constant-time comparison, so response timing doesn't reveal how much of the secret matched.
    private static bool SecretMatches(string provided, string expected) =>
        CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(provided), Encoding.UTF8.GetBytes(expected));

    private static string? Truncate(string? value, int maxLength) =>
        value is not null && value.Length > maxLength ? value[..maxLength].TrimEnd() : value;
}
