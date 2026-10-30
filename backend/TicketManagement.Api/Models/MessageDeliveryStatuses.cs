namespace TicketManagement.Api.Models;

// Whether a reply has been emailed to the submitter. Inbound messages, and replies saved while
// email sending isn't configured, have no delivery status (null).
public static class MessageDeliveryStatuses
{
    // Queued for ReplyEmailWorker.
    public const string Pending = "pending";
    // Accepted by the email provider.
    public const string Sent = "sent";
    // Every attempt failed; an agent can resend it.
    public const string Failed = "failed";
}
