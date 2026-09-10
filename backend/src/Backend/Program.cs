using Backend.Health;
using Backend.Hubs;
using Backend.Services;
using Backend.Storage;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.RateLimiting;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);

// Storage + Service — Singleton: one shared instance across all requests in the
// process (see docs/DESIGN.md §9). TransactionService has no interface (§9) —
// its only consumer, TransactionsController, is integration-tested, not mocked.
//
// The 1000 default below is duplicated in two other places on purpose, not by
// accident (found in code review) — keep all three in sync if it ever changes:
//   - InMemoryTransactionStore's own constructor default (int retentionCap = 1000),
//     which only matters to tests that construct it directly with no argument;
//     production always passes this config-driven value explicitly.
//   - frontend/src/state/useTransactionFeed.ts's MAX_RETAINED_TRANSACTIONS,
//     which mirrors this so the client's own memory cap doesn't diverge from
//     what the server actually retains.
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

    // A dedicated, long-lived multiplexer for health reporting — separate from
    // whatever connection SignalR's own backplane manages internally (that one
    // isn't exposed via DI). Registered as a factory, not eagerly connected:
    // if Redis isn't reachable yet the first time `/health` resolves this
    // (e.g. compose/K8s startup ordering), the DI container simply retries the
    // factory on the next request rather than caching a failure.
    builder.Services.AddSingleton<IConnectionMultiplexer>(
        _ => ConnectionMultiplexer.Connect(redisConnectionString));
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
builder.Services.AddSwaggerGen(options =>
{
    // Surfaces the XML doc comments already written on the controller/models
    // (Backend.csproj's GenerateDocumentationFile) in the Swagger UI, instead
    // of Swashbuckle's default bare method/type names.
    var xmlFile = $"{System.Reflection.Assembly.GetExecutingAssembly().GetName().Name}.xml";
    options.IncludeXmlComments(Path.Combine(AppContext.BaseDirectory, xmlFile));
});

// Global error handling (§9): unhandled exceptions become a 500 ProblemDetails,
// no stack traces leaked. Malformed/incomplete request bodies never reach here —
// they are caught earlier by [ApiController]'s automatic-400 behavior (§10).
builder.Services.AddProblemDetails();

// Plain liveness by default (matches every environment without Redis
// configured — local `dotnet run`, the integration tests). When Redis *is*
// configured, `/health` also reports on the backplane's actual reachability
// (RedisHealthCheck, registered right above) — see docs/DESIGN.md §20 for why
// a K8s readiness probe needs to reflect this, not just process liveness.
var healthChecksBuilder = builder.Services.AddHealthChecks();
if (!string.IsNullOrWhiteSpace(redisConnectionString))
{
    // Tagged "ready", not left untagged — see the two MapHealthChecks calls
    // below for why liveness must NOT depend on this.
    healthChecksBuilder.AddCheck<RedisHealthCheck>("redis", tags: ["ready"]);
}

// Rate limiting on ingestion (docs/DESIGN.md §10): built into ASP.NET Core
// since .NET 7 (Microsoft.AspNetCore.RateLimiting), no NuGet package needed.
// A single global window, not partitioned per-client — see the decision box
// in DESIGN.md for why. PermitLimit is configurable specifically so the
// integration test can shrink it instead of firing 200+ real HTTP calls.
var rateLimitPermitLimit = builder.Configuration.GetValue("RateLimiting:PermitLimit", 200);
var rateLimitWindowSeconds = builder.Configuration.GetValue("RateLimiting:WindowSeconds", 10);
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = (context, cancellationToken) =>
    {
        context.HttpContext.Response.ContentType = "application/json";
        return new ValueTask(context.HttpContext.Response.WriteAsJsonAsync(
            new { message = "Too many requests. Please slow down and try again shortly." },
            cancellationToken));
    };
    options.AddFixedWindowLimiter("ingestion", limiterOptions =>
    {
        limiterOptions.PermitLimit = rateLimitPermitLimit;
        limiterOptions.Window = TimeSpan.FromSeconds(rateLimitWindowSeconds);
        limiterOptions.QueueLimit = 0; // reject immediately past the limit, never queue/delay a caller
    });
});

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

app.UseRateLimiter();

app.MapControllers();
app.MapHub<TransactionHub>("/hubs/transactions");

// Liveness ("is this process healthy enough that restarting it would help?")
// and readiness ("should this pod receive traffic right now?") are answered
// by deliberately different checks — restarting this pod does nothing to fix
// a Redis outage, so liveness must NOT depend on Redis (Predicate: false here
// means "run none of the registered checks", which is always Healthy). Only
// /health/ready — what K8s's readinessProbe uses (§19, §20) — includes the
// "ready"-tagged RedisHealthCheck. Conflating the two would turn a brief
// Redis blip into an unnecessary backend pod restart loop.
app.MapHealthChecks("/health", new HealthCheckOptions { Predicate = _ => false });
app.MapHealthChecks("/health/ready", new HealthCheckOptions { Predicate = check => check.Tags.Contains("ready") });

app.Run();

// Exposes the implicit Program class to WebApplicationFactory<Program> in
// Backend.Tests' integration tests (top-level statements otherwise generate an
// internal one).
public partial class Program;
