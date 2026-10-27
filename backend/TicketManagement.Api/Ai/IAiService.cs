namespace TicketManagement.Api.Ai;

// Provider-agnostic AI features. Call sites use this, never a provider SDK directly.
public interface IAiService
{
    // Returns a TicketCategories value, or null when the model gives no usable answer.
    Task<string?> ClassifyTicketAsync(string subject, string body, CancellationToken cancellationToken = default);
}
