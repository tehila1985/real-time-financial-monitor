using Backend.Models;

namespace Backend.Storage;

/// <summary>
/// Thread-safe persistence of the latest N transactions. No business logic here —
/// see docs/DESIGN.md §7, §13. Kept as an interface (unlike TransactionService,
/// see §9) specifically so TransactionService's own unit tests can mock it to
/// isolate "processing" from "storage" correctness.
/// </summary>
public interface IStorage
{
    /// <summary>
    /// Stores the transaction. If <see cref="Transaction.TransactionId"/> already
    /// exists, it is overwritten with no special handling (no upsert semantics —
    /// see docs/DESIGN.md §10). Does not count as a new arrival for retention-cap
    /// eviction purposes in that case.
    /// </summary>
    void Add(Transaction transaction);

    /// <summary>
    /// A point-in-time copy of the currently retained transactions, ordered by
    /// <see cref="Transaction.Timestamp"/> descending (most recent first).
    /// </summary>
    IReadOnlyList<Transaction> GetSnapshot();
}
