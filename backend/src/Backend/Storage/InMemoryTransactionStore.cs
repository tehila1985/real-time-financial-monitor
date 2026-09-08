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
        if (retentionCap <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(retentionCap), retentionCap, "Retention cap must be positive.");
        }

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
        lock (_lock)
        {
            return _byId.Values.OrderByDescending(t => t.Timestamp).ToList();
        }
    }
}
