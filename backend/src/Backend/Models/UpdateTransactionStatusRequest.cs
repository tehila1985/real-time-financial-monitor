namespace Backend.Models;

/// <summary>
/// Body for <c>PUT /api/transactions/{transactionId}/status</c> — deliberately
/// its own small type, not the full <see cref="Transaction"/> record: a status
/// transition only ever changes one field, so the request shape says exactly
/// that, and it means a caller updating a status never has to re-send
/// <see cref="Transaction.Amount"/>/<see cref="Transaction.Currency"/> just to
/// change <see cref="Transaction.Status"/>. See docs/DESIGN.md §10.
/// </summary>
public sealed record UpdateTransactionStatusRequest
{
    public required TransactionStatus Status { get; init; }
}
