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
    /// exists, it is overwritten with no special handling. Does not count as a
    /// new arrival for retention-cap eviction purposes in that case.
    /// </summary>
    void Add(Transaction transaction);

    /// <summary>
    /// Updates only the <see cref="Transaction.Status"/> of an existing
    /// transaction — see docs/DESIGN.md §10. Returns the updated transaction,
    /// or <c>null</c> if <paramref name="transactionId"/> doesn't exist (a
    /// distinct outcome from <see cref="Add"/>, which always succeeds by
    /// design: this method models an explicit status-lifecycle transition on
    /// a transaction that must already exist, not a fire-and-forget write).
    /// </summary>
    Transaction? UpdateStatus(Guid transactionId, TransactionStatus newStatus);

    /// <summary>
    /// A point-in-time copy of the currently retained transactions, ordered by
    /// <see cref="Transaction.Timestamp"/> descending (most recent first).
    /// </summary>
    IReadOnlyList<Transaction> GetSnapshot();
}
