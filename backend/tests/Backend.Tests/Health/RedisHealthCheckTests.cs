using Backend.Health;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Moq;
using StackExchange.Redis;

namespace Backend.Tests.Health;

/// <summary>
/// <see cref="IConnectionMultiplexer"/> and <see cref="IDatabase"/> are both
/// interfaces, so the actual network call never happens here — this tests the
/// health check's own logic (map a successful ping to Healthy, any exception
/// to Unhealthy), not StackExchange.Redis itself.
/// </summary>
public class RedisHealthCheckTests
{
    [Fact]
    public async Task CheckHealthAsync_PingSucceeds_ReturnsHealthy()
    {
        var database = new Mock<IDatabase>();
        database.Setup(d => d.PingAsync(It.IsAny<CommandFlags>())).ReturnsAsync(TimeSpan.FromMilliseconds(5));

        var multiplexer = new Mock<IConnectionMultiplexer>();
        multiplexer.Setup(m => m.GetDatabase(It.IsAny<int>(), It.IsAny<object>())).Returns(database.Object);

        var check = new RedisHealthCheck(multiplexer.Object);

        var result = await check.CheckHealthAsync(new HealthCheckContext());

        Assert.Equal(HealthStatus.Healthy, result.Status);
    }

    [Fact]
    public async Task CheckHealthAsync_PingThrows_ReturnsUnhealthyNotAnException()
    {
        var multiplexer = new Mock<IConnectionMultiplexer>();
        multiplexer
            .Setup(m => m.GetDatabase(It.IsAny<int>(), It.IsAny<object>()))
            .Throws(new RedisConnectionException(ConnectionFailureType.UnableToConnect, "simulated"));

        var check = new RedisHealthCheck(multiplexer.Object);

        var result = await check.CheckHealthAsync(new HealthCheckContext());

        Assert.Equal(HealthStatus.Unhealthy, result.Status);
    }
}
