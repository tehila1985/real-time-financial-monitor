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

    public TransactionService(IStorage storage, IHubContext<TransactionHub> hubContext)
    {
        _storage = storage;
        _hubContext = hubContext;
    }

    /// <summary>
    /// Stores the transaction (synchronous, lock released — §12.1) and then
    /// broadcasts it (async I/O, always after the storage write — §12.4, so the
    /// storage lock is never held across an <c>await</c>).
    /// </summary>
    public async Task ProcessAsync(Transaction transaction)
    {
        _storage.Add(transaction);
        await _hubContext.Clients.All.SendAsync(TransactionReceivedEvent, transaction);
    }
}
