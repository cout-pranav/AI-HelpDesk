using TicketManagement.Api.Models;

namespace TicketManagement.Api.Ai;

// Provider-agnostic AI features. Call sites use this, never a provider SDK directly.
public interface IAiService
{
    // Classifies from the subject and the first inbound message, so load the ticket with its
    // Messages. Returns a TicketCategories value, or null when the model gives no usable answer.
    Task<string?> ClassifyTicketAsync(Ticket ticket, CancellationToken cancellationToken = default);
}
