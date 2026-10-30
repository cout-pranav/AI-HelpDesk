namespace TicketManagement.Api.Models;

// One message in a ticket's thread: an inbound customer email or an agent's reply.
public class TicketMessage
{
    public int Id { get; set; }
    public int TicketId { get; set; }
    public Ticket Ticket { get; set; } = null!;
    // A MessageDirections value.
    public string Direction { get; set; } = MessageDirections.Inbound;
    // The user who wrote a reply; null for customer messages.
    public int? AuthorId { get; set; }
    public User? Author { get; set; }
    // For replies, a snapshot of the author's email and name, so the thread still shows them
    // after the user is renamed or soft-deleted.
    public string SenderEmail { get; set; } = string.Empty;
    public string? SenderName { get; set; }
    // Plain-text body (HTML-only emails are converted to text; raw HTML is never stored).
    public string Body { get; set; } = string.Empty;
    // The email's Message-ID header, used to ignore redelivered webhooks. Null when the sender didn't provide one.
    public string? ExternalMessageId { get; set; }
    // Attachments aren't stored yet; their names are kept so nothing is silently dropped.
    public List<string> AttachmentNames { get; set; } = [];
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    // For replies, a MessageDeliveryStatuses value; null for customer messages and for replies that
    // aren't emailed (sending not configured, or saved before outbound email existed).
    public string? DeliveryStatus { get; set; }
    // Send attempts so far, across resends.
    public int DeliveryAttempts { get; set; }
    // When SendGrid accepted the email.
    public DateTime? SentAt { get; set; }
    // The last send failure, for troubleshooting; cleared once the email is sent.
    public string? DeliveryError { get; set; }
    // SendGrid's X-Message-Id, to look the email up in SendGrid's activity feed.
    public string? ProviderMessageId { get; set; }
}
