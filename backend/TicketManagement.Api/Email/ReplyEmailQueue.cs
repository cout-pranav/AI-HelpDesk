using System.Threading.Channels;

namespace TicketManagement.Api.Email;

// In-memory hand-off of reply (TicketMessage) ids to ReplyEmailWorker, so saving a reply never waits
// on SendGrid. Nothing is lost if an id is dropped or the app stops: the reply stays Pending in the
// database, and the worker sends every Pending reply when it starts.
public class ReplyEmailQueue(ILogger<ReplyEmailQueue> logger)
{
    private const int Capacity = 1000;

    private readonly Channel<int> _channel = Channel.CreateBounded<int>(new BoundedChannelOptions(Capacity)
    {
        FullMode = BoundedChannelFullMode.DropWrite,
        SingleReader = true,
    });

    // Never blocks; returns false (and logs) when the queue is full.
    public bool Enqueue(int messageId)
    {
        if (_channel.Writer.TryWrite(messageId))
            return true;
        logger.LogWarning("Reply email queue is full; message {MessageId} will be sent after a restart.", messageId);
        return false;
    }

    public IAsyncEnumerable<int> ReadAllAsync(CancellationToken cancellationToken) =>
        _channel.Reader.ReadAllAsync(cancellationToken);
}
