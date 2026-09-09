using Backend.Models;
using Backend.Storage;
using Backend.Tests.TestSupport;

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
        var transaction = TransactionFactory.Create();

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
        var older = TransactionFactory.Create(timestamp: now.AddMinutes(-5));
        var newer = TransactionFactory.Create(timestamp: now);

        // Added oldest-first, deliberately, to prove ordering is by Timestamp
        // (read-time), not by insertion/arrival order.
        store.Add(older);
        store.Add(newer);

        Assert.Equal(new[] { newer, older }, store.GetSnapshot());
    }

    [Fact]
    public void GetSnapshot_WithTiedTimestamps_OrderIsStableAcrossRepeatedCalls()
    {
        // Regression test (found in code review): List<T>.Sort is documented
        // as unstable — with identical Timestamps, repeated GetSnapshot() calls
        // could return a different relative order with no underlying data
        // change at all. Same Timestamp instance for both, to make the tie exact.
        var store = new InMemoryTransactionStore();
        var tiedTimestamp = DateTimeOffset.UtcNow;
        var first = TransactionFactory.Create(timestamp: tiedTimestamp);
        var second = TransactionFactory.Create(timestamp: tiedTimestamp);

        store.Add(first);
        store.Add(second);

        var firstCall = store.GetSnapshot();
        var secondCall = store.GetSnapshot();

        Assert.Equal(firstCall, secondCall);
    }

    [Fact]
    public void Add_BeyondRetentionCap_EvictsOldestByArrivalOrder()
    {
        var store = new InMemoryTransactionStore(retentionCap: 2);
        var first = TransactionFactory.Create();
        var second = TransactionFactory.Create();
        var third = TransactionFactory.Create();

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
        var first = TransactionFactory.Create(id: id, status: TransactionStatus.Pending);
        var updated = first with { Status = TransactionStatus.Completed };
        var other = TransactionFactory.Create();

        store.Add(first);
        store.Add(updated);
        store.Add(other);

        var snapshot = store.GetSnapshot();
        Assert.Equal(2, snapshot.Count);
        Assert.Contains(updated, snapshot);
        Assert.Contains(other, snapshot);
    }

    [Fact]
    public void UpdateStatus_ExistingId_ReturnsUpdatedTransactionAndReplacesItInTheStore()
    {
        var store = new InMemoryTransactionStore();
        var original = TransactionFactory.Create(status: TransactionStatus.Pending);
        store.Add(original);

        var updated = store.UpdateStatus(original.TransactionId, TransactionStatus.Completed);

        Assert.NotNull(updated);
        Assert.Equal(TransactionStatus.Completed, updated!.Status);
        Assert.Equal(original.TransactionId, updated.TransactionId);
        Assert.Equal(original.Amount, updated.Amount); // only Status changes, nothing else
        var snapshot = store.GetSnapshot();
        Assert.DoesNotContain(original, snapshot); // the old (Pending) record is gone...
        Assert.Contains(updated, snapshot); // ...replaced in place by the new one
    }

    [Fact]
    public void UpdateStatus_UnknownId_ReturnsNullAndChangesNothing()
    {
        var store = new InMemoryTransactionStore();
        var existing = TransactionFactory.Create();
        store.Add(existing);

        var result = store.UpdateStatus(Guid.NewGuid(), TransactionStatus.Failed);

        Assert.Null(result);
        Assert.Single(store.GetSnapshot()); // unrelated existing data untouched
    }

    [Fact]
    public void UpdateStatus_DoesNotConsumeARetentionCapSlot()
    {
        // Same invariant as Add_SameIdTwice_OverwritesAndDoesNotCountAsANewArrival:
        // updating status is not a "new arrival" for eviction purposes.
        var store = new InMemoryTransactionStore(retentionCap: 2);
        var first = TransactionFactory.Create(status: TransactionStatus.Pending);
        var second = TransactionFactory.Create();
        store.Add(first);
        store.Add(second);

        store.UpdateStatus(first.TransactionId, TransactionStatus.Completed);
        store.Add(TransactionFactory.Create()); // a genuinely new arrival, third overall

        var snapshot = store.GetSnapshot();
        Assert.Equal(2, snapshot.Count); // still at cap, not exceeded
        Assert.DoesNotContain(snapshot, t => t.TransactionId == first.TransactionId); // evicted by the real 3rd arrival, not by the update
    }

    [Fact]
    public void UpdateStatus_ConcurrentlyWithAdd_NoExceptionAndSnapshotStaysConsistent()
    {
        var store = new InMemoryTransactionStore(retentionCap: 200);
        var target = TransactionFactory.Create(status: TransactionStatus.Pending);
        store.Add(target);

        var writers = Enumerable.Range(0, 100)
            .Select(_ => (Action)(() => store.Add(TransactionFactory.Create())));
        var updaters = Enumerable.Range(0, 100)
            .Select(i => (Action)(() => store.UpdateStatus(
                target.TransactionId,
                i % 2 == 0 ? TransactionStatus.Completed : TransactionStatus.Failed)));

        var exception = Record.Exception(() => Parallel.Invoke(writers.Concat(updaters).ToArray()));

        Assert.Null(exception);
        var snapshot = store.GetSnapshot();
        Assert.Equal(snapshot.Count, snapshot.Select(t => t.TransactionId).Distinct().Count()); // no duplicates
        var finalTarget = snapshot.Single(t => t.TransactionId == target.TransactionId);
        Assert.True(finalTarget.Status is TransactionStatus.Completed or TransactionStatus.Failed); // one of the written values, not a torn mix
    }

    [Fact]
    public void Add_ManyConcurrentDistinctIds_CountEqualsCapWithNoDuplicates()
    {
        const int cap = 100;
        const int total = 500;
        var store = new InMemoryTransactionStore(retentionCap: cap);
        var transactions = Enumerable.Range(0, total).Select(_ => TransactionFactory.Create()).ToList();

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
            .Select(i => TransactionFactory.Create(id: id, amount: i))
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
            .Select(_ => (Action)(() => store.Add(TransactionFactory.Create())));

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
