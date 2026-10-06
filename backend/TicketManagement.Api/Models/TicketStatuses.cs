namespace TicketManagement.Api.Models;

// Stored in the DB and API responses as these values.
public static class TicketStatuses
{
    public const string Open = "Open";
    public const string Resolved = "Resolved";
    public const string Closed = "Closed";

    public static readonly string[] All = [Open, Resolved, Closed];
}
