namespace TicketManagement.Api.Models;

public class Ticket
{
    public int Id { get; set; }
    public string Subject { get; set; } = string.Empty;
    public string Status { get; set; } = TicketStatuses.New;
    // A TicketCategories value; null until the ticket is classified.
    public string? Category { get; set; }
    // How the ticket was created, a TicketSources value.
    public string Source { get; set; } = TicketSources.Email;
    public string SubmitterEmail { get; set; } = string.Empty;
    public string? SubmitterName { get; set; }
    // The user working the ticket; null while unassigned. Only admins change it.
    public int? AssigneeId { get; set; }
    public User? Assignee { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    // When the ticket was resolved or closed; null while it is unresolved. Cleared when it is reopened.
    public DateTime? ResolvedAt { get; set; }
    // True when the auto-resolver answered it from the knowledge base; cleared when it is reopened.
    public bool ResolvedByAi { get; set; }
    public List<TicketMessage> Messages { get; set; } = [];
}
