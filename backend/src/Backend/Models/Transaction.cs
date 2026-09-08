using System.Text.Json.Serialization;

namespace Backend.Models;

/// <summary>
/// See docs/DESIGN.md §9. Serialized as a string on the wire ("Pending", not 0) via
/// the attribute below — attached to the enum itself so every serialization path
/// (Controller responses, SignalR hub payloads) gets it automatically, with nothing
/// to remember to configure per call site.
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter<TransactionStatus>))]
public enum TransactionStatus
{
    Pending,
    Completed,
    Failed,
}

/// <summary>
/// The single model used as the wire format, the storage record, and the broadcast
/// payload — see docs/DESIGN.md §9 for why there is no separate DTO/Entity split.
///
/// Properties use C#'s <c>required</c> modifier (not a positional record constructor)
/// specifically so a JSON body missing any field fails deserialization for every
/// field type, not just reference types — see docs/DESIGN.md §10.
/// </summary>
public sealed record Transaction
{
    public required Guid TransactionId { get; init; }
    public required decimal Amount { get; init; }
    public required string Currency { get; init; }
    public required TransactionStatus Status { get; init; }
    public required DateTimeOffset Timestamp { get; init; }
}
