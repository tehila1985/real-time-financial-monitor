using Backend.Models;
using Backend.Storage;

namespace Backend.Tests.Storage;

/// <summary>
/// Covers the Storage rows of the test matrix in docs/DESIGN.md §17, including
/// the concurrency invariants designed in §12.1/§12.2. These assert invariants
/// (counts, "no exception", "no duplicate ids") rather than exact interleaving
/// order, which is what keeps them deterministic despite exercising real
/// concurrency via Parallel.ForEach/Parallel.Invoke.
/// </summary>
public class InMemoryTransactionStoreTests
{
    private static Transaction MakeTransaction(
        Guid? id = null,
        DateTimeOffset? timestamp = null,
        TransactionStatus status = TransactionStatus.Pending,
        decimal amount = 100m,
        string currency = "USD") => new()
        {
            TransactionId = id ?? Guid.NewGuid(),
            Amount = amount,
            Currency = currency,
            Status = status,
            Timestamp = timestamp ?? DateTimeOffset.UtcNow,
        };

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Constructor_NonPositiveRetentionCap_Throws(int invalidCap)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => new InMemoryTransactionStore(invalidCap));
    }

    [Fact]
    public void Add_ThenSnapshot_TransactionIsRetrievable()
    {
        var store = new InMemoryTransactionStore();
        var transaction = MakeTransaction();

        store.Add(transaction);

        Assert.Contains(transaction, store.GetSnapshot());
    }

    [Fact]
    public void GetSnapshot_WhenEmpty_ReturnsEmptyList()
    {
        var store = new InMemoryTransactionStore();

        Assert.Empty(store.GetSnapshot());
    }

    [Fact]
    public void GetSnapshot_OrdersByTimestampDescending()
    {
        var store = new InMemoryTransactionStore();
        var now = DateTimeOffset.UtcNow;
        var older = MakeTransaction(timestamp: now.AddMinutes(-5));
        var newer = MakeTransaction(timestamp: now);

        // Added oldest-first, deliberately, to prove ordering is by Timestamp
        // (read-time), not by insertion/arrival order.
        store.Add(older);
        store.Add(newer);

        Assert.Equal(new[] { newer, older }, store.GetSnapshot());
    }

    [Fact]
    public void Add_BeyondRetentionCap_EvictsOldestByArrivalOrder()
    {
        var store = new InMemoryTransactionStore(retentionCap: 2);
        var first = MakeTransaction();
        var second = MakeTransaction();
        var third = MakeTransaction();

        store.Add(first);
        store.Add(second);
        store.Add(third);

        var snapshot = store.GetSnapshot();
        Assert.Equal(2, snapshot.Count);
        Assert.DoesNotContain(first, snapshot);
        Assert.Contains(second, snapshot);
        Assert.Contains(third, snapshot);
    }

    [Fact]
    public void Add_SameIdTwice_OverwritesAndDoesNotCountAsANewArrival()
    {
        // Locks in the §13 decision: updating an existing id is not a "new
        // arrival" for retention-cap purposes, so it must not consume another
        // eviction slot.
        var store = new InMemoryTransactionStore(retentionCap: 2);
        var id = Guid.NewGuid();
        var first = MakeTransaction(id: id, status: TransactionStatus.Pending);
        var updated = first with { Status = TransactionStatus.Completed };
        var other = MakeTransaction();

        store.Add(first);
        store.Add(updated);
        store.Add(other);

        var snapshot = store.GetSnapshot();
        Assert.Equal(2, snapshot.Count);
        Assert.Contains(updated, snapshot);
        Assert.Contains(other, snapshot);
    }

    [Fact]
    public void Add_ManyConcurrentDistinctIds_CountEqualsCapWithNoDuplicates()
    {
        const int cap = 100;
        const int total = 500;
        var store = new InMemoryTransactionStore(retentionCap: cap);
        var transactions = Enumerable.Range(0, total).Select(_ => MakeTransaction()).ToList();

        Parallel.ForEach(transactions, tx => store.Add(tx));

        var snapshot = store.GetSnapshot();
        Assert.Equal(cap, snapshot.Count);
        Assert.Equal(snapshot.Count, snapshot.Select(t => t.TransactionId).Distinct().Count());
    }

    [Fact]
    public void Add_SameIdConcurrently_NoExceptionAndFinalValueIsOneOfTheWrittenOnes()
    {
        var store = new InMemoryTransactionStore();
        var id = Guid.NewGuid();
        var candidates = Enumerable.Range(0, 50)
            .Select(i => MakeTransaction(id: id, amount: i))
            .ToList();

        var exception = Record.Exception(() => Parallel.ForEach(candidates, tx => store.Add(tx)));

        Assert.Null(exception);
        var snapshot = store.GetSnapshot();
        var stored = Assert.Single(snapshot);
        Assert.Contains(stored, candidates);
    }

    [Fact]
    public void AddAndGetSnapshot_Concurrently_NeverThrowsAndEverySnapshotIsConsistent()
    {
        var store = new InMemoryTransactionStore(retentionCap: 200);

        var writers = Enumerable.Range(0, 300)
            .Select(_ => (Action)(() => store.Add(MakeTransaction())));

        var readers = Enumerable.Range(0, 50)
            .Select(_ => (Action)(() =>
            {
                var snapshot = store.GetSnapshot();
                // "internally consistent" = no duplicate ids within one snapshot,
                // and it never exceeds the cap even mid-flight.
                Assert.True(snapshot.Count <= 200);
                Assert.Equal(snapshot.Count, snapshot.Select(t => t.TransactionId).Distinct().Count());
            }));

        var exception = Record.Exception(() => Parallel.Invoke(writers.Concat(readers).ToArray()));

        Assert.Null(exception);
    }
}
