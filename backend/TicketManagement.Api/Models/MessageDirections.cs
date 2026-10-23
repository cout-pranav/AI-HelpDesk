namespace TicketManagement.Api.Models;

// Which way a ticket message travelled.
public static class MessageDirections
{
    // From the customer, e.g. a received email.
    public const string Inbound = "inbound";
    // A reply written by an agent or admin.
    public const string Outbound = "outbound";
}
