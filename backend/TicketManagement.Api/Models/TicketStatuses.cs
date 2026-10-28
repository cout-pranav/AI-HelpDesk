namespace TicketManagement.Api.Models;

// Stored in the DB and API responses as these values.
public static class TicketStatuses
{
    // Internal to the AI pipeline (TicketAutoResolveWorker): a ticket is New until the worker picks it
    // up and Processing while the AI tries to resolve it, then Resolved or Open. Tickets in these
    // statuses are never returned by the API.
    public const string New = "New";
    public const string Processing = "Processing";

    public const string Open = "Open";
    public const string Resolved = "Resolved";
    public const string Closed = "Closed";

    // The public statuses: the ones the API returns, filters by and lets users set.
    public static readonly string[] All = [Open, Resolved, Closed];
    public static readonly string[] Internal = [New, Processing];
}
