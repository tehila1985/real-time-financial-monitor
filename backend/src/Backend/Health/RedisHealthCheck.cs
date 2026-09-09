using Microsoft.Extensions.Diagnostics.HealthChecks;
using StackExchange.Redis;

namespace Backend.Health;

/// <summary>
/// Verifies the SignalR Redis backplane (ADR 0001) is actually reachable —
/// registered only when Redis is configured (docker-compose/K8s; see
/// Program.cs). Without this, `/health` only proves the process is alive, not
/// that this pod can still synchronize broadcasts with its peers — a K8s
/// readiness probe relying on the trivial default check would keep routing
/// traffic to a pod that's silently back to the exact single-pod-isolated
/// behavior this backplane exists to fix (see the ADR's Problem section).
/// </summary>
public sealed class RedisHealthCheck : IHealthCheck
{
    private readonly IConnectionMultiplexer _connectionMultiplexer;

    public RedisHealthCheck(IConnectionMultiplexer connectionMultiplexer)
    {
        _connectionMultiplexer = connectionMultiplexer;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var latency = await _connectionMultiplexer.GetDatabase().PingAsync();
            return HealthCheckResult.Healthy($"Redis responded in {latency.TotalMilliseconds:F0}ms");
        }
        catch (Exception ex)
        {
            // Any failure (timeout, connection refused, auth) — Unhealthy, not
            // a thrown exception: a probe should get a status, not a crash.
            return HealthCheckResult.Unhealthy("Redis backplane unreachable", ex);
        }
    }
}
