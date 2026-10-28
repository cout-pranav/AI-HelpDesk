namespace TicketManagement.Api.Ai;

public class GeminiOptions
{
    public const string SectionName = "Gemini";

    // Secret: dotnet user-secrets (Gemini:ApiKey) in Development, Gemini__ApiKey elsewhere.
    // When empty, AI features are skipped: new tickets start Open and stay uncategorized.
    public string ApiKey { get; set; } = string.Empty;
    public string Model { get; set; } = "gemini-3.5-flash";
}
