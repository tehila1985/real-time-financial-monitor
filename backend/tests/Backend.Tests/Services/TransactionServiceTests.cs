using Backend.Hubs;
using Backend.Models;
using Backend.Services;
using Backend.Storage;
using Backend.Tests.TestSupport;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace Backend.Tests.Services;

/// <summary>
/// Covers the Service rows of the test matrix in docs/DESIGN.md §17. IStorage and
/// IHubContext are mocked so these tests isolate "did the Service orchestrate
/// correctly" from "is Storage itself correct" (covered separately in
/// InMemoryTransactionStoreTests) — the exact separation §9 justifies keeping
/// IStorage as an interface for.
///
/// Note: `SendAsync(method, arg)` on IClientProxy is an extension method that
/// delegates to `SendCoreAsync(method, object?[] args, ct)` — that's the member
/// actually mocked/verified below, since Moq can't intercept extension methods.
/// </summary>
public class TransactionServiceTests
{
    private static (Mock<IStorage> Storage, Mock<IClientProxy> ClientProxy, TransactionService Service) CreateSut()
    {
        var storage = new Mock<IStorage>();

        var clientProxy = new Mock<IClientProxy>();
        clientProxy
            .Setup(p => p.SendCoreAsync(It.IsAny<string>(), It.IsAny<object?[]>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var hubClients = new Mock<IHubClients>();
        hubClients.Setup(c => c.All).Returns(clientProxy.Object);

        var hubContext = new Mock<IHubContext<TransactionHub>>();
        hubContext.Setup(h => h.Clients).Returns(hubClients.Object);

        var service = new TransactionService(storage.Object, hubContext.Object, NullLogger<TransactionService>.Instance);

        return (storage, clientProxy, service);
    }

    [Fact]
    public async Task ProcessAsync_StoresTheTransaction()
    {
        var (storage, _, service) = CreateSut();
        var transaction = TransactionFactory.Create();

        await service.ProcessAsync(transaction);

        storage.Verify(s => s.Add(transaction), Times.Once);
    }

    [Fact]
    public async Task ProcessAsync_BroadcastsTransactionReceivedWithTheTransactionAsPayload()
    {
        var (_, clientProxy, service) = CreateSut();
        var transaction = TransactionFactory.Create();

        await service.ProcessAsync(transaction);

        clientProxy.Verify(p => p.SendCoreAsync(
            TransactionService.TransactionReceivedEvent,
            It.Is<object?[]>(args => args.Length == 1 && Equals(args[0], transaction)),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ProcessAsync_StoresBeforeBroadcasting()
    {
        // Locks in §12.4: the storage write must complete (and its lock be
        // released) before the async broadcast is awaited.
        var (storage, clientProxy, service) = CreateSut();
        var transaction = TransactionFactory.Create();
        var callOrder = new List<string>();

        storage.Setup(s => s.Add(It.IsAny<Transaction>()))
            .Callback(() => callOrder.Add("storage"));
        clientProxy.Setup(p => p.SendCoreAsync(It.IsAny<string>(), It.IsAny<object?[]>(), It.IsAny<CancellationToken>()))
            .Callback(() => callOrder.Add("broadcast"))
            .Returns(Task.CompletedTask);

        await service.ProcessAsync(transaction);

        Assert.Equal(new[] { "storage", "broadcast" }, callOrder);
    }

    [Fact]
    public async Task ProcessAsync_BroadcastThrows_DoesNotFailTheAlreadySuccessfulWrite()
    {
        // The storage write is the durability contract; broadcasting is
        // best-effort. A transient SignalR/Redis failure here must not turn an
        // already-persisted transaction into a caller-visible failure (see the
        // XML doc on ProcessAsync for the full reasoning).
        var (storage, clientProxy, service) = CreateSut();
        var transaction = TransactionFactory.Create();

        clientProxy
            .Setup(p => p.SendCoreAsync(It.IsAny<string>(), It.IsAny<object?[]>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("simulated broadcast failure"));

        var exception = await Record.ExceptionAsync(() => service.ProcessAsync(transaction));

        Assert.Null(exception);
        storage.Verify(s => s.Add(transaction), Times.Once);
    }

    [Fact]
    public async Task ProcessAsync_BroadcastCancelled_PropagatesTheCancellationInsteadOfLoggingIt()
    {
        // Found in code review: the broad catch above must not conflate a
        // graceful-shutdown cancellation with a genuine broadcast failure —
        // only the latter should be swallowed-and-logged.
        var (storage, clientProxy, service) = CreateSut();
        var transaction = TransactionFactory.Create();

        clientProxy
            .Setup(p => p.SendCoreAsync(It.IsAny<string>(), It.IsAny<object?[]>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new OperationCanceledException("simulated shutdown"));

        await Assert.ThrowsAsync<OperationCanceledException>(() => service.ProcessAsync(transaction));
        storage.Verify(s => s.Add(transaction), Times.Once); // the write still already happened
    }
}
