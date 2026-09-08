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
    /// <summary>
    /// The single broadcast event name — see docs/DESIGN.md §10 for why there is
    /// no separate "Updated" event (no upsert semantics).
    /// </summary>
    public const string TransactionReceivedEvent = "TransactionReceived";

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

        try
        {
            await _hubContext.Clients.All.SendAsync(TransactionReceivedEvent, transaction);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Broadcast failed for transaction {TransactionId}; the write already succeeded and it will still appear on the next snapshot fetch.",
                transaction.TransactionId);
        }
    }
}
