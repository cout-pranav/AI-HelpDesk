namespace TicketManagement.Api.Email;

// Outbound email through SendGrid. ApiKey is a secret (user-secrets in Development, SendGrid__ApiKey
// elsewhere). FromEmail must be a verified sender (or on an authenticated domain) in SendGrid.
public class SendGridOptions
{
    public const string SectionName = "SendGrid";

    public string? ApiKey { get; set; }
    public string? FromEmail { get; set; }
    public string FromName { get; set; } = "Support";

    // Without both, replies are only stored (no delivery status) and nothing is emailed.
    public bool IsConfigured => !string.IsNullOrEmpty(ApiKey) && !string.IsNullOrEmpty(FromEmail);
}
