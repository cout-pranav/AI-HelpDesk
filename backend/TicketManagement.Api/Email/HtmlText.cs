using System.Net;
using System.Text.RegularExpressions;

namespace TicketManagement.Api.Email;

// Turns an HTML email body into readable plain text. Not a full HTML parser: it keeps line
// breaks from block elements, drops everything else, and decodes entities. The result is
// stored as text only, so no sender HTML ever reaches the UI.
public static partial class HtmlText
{
    public static string ToPlainText(string html)
    {
        var text = NonContentBlocks().Replace(html, string.Empty);
        text = Comments().Replace(text, string.Empty);
        text = LineBreaks().Replace(text, "\n");
        text = ListItems().Replace(text, "\n- ");
        text = BlockEnds().Replace(text, "\n");
        text = Tags().Replace(text, string.Empty);
        text = WebUtility.HtmlDecode(text).Replace(' ', ' ');
        return Normalize(text);
    }

    // Unifies line endings, trims trailing spaces per line, and collapses runs of blank lines.
    public static string Normalize(string text)
    {
        var lines = text.Replace("\r\n", "\n").Replace('\r', '\n').Split('\n').Select(l => l.TrimEnd());
        return ExtraBlankLines().Replace(string.Join('\n', lines), "\n\n").Trim();
    }

    [GeneratedRegex(@"<(script|style|head|title)\b[^>]*>.*?</\1\s*>", RegexOptions.IgnoreCase | RegexOptions.Singleline, 1000)]
    private static partial Regex NonContentBlocks();

    [GeneratedRegex(@"<!--.*?-->", RegexOptions.Singleline, 1000)]
    private static partial Regex Comments();

    [GeneratedRegex(@"<br\s*/?>", RegexOptions.IgnoreCase, 1000)]
    private static partial Regex LineBreaks();

    [GeneratedRegex(@"<li\b[^>]*>", RegexOptions.IgnoreCase, 1000)]
    private static partial Regex ListItems();

    [GeneratedRegex(@"</(p|div|tr|h[1-6]|ul|ol|blockquote|table)\s*>", RegexOptions.IgnoreCase, 1000)]
    private static partial Regex BlockEnds();

    [GeneratedRegex(@"<[^>]*>", RegexOptions.None, 1000)]
    private static partial Regex Tags();

    [GeneratedRegex(@"\n{3,}", RegexOptions.None, 1000)]
    private static partial Regex ExtraBlankLines();
}
