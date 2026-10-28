using System.Threading.Channels;

namespace TicketManagement.Api.Ai;

// In-memory hand-off from request handlers to TicketAutoResolveWorker, so creating a ticket never
// waits on the AI call. Ids still queued when the app stops are lost (the ticket stays New).
public class TicketAutoResolveQueue(ILogger<TicketAutoResolveQueue> logger)
{
    private const int Capacity = 1000;

    private readonly Channel<int> _channel = Channel.CreateBounded<int>(new BoundedChannelOptions(Capacity)
    {
        FullMode = BoundedChannelFullMode.DropWrite,
        SingleReader = true,
    });

    // Never blocks; returns false (and logs) when the queue is full.
    public bool Enqueue(int ticketId)
    {
        if (_channel.Writer.TryWrite(ticketId))
            return true;
        logger.LogWarning("Auto-resolve queue is full; ticket {TicketId} will not be auto-resolved.", ticketId);
        return false;
    }

    public IAsyncEnumerable<int> ReadAllAsync(CancellationToken cancellationToken) =>
        _channel.Reader.ReadAllAsync(cancellationToken);
}
