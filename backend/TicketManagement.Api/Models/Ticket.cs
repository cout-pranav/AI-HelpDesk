namespace TicketManagement.Api.Models;

public class Ticket
{
    public int Id { get; set; }
    public string Subject { get; set; } = string.Empty;
    public string Status { get; set; } = TicketStatuses.Open;
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
    public List<TicketMessage> Messages { get; set; } = [];
}
