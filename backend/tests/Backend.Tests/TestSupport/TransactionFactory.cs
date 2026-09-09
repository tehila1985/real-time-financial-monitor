using Backend.Models;

namespace Backend.Tests.TestSupport;

/// <summary>
/// Single shared "build a valid Transaction for a test" helper — found in
/// code review duplicated three times (Api/Service/Storage test classes),
/// each with slightly different capabilities. Defaults match a plausible,
/// valid transaction; override only the fields a given test cares about.
/// </summary>
internal static class TransactionFactory
{
    public static Transaction Create(
        Guid? id = null,
        decimal amount = 100m,
        string currency = "USD",
        TransactionStatus status = TransactionStatus.Pending,
        DateTimeOffset? timestamp = null) => new()
        {
            TransactionId = id ?? Guid.NewGuid(),
            Amount = amount,
            Currency = currency,
            Status = status,
            Timestamp = timestamp ?? DateTimeOffset.UtcNow,
        };
}
