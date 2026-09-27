namespace TicketManagement.Api.Models;

// A way for a user to sign in. Credential accounts hold a password hash;
// external providers (e.g. Google) leave it null.
public class Account
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public string Provider { get; set; } = AuthProviders.Credential;
    public string? PasswordHash { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
