using TicketManagement.Api.Models;

namespace TicketManagement.Api.Ai;

// A reply that answers the ticket from the knowledge base.
public record TicketResolution(string Reply);

// Provider-agnostic AI features. Call sites use this, never a provider SDK directly.
public interface IAiService
{
    // Classifies from the subject and the first inbound message, so load the ticket with its
    // Messages. Returns a TicketCategories value, or null when the model gives no usable answer.
    Task<string?> ClassifyTicketAsync(Ticket ticket, CancellationToken cancellationToken = default);

    // Tries to answer the ticket (subject and first inbound message, so load its Messages) using only
    // the knowledge base, as a reply signed by authorName. Returns null when the ticket needs an
    // agent: the knowledge base doesn't cover it, one of its escalation rules applies, or the model
    // gives no usable answer.
    Task<TicketResolution?> TryResolveTicketAsync(
        Ticket ticket, string knowledgeBase, string authorName, CancellationToken cancellationToken = default);
}
