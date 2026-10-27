using System.Threading.Channels;

namespace TicketManagement.Api.Ai;

// In-memory hand-off from request handlers to TicketClassificationWorker, so creating a ticket
// never waits on the AI call. Ids still queued when the app stops are lost (the ticket just
// stays uncategorized).
public class TicketClassificationQueue(ILogger<TicketClassificationQueue> logger)
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
        logger.LogWarning("Classification queue is full; ticket {TicketId} will not be auto-classified.", ticketId);
        return false;
    }

    public IAsyncEnumerable<int> ReadAllAsync(CancellationToken cancellationToken) =>
        _channel.Reader.ReadAllAsync(cancellationToken);
}
