using Backend.Hubs;
using Backend.Services;
using Backend.Storage;

var builder = WebApplication.CreateBuilder(args);

// Storage + Service — Singleton: one shared instance across all requests in the
// process (see docs/DESIGN.md §9). TransactionService has no interface (§9) —
// its only consumer, TransactionsController, is integration-tested, not mocked.
var retentionCap = builder.Configuration.GetValue("Storage:RetentionCap", 1000);
builder.Services.AddSingleton<IStorage>(new InMemoryTransactionStore(retentionCap));
builder.Services.AddSingleton<TransactionService>();

builder.Services.AddControllers();

// Redis backplane (ADR 0001, docs/DESIGN.md §20): only wired when a connection
// string is actually configured. This is not just a convenience — without it,
// `dotnet run` locally and the WebApplicationFactory-based integration tests
// (§17) would require a real Redis instance just to boot the app at all, for
// a sync problem that doesn't exist with a single instance.
var redisConnectionString = builder.Configuration["Redis:ConnectionString"];
var signalRBuilder = builder.Services.AddSignalR();
if (!string.IsNullOrWhiteSpace(redisConnectionString))
{
    signalRBuilder.AddStackExchangeRedis(redisConnectionString);
}

// CORS: local-dev-only concern (§18) — in production the frontend's nginx
// reverse-proxies /api and /hubs, so there are no cross-origin requests to
// configure at all, and no origin is set in the K8s deployment (§19). This
// policy simply matches nothing (harmless) when no origin is configured.
var corsOrigin = builder.Configuration["Cors:AllowedOrigin"];
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        if (!string.IsNullOrWhiteSpace(corsOrigin))
        {
            policy.WithOrigins(corsOrigin)
                .AllowAnyHeader()
                .AllowAnyMethod()
                .AllowCredentials(); // required for SignalR's WebSocket handshake cross-origin
        }
    });
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Global error handling (§9): unhandled exceptions become a 500 ProblemDetails,
// no stack traces leaked. Malformed/incomplete request bodies never reach here —
// they are caught earlier by [ApiController]'s automatic-400 behavior (§10).
builder.Services.AddProblemDetails();

builder.Services.AddHealthChecks();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseExceptionHandler();

// No UseHttpsRedirection(): TLS termination isn't configured anywhere in this
// stack (nginx is the public-facing side per §18; this backend is internal-only
// in docker-compose/K8s). Left in, it would fail its HTTPS-port lookup and log
// a warning on every single request, for a redirect that can never happen.

app.UseCors();

app.UseAuthorization();

app.MapControllers();
app.MapHub<TransactionHub>("/hubs/transactions");
app.MapHealthChecks("/health");

app.Run();

// Exposes the implicit Program class to WebApplicationFactory<Program> in
// Backend.Tests' integration tests (top-level statements otherwise generate an
// internal one).
public partial class Program;
