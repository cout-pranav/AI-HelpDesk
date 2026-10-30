using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using TicketManagement.Api.Ai;
using TicketManagement.Api.Auth;
using SendGrid.Extensions.DependencyInjection;
using TicketManagement.Api.Data;
using TicketManagement.Api.Email;
using TicketManagement.Api.Endpoints;
using TicketManagement.Api.Models;

var builder = WebApplication.CreateBuilder(args);

// Error reporting: unhandled exceptions and LogError/LogCritical (including the background workers')
// go to Sentry. Options come from the "Sentry" section; the SDK refuses to start without a DSN, so
// it is only enabled when Sentry:Dsn (or SENTRY_DSN) is set, which keeps Testing/E2E runs out of it.
if (!string.IsNullOrEmpty(builder.Configuration["Sentry:Dsn"] ?? builder.Configuration["SENTRY_DSN"]))
    builder.WebHost.UseSentry();

// Add services to the container.

const string FrontendCorsPolicy = "FrontendCorsPolicy";

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

builder.Services.AddDbContext<TicketManagementDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("TicketManagementDb"),
        // Retries transient faults, e.g. Azure SQL failovers or a serverless database resuming.
        // Explicit transactions must then run inside db.Database.CreateExecutionStrategy().
        sql => sql.EnableRetryOnFailure()));

builder.Services.AddCors(options =>
{
    options.AddPolicy(FrontendCorsPolicy, policy =>
    {
        policy.WithOrigins(builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [])
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var jwtSection = builder.Configuration.GetSection(JwtOptions.SectionName);
builder.Services.Configure<JwtOptions>(jwtSection);
var jwtOptions = jwtSection.Get<JwtOptions>() ?? new JwtOptions();

builder.Services.AddScoped<TokenService>();
builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = jwtOptions.Issuer,
            ValidAudience = jwtOptions.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.SigningKey)),
            RoleClaimType = "role",
        };
    });
builder.Services.AddAuthorization();
builder.Services.AddLoginRateLimiting(enabled: builder.Environment.IsProduction());

// AI: IAiService runs over an IChatClient backed by Gemini. The client is built on first use, so
// a missing Gemini:ApiKey doesn't break startup; new tickets then skip AI processing and start Open.
builder.Services.Configure<GeminiOptions>(builder.Configuration.GetSection(GeminiOptions.SectionName));
builder.Services.AddChatClient(sp =>
    {
        var gemini = sp.GetRequiredService<IOptions<GeminiOptions>>().Value;
        return new Google.GenAI.Client(apiKey: gemini.ApiKey).AsIChatClient(gemini.Model);
    })
    .UseLogging();
builder.Services.AddScoped<IAiService, ChatAiService>();
builder.Services.AddSingleton<TicketClassificationQueue>();
builder.Services.AddHostedService<TicketClassificationWorker>();
builder.Services.AddSingleton<KnowledgeBase>();
builder.Services.AddSingleton<TicketAutoResolveQueue>();
builder.Services.AddHostedService<TicketAutoResolveWorker>();

// Outbound email: replies are emailed to the submitter by ReplyEmailWorker through SendGrid. The
// client is only resolved once SendGrid is configured, so a missing SendGrid:ApiKey doesn't break
// startup; replies are then stored without being emailed.
builder.Services.Configure<SendGridOptions>(builder.Configuration.GetSection(SendGridOptions.SectionName));
builder.Services.AddSendGrid((sp, options) =>
    options.ApiKey = sp.GetRequiredService<IOptions<SendGridOptions>>().Value.ApiKey);
builder.Services.AddSingleton<ReplyEmailQueue>();
builder.Services.AddHostedService<ReplyEmailWorker>();

var app = builder.Build();

// Applies migrations and seeds the admin user (if not already present) before serving requests.
await DbSeeder.SeedAsync(app.Services);

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

// The built frontend (wwwroot, copied in by the Dockerfile or a publish step) is served from the same origin as the
// API. Vite's hashed /assets files never change, so they're cached for good; everything else
// (index.html) is revalidated so a new deploy is picked up. Without a wwwroot (local dev, E2E)
// this does nothing and the frontend runs on the Vite dev server.
var frontendFileOptions = new StaticFileOptions
{
    OnPrepareResponse = ctx => ctx.Context.Response.Headers.CacheControl =
        ctx.Context.Request.Path.StartsWithSegments("/assets")
            ? "public, max-age=31536000, immutable"
            : "no-cache",
};
app.UseStaticFiles(frontendFileOptions);

app.UseCors(FrontendCorsPolicy);

app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));
app.MapAuthEndpoints();
app.MapUserEndpoints();
app.MapInboundEmailEndpoints();
app.MapTicketEndpoints();
app.MapDashboardEndpoints();

// Client-side routes (/tickets/42, /users, ...) get the SPA's index.html; unknown API paths stay 404
// instead of returning the page.
app.MapFallback("/api/{**path}", () => Results.NotFound());
app.MapFallbackToFile("index.html", frontendFileOptions);

app.Run();
