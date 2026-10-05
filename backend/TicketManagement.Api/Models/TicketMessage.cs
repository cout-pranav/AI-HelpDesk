namespace TicketManagement.Api.Models;

// One message in a ticket's thread. For now only inbound customer emails create these.
public class TicketMessage
{
    public int Id { get; set; }
    public int TicketId { get; set; }
    public Ticket Ticket { get; set; } = null!;
    public string SenderEmail { get; set; } = string.Empty;
    public string? SenderName { get; set; }
    // Plain-text body (HTML-only emails are converted to text; raw HTML is never stored).
    public string Body { get; set; } = string.Empty;
    // The email's Message-ID header, used to ignore redelivered webhooks. Null when the sender didn't provide one.
    public string? ExternalMessageId { get; set; }
    // Attachments aren't stored yet; their names are kept so nothing is silently dropped.
    public List<string> AttachmentNames { get; set; } = [];
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
