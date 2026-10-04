namespace TicketManagement.Api.Models;

public class User
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Role { get; set; } = Roles.Agent;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    // Set when the user is soft-deleted; a global query filter hides such users everywhere.
    public DateTime? DeletedAt { get; set; }
    public List<Account> Accounts { get; set; } = [];

    public static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();
}
