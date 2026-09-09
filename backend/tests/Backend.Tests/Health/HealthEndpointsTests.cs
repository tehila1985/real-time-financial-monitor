using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Backend.Tests.Health;

/// <summary>
/// Covers the actual wiring in Program.cs (the two `MapHealthChecks` calls,
/// the "ready" tag, the predicates) — <see cref="RedisHealthCheckTests"/>
/// only covers <see cref="Backend.Health.RedisHealthCheck"/> in isolation.
/// Found missing in code review: the exact bug this wiring exists to prevent
/// (liveness conflated with readiness) had no regression test at all before
/// this file — only a one-time manual `docker compose` verification.
/// </summary>
public class HealthEndpointsTests
{
    [Fact]
    public async Task LivenessStaysHealthy_WhileReadinessReflectsAnUnreachableRedis()
    {
        // A connection string that fails fast (nothing listens on this port)
        // rather than hanging for StackExchange.Redis's default 5s connect
        // timeout — keeps this test quick without changing production defaults.
        await using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder => builder
                .UseSetting("Redis:ConnectionString", "localhost:1,connectTimeout=200,abortConnect=false"));
        using var client = factory.CreateClient();

        var liveness = await client.GetAsync("/health");
        var readiness = await client.GetAsync("/health/ready");

        Assert.Equal(HttpStatusCode.OK, liveness.StatusCode);
        Assert.Equal(HttpStatusCode.ServiceUnavailable, readiness.StatusCode);
    }

    [Fact]
    public async Task BothEndpoints_AreHealthy_WhenRedisIsNotConfiguredAtAll()
    {
        // The default for local `dotnet run` and every other integration test
        // in this suite (no Redis:ConnectionString set at all) — readiness
        // must not silently start failing for a dependency that was never
        // configured in the first place.
        await using var factory = new WebApplicationFactory<Program>();
        using var client = factory.CreateClient();

        var liveness = await client.GetAsync("/health");
        var readiness = await client.GetAsync("/health/ready");

        Assert.Equal(HttpStatusCode.OK, liveness.StatusCode);
        Assert.Equal(HttpStatusCode.OK, readiness.StatusCode);
    }
}
