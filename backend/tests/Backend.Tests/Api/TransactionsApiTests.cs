using System.Net;
using System.Net.Http.Json;
using Backend.Models;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Backend.Tests.Api;

/// <summary>
/// Covers the API (integration) rows of docs/DESIGN.md §17 — the validation
/// pipeline and the POST→GET round trip, which only the real ASP.NET Core
/// request pipeline can exercise (a pure unit test can't observe model-binding
/// failures on a POCO). A fresh <see cref="WebApplicationFactory{TEntryPoint}"/>
/// per test gives each test its own in-memory storage — no cross-test state.
/// </summary>
public class TransactionsApiTests : IDisposable
{
    private readonly WebApplicationFactory<Program> _factory = new();
    private readonly HttpClient _client;

    public TransactionsApiTests()
    {
        _client = _factory.CreateClient();
    }

    private static Transaction MakeTransaction() => new()
    {
        TransactionId = Guid.NewGuid(),
        Amount = 100m,
        Currency = "USD",
        Status = TransactionStatus.Pending,
        Timestamp = DateTimeOffset.UtcNow,
    };

    [Fact]
    public async Task Post_ValidTransaction_Returns201AndIsVisibleInSubsequentGet()
    {
        var transaction = MakeTransaction();

        var postResponse = await _client.PostAsJsonAsync("/api/transactions", transaction);

        Assert.Equal(HttpStatusCode.Created, postResponse.StatusCode);
        var created = await postResponse.Content.ReadFromJsonAsync<Transaction>();
        Assert.Equal(transaction, created);

        var getResponse = await _client.GetAsync("/api/transactions");
        getResponse.EnsureSuccessStatusCode();
        var snapshot = await getResponse.Content.ReadFromJsonAsync<List<Transaction>>();
        Assert.Contains(transaction, snapshot!);
    }

    [Fact]
    public async Task Post_MissingRequiredField_Returns400()
    {
        // "amount" omitted entirely — proves `required` members catch a missing
        // *value-typed* field, which [Required] alone would have missed (§10).
        var payload = new
        {
            transactionId = Guid.NewGuid(),
            currency = "USD",
            status = "Pending",
            timestamp = DateTimeOffset.UtcNow,
        };

        var response = await _client.PostAsJsonAsync("/api/transactions", payload);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Post_InvalidStatusValue_Returns400()
    {
        var payload = new
        {
            transactionId = Guid.NewGuid(),
            amount = 100m,
            currency = "USD",
            status = "NotARealStatus",
            timestamp = DateTimeOffset.UtcNow,
        };

        var response = await _client.PostAsJsonAsync("/api/transactions", payload);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Get_WhenEmpty_Returns200WithEmptyArray()
    {
        var response = await _client.GetAsync("/api/transactions");

        response.EnsureSuccessStatusCode();
        var snapshot = await response.Content.ReadFromJsonAsync<List<Transaction>>();
        Assert.Empty(snapshot!);
    }

    [Fact]
    public async Task Post_ExceedsRateLimit_Returns429()
    {
        // Own factory, own (tiny) limit — firing 200+ real requests to hit the
        // production default would make this test slow and pointless; shrinking
        // the limit via config proves the same wiring with 4 requests instead.
        // A long window (60s) keeps the test from racing against the window
        // resetting mid-run.
        using var factory = _factory.WithWebHostBuilder(builder => builder
            .UseSetting("RateLimiting:PermitLimit", "3")
            .UseSetting("RateLimiting:WindowSeconds", "60"));
        using var client = factory.CreateClient();

        for (var i = 0; i < 3; i++)
        {
            var response = await client.PostAsJsonAsync("/api/transactions", MakeTransaction());
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        }

        var limited = await client.PostAsJsonAsync("/api/transactions", MakeTransaction());

        Assert.Equal(HttpStatusCode.TooManyRequests, limited.StatusCode);
    }

    [Fact]
    public async Task Get_IsNotRateLimited_EvenAfterPostExhaustsTheLimit()
    {
        // The limiter is applied to POST only (docs/DESIGN.md §10) — the
        // dashboard's snapshot load must never be blocked by ingestion traffic.
        using var factory = _factory.WithWebHostBuilder(builder => builder
            .UseSetting("RateLimiting:PermitLimit", "1")
            .UseSetting("RateLimiting:WindowSeconds", "60"));
        using var client = factory.CreateClient();

        await client.PostAsJsonAsync("/api/transactions", MakeTransaction());
        var secondPost = await client.PostAsJsonAsync("/api/transactions", MakeTransaction());
        Assert.Equal(HttpStatusCode.TooManyRequests, secondPost.StatusCode); // limit is exhausted...

        var getResponse = await client.GetAsync("/api/transactions"); // ...but GET is unaffected

        getResponse.EnsureSuccessStatusCode();
    }

    public void Dispose()
    {
        _client.Dispose();
        _factory.Dispose();
    }
}
