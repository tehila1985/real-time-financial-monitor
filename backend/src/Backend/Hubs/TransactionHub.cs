using Microsoft.AspNetCore.SignalR;

namespace Backend.Hubs;

/// <summary>
/// Push-only channel — see docs/DESIGN.md §9, §11. Deliberately empty: no
/// client-invokable methods. Server code broadcasts to it via
/// <see cref="IHubContext{THub}"/> from <see cref="Services.TransactionService"/>;
/// connection thread-safety is handled entirely by SignalR itself (§12.3).
/// </summary>
public sealed class TransactionHub : Hub
{
}
