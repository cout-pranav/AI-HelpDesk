namespace TicketManagement.Api.Ai;

// The support knowledge base the AI answers tickets from: a Markdown file at KnowledgeBase:Path
// (default knowledge-base.md), relative to the content root. Read once on first use and cached, so
// edits take effect after a restart.
public class KnowledgeBase(IConfiguration config, IHostEnvironment environment, ILogger<KnowledgeBase> logger)
{
    private const string PathConfigKey = "KnowledgeBase:Path";
    private const string DefaultPath = "knowledge-base.md";

    private readonly Lazy<string?> _content = new(() => Load(config, environment, logger));

    // Null when the file is missing or empty; tickets are then left for agents.
    public string? Content => _content.Value;

    private static string? Load(IConfiguration config, IHostEnvironment environment, ILogger logger)
    {
        var path = Path.Combine(environment.ContentRootPath, config[PathConfigKey] ?? DefaultPath);
        if (!File.Exists(path))
        {
            logger.LogWarning("Knowledge base file {Path} not found; tickets will not be auto-resolved.", path);
            return null;
        }

        var content = File.ReadAllText(path).Trim();
        if (content.Length == 0)
        {
            logger.LogWarning("Knowledge base file {Path} is empty; tickets will not be auto-resolved.", path);
            return null;
        }
        return content;
    }
}
