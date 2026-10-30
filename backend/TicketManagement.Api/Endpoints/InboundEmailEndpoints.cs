using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TicketManagement.Api.Ai;
using TicketManagement.Api.Data;
using TicketManagement.Api.Email;
using TicketManagement.Api.Models;

namespace TicketManagement.Api.Endpoints;

public record InboundEmailAddress(string? Email, string? Name);

public record InboundEmailAttachment(string? FileName);

// Provider-agnostic shape of a received email. A provider's webhook (e.g. the SendGrid Inbound Parse
// endpoint below) or a mailbox poller maps its own payload onto this. Attachment contents are not sent, only names.
public record InboundEmailRequest(
    string? MessageId,
    InboundEmailAddress? From,
    string? Subject,
    string? Text,
    string? Html,
    List<InboundEmailAttachment>? Attachments);

// Duplicate is true when this Message-ID was already received; TicketId is then the existing ticket.
public record InboundEmailResponse(int TicketId, bool Duplicate);

public static partial class InboundEmailEndpoints
{
    public const string SecretHeader = "X-Inbound-Email-Secret";
    public const string SecretQueryParameter = "secret";
    private const string SecretConfigKey = "InboundEmail:Secret";
    private const int MaxSubjectLength = 200; // Tickets.Subject column length
    private const int MaxNameLength = 100; // Tickets.SubmitterName / TicketMessages.SenderName column length
    private const int MaxEmailLength = 256; // Tickets.SubmitterEmail column length
    private const int MaxMessageIdLength = 500; // TicketMessages.ExternalMessageId column length
    private const int MaxAttachmentNameLength = 255;
    private const long MaxInboundEmailBodyBytes = 2 * 1024 * 1024;
    // SendGrid posts the attachment files too (we only keep their names), and accepts messages up to 30 MB.
    private const long MaxSendGridBodyBytes = 30 * 1024 * 1024;
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
            TicketClassificationQueue classificationQueue,
            TicketAutoResolveQueue autoResolveQueue,
            IOptions<GeminiOptions> geminiOptions,
            ILogger<InboundEmailRequest> logger) =>
        {
            if (CheckSecret(http.Request.Headers[SecretHeader].ToString(), config, logger) is { } rejected)
                return rejected;

            return await CreateTicketFromEmail(request, db, classificationQueue, autoResolveQueue, geminiOptions, logger);
        })
        .AllowAnonymous()
        .WithMetadata(new RequestSizeLimitAttribute(MaxInboundEmailBodyBytes));

        // SendGrid Inbound Parse webhook (default parsed format, not "raw MIME"). SendGrid can't send custom
        // headers, so the same secret comes in the ?secret= query parameter of the configured destination URL.
        app.MapPost("/api/inbound-email/sendgrid", async (
            HttpContext http,
            IConfiguration config,
            TicketManagementDbContext db,
            TicketClassificationQueue classificationQueue,
            TicketAutoResolveQueue autoResolveQueue,
            IOptions<GeminiOptions> geminiOptions,
            ILogger<InboundEmailRequest> logger) =>
        {
            if (CheckSecret(http.Request.Query[SecretQueryParameter].ToString(), config, logger) is { } rejected)
                return rejected;
            if (!http.Request.HasFormContentType)
                return Results.Problem("Expected a multipart/form-data body.", statusCode: StatusCodes.Status415UnsupportedMediaType);

            // Read by hand rather than [FromForm] binding, which would require an antiforgery token.
            var form = await http.Request.ReadFormAsync();
            return await CreateTicketFromEmail(FromSendGridForm(form), db, classificationQueue, autoResolveQueue, geminiOptions, logger);
        })
        .AllowAnonymous()
        .WithMetadata(new RequestSizeLimitAttribute(MaxSendGridBodyBytes));

        return app;
    }

    // Returns the rejection response, or null when the provided secret matches InboundEmail:Secret.
    private static IResult? CheckSecret(string provided, IConfiguration config, ILogger logger)
    {
        var secret = config[SecretConfigKey];
        if (string.IsNullOrEmpty(secret))
        {
            logger.LogWarning("Rejected an inbound email because {Key} is not configured.", SecretConfigKey);
            return Results.Problem("Inbound email is not configured.", statusCode: StatusCodes.Status503ServiceUnavailable);
        }
        return SecretMatches(provided, secret)
            ? null
            : Results.Problem("Invalid inbound email secret.", statusCode: StatusCodes.Status401Unauthorized);
    }

    private static async Task<IResult> CreateTicketFromEmail(
        InboundEmailRequest request,
        TicketManagementDbContext db,
        TicketClassificationQueue classificationQueue,
        TicketAutoResolveQueue autoResolveQueue,
        IOptions<GeminiOptions> geminiOptions,
        ILogger logger)
    {
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

        // With AI configured the ticket starts New (hidden from agents) until TicketAutoResolveWorker
        // resolves it or opens it; without AI it goes straight to the agents.
        var aiConfigured = !string.IsNullOrEmpty(geminiOptions.Value.ApiKey);
        var now = DateTime.UtcNow;
        var ticket = new Ticket
        {
            Subject = subject,
            Status = aiConfigured ? TicketStatuses.New : TicketStatuses.Open,
            Source = TicketSources.Email,
            SubmitterEmail = senderEmail,
            SubmitterName = senderName,
            CreatedAt = now,
            UpdatedAt = now,
        };
        ticket.Messages.Add(new TicketMessage
        {
            Direction = MessageDirections.Inbound,
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
        // Classified and auto-resolved in the background by separate workers (TicketClassificationWorker,
        // TicketAutoResolveWorker), so the webhook isn't held up. Neither depends on the other.
        if (aiConfigured)
        {
            classificationQueue.Enqueue(ticket.Id);
            autoResolveQueue.Enqueue(ticket.Id);
        }
        return Results.Created($"/api/tickets/{ticket.Id}", new InboundEmailResponse(ticket.Id, Duplicate: false));
    }

    // Maps SendGrid's parsed fields: "from" is a "Name <address>" header value (falling back to the SMTP
    // envelope sender), the Message-ID comes from the raw "headers" block, and attachment names from
    // "attachment-info". The attachment file parts themselves are ignored.
    private static InboundEmailRequest FromSendGridForm(IFormCollection form)
    {
        InboundEmailAddress? from = null;
        if (MailAddress.TryCreate(form["from"].ToString().Trim(), out var fromHeader))
            from = new InboundEmailAddress(fromHeader.Address, fromHeader.DisplayName);
        else if (ReadJsonString(form["envelope"].ToString(), "from") is { } envelopeFrom)
            from = new InboundEmailAddress(envelopeFrom, null);

        var messageId = MessageIdHeader().Match(form["headers"].ToString()) is { Success: true } match
            ? match.Groups[1].Value
            : null;

        return new InboundEmailRequest(
            messageId,
            from,
            form["subject"].ToString(),
            form["text"].ToString(),
            form["html"].ToString(),
            ReadAttachmentNames(form["attachment-info"].ToString()));
    }

    private static string? ReadJsonString(string json, string property)
    {
        if (string.IsNullOrWhiteSpace(json))
            return null;
        try
        {
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.ValueKind == JsonValueKind.Object
                && doc.RootElement.TryGetProperty(property, out var value)
                && value.ValueKind == JsonValueKind.String
                ? value.GetString()
                : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    // attachment-info is {"attachment1": {"filename": "a.png", ...}, ...}.
    private static List<InboundEmailAttachment> ReadAttachmentNames(string json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return [];
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Object)
                return [];
            return doc.RootElement.EnumerateObject()
                .Select(a => a.Value.ValueKind == JsonValueKind.Object
                    && a.Value.TryGetProperty("filename", out var name)
                    && name.ValueKind == JsonValueKind.String
                    ? name.GetString()
                    : null)
                .Select(name => new InboundEmailAttachment(name))
                .ToList();
        }
        catch (JsonException)
        {
            return [];
        }
    }

    [GeneratedRegex(@"^Message-ID:\s*(\S+)", RegexOptions.IgnoreCase | RegexOptions.Multiline)]
    private static partial Regex MessageIdHeader();

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
