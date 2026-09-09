using Backend.Hubs;
using Backend.Models;
using Backend.Storage;
using Microsoft.AspNetCore.SignalR;

namespace Backend.Services;

/// <summary>
/// Orchestrates ingestion: store, then broadcast. See docs/DESIGN.md §9 for why
/// this is a concrete class (no interface) — its only consumer,
/// <c>TransactionsController</c>, is exercised via integration tests, not mocked.
/// </summary>
public sealed class TransactionService
{
    /// <summary>Broadcast when a new transaction is ingested — see docs/DESIGN.md §10.</summary>
    public const string TransactionReceivedEvent = "TransactionReceived";

    /// <summary>
    /// Broadcast when an existing transaction's status changes — kept distinct
    /// from <see cref="TransactionReceivedEvent"/> so a client can tell "a new
    /// row arrived" from "an existing row changed" without inspecting payload
    /// state itself, even though both currently drive the same merge-by-id
    /// logic on the frontend (docs/DESIGN.md §10).
    /// </summary>
    public const string TransactionUpdatedEvent = "TransactionUpdated";

    private readonly IStorage _storage;
    private readonly IHubContext<TransactionHub> _hubContext;
    private readonly ILogger<TransactionService> _logger;

    public TransactionService(IStorage storage, IHubContext<TransactionHub> hubContext, ILogger<TransactionService> logger)
    {
        _storage = storage;
        _hubContext = hubContext;
        _logger = logger;
    }

    /// <summary>
    /// Stores the transaction (synchronous, lock released — §12.1) and then
    /// broadcasts it (async I/O, always after the storage write — §12.4, so the
    /// storage lock is never held across an <c>await</c>).
    ///
    /// A broadcast failure does NOT fail this call: the storage write is the
    /// durability contract, broadcasting is best-effort real-time UX on top of
    /// it. Letting a transient SignalR/Redis error turn an already-persisted
    /// write into an HTTP 500 would tell the caller "not saved" when it was —
    /// a false failure a retrying caller could act on incorrectly. The
    /// transaction still surfaces on the next GET /api/transactions either way.
    /// </summary>
    public async Task ProcessAsync(Transaction transaction)
    {
        _storage.Add(transaction);
        await BroadcastAsync(TransactionReceivedEvent, transaction);
    }

    /// <summary>
    /// Transitions an existing transaction to a new <see cref="TransactionStatus"/>
    /// — see docs/DESIGN.md §10. Returns <c>null</c> without broadcasting
    /// anything if <paramref name="transactionId"/> doesn't exist; the
    /// Controller turns that into a 404, distinct from <see cref="ProcessAsync"/>,
    /// which always succeeds.
    /// </summary>
    public async Task<Transaction?> UpdateStatusAsync(Guid transactionId, TransactionStatus newStatus)
    {
        var updated = _storage.UpdateStatus(transactionId, newStatus);
        if (updated is null)
        {
            return null;
        }

        await BroadcastAsync(TransactionUpdatedEvent, updated);
        return updated;
    }

    /// <summary>
    /// Shared best-effort broadcast: the storage write is the durability
    /// contract, broadcasting is best-effort real-time UX on top of it.
    /// Letting a transient SignalR/Redis error turn an already-persisted
    /// write into an HTTP 500 would tell the caller "not saved" when it was —
    /// a false failure a retrying caller could act on incorrectly. The
    /// transaction still surfaces on the next GET /api/transactions either way.
    /// </summary>
    private async Task BroadcastAsync(string eventName, Transaction transaction)
    {
        try
        {
            await _hubContext.Clients.All.SendAsync(eventName, transaction);
        }
        // Excludes OperationCanceledException (found in code review): a
        // graceful shutdown cancelling an in-flight broadcast is expected,
        // normal behavior, not a broadcast failure — logging it as a Warning
        // would misrepresent a clean shutdown as something having gone wrong.
        // Letting it propagate here matches how the rest of ASP.NET Core
        // treats cancellation during shutdown.
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(
                ex,
                "Broadcast of {EventName} failed for transaction {TransactionId}; the write already succeeded and it will still appear on the next snapshot fetch.",
                eventName,
                transaction.TransactionId);
        }
    }
}
