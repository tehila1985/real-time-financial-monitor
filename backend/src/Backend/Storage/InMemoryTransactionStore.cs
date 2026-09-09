using Backend.Models;

namespace Backend.Storage;

/// <summary>
/// See docs/DESIGN.md §12.1–§12.2 and §13 for the full reasoning behind every
/// decision in this class:
///  - a single coarse `lock` around a compound structure, not `ConcurrentDictionary`
///    + a separate concurrent queue (composing two independently thread-safe
///    collections does not make their combination atomic);
///  - a `Queue&lt;Guid&gt;` tracks arrival order for FIFO eviction only — it is never
///    touched on an update to an existing id, only on a genuinely new one;
///  - `GetSnapshot` takes a materialized copy inside the lock and sorts by
///    `Timestamp` at read time, deliberately decoupled from arrival order.
/// </summary>
public sealed class InMemoryTransactionStore : IStorage
{
    private readonly object _lock = new();
    private readonly Dictionary<Guid, Transaction> _byId = new();
    private readonly Queue<Guid> _arrivalOrder = new();
    private readonly int _cap;

    public InMemoryTransactionStore(int retentionCap = 1000)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(retentionCap);
        _cap = retentionCap;
    }

    public void Add(Transaction transaction)
    {
        lock (_lock)
        {
            var isNewArrival = !_byId.ContainsKey(transaction.TransactionId);
            _byId[transaction.TransactionId] = transaction; // whole-object replace, no partial mutation

            if (isNewArrival)
            {
                _arrivalOrder.Enqueue(transaction.TransactionId);
                if (_arrivalOrder.Count > _cap)
                {
                    var evictedId = _arrivalOrder.Dequeue();
                    _byId.Remove(evictedId);
                }
            }
        }
    }

    public IReadOnlyList<Transaction> GetSnapshot()
    {
        // Only the O(n) copy needs the lock; sorting is read-only work on our
        // own private copy and must not hold up Add() (every POST) while it runs.
        List<Transaction> copy;
        lock (_lock)
        {
            copy = new List<Transaction>(_byId.Values);
        }

        // `List<T>.Sort` is explicitly documented as unstable (introsort) — two
        // transactions with the exact same Timestamp (plausible under a burst,
        // §16) could swap relative order between calls with no data change at
        // all. `OrderByDescending` is a stable sort, so ties keep a consistent
        // relative order instead of visibly shuffling on the dashboard.
        return copy.OrderByDescending(t => t.Timestamp).ToList();
    }
}
