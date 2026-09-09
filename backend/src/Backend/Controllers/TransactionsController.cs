using Backend.Models;
using Backend.Services;
using Backend.Storage;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Backend.Controllers;

/// <summary>
/// HTTP concerns only — routing, status codes, model binding. No business logic,
/// no direct storage mutation, no broadcasting — see docs/DESIGN.md §7, §10.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public sealed class TransactionsController : ControllerBase
{
    private readonly TransactionService _transactionService;
    private readonly IStorage _storage;

    public TransactionsController(TransactionService transactionService, IStorage storage)
    {
        _transactionService = transactionService;
        _storage = storage;
    }

    /// <summary>
    /// Ingests a transaction. Always 201 — a repeated
    /// <see cref="Transaction.TransactionId"/> simply overwrites the stored
    /// entry (see docs/DESIGN.md §10). Schema-level validation (required
    /// fields, correct types) happens automatically via model binding before this
    /// action even runs — see <see cref="Transaction"/>'s `required` members.
    /// Rate-limited (429 past the configured window) — not the GET snapshot,
    /// only this endpoint accepts data from outside the system. See
    /// docs/DESIGN.md §10 for why the default limit sits well above the
    /// 100-transaction burst NFR rather than colliding with it.
    /// </summary>
    [HttpPost]
    [EnableRateLimiting("ingestion")]
    [ProducesResponseType(typeof(Transaction), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<Transaction>> Post([FromBody] Transaction transaction)
    {
        await _transactionService.ProcessAsync(transaction);
        return StatusCode(StatusCodes.Status201Created, transaction);
    }

    /// <summary>
    /// Transitions an existing transaction's status — e.g. Pending → Completed.
    /// See docs/DESIGN.md §10. A dedicated sub-resource endpoint (`PUT
    /// .../{id}/status`), not a second full-body PUT on the transaction itself:
    /// a status change is the only lifecycle transition this system models, so
    /// the endpoint's shape says exactly that, and the caller never has to
    /// resend the immutable fields (amount, currency, timestamp) just to
    /// change one. 404 if <paramref name="transactionId"/> doesn't exist —
    /// unlike POST, this method requires the transaction to already be there.
    /// </summary>
    [HttpPut("{transactionId:guid}/status")]
    [ProducesResponseType(typeof(Transaction), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<Transaction>> UpdateStatus(
        [FromRoute] Guid transactionId,
        [FromBody] UpdateTransactionStatusRequest request)
    {
        var updated = await _transactionService.UpdateStatusAsync(transactionId, request.Status);
        return updated is null ? NotFound() : Ok(updated);
    }

    /// <summary>
    /// Snapshot of currently retained transactions for <c>/monitor</c>'s initial
    /// load — see docs/DESIGN.md §10 for why this exists despite the spec only
    /// literally describing live updates. Reads directly from storage; no
    /// orchestration needed for a plain read.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<Transaction>), StatusCodes.Status200OK)]
    public ActionResult<IReadOnlyList<Transaction>> Get()
    {
        return Ok(_storage.GetSnapshot());
    }
}
