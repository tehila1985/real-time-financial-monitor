# ADR 0001: Cross-Pod Real-Time Synchronization via SignalR Redis Backplane

## Status
Accepted (documentation mandatory per assignment; implementation optional/time-boxed — see [DESIGN.md §20](../DESIGN.md#20-distributed-architecture)).

## Context
The backend is designed to be deployed as multiple replicas (pods) behind a Kubernetes Service (see `k8s/backend-deployment.yaml`, `replicas: 2`). Each pod runs its own independent SignalR server instance with its own in-memory connection registry.

## Problem
A client connected via WebSocket to Pod A is registered only in Pod A's local SignalR connection list. If a transaction is POSTed and load-balanced to Pod B, Pod B's `IHubContext<TransactionHub>.Clients.All.SendAsync(...)` only reaches clients connected to Pod B. The client on Pod A never receives the update — even though, from the outside, the system looks like a single service.

This is not a bug in our code; it is an inherent property of any stateful, in-process broadcast mechanism running across multiple isolated processes with no shared signaling channel between them.

Note: **session affinity ("sticky sessions") does not solve this.** It only guarantees a given client always reconnects to the same pod — it does nothing to propagate an event that originated on a *different* pod to that client's pod.

## Options Considered

| Option | Complexity | Reliability | Scalability | MVP Fit | Cloud Readiness |
|---|---|---|---|---|---|
| **SignalR Redis Backplane** (`Microsoft.AspNetCore.SignalR.StackExchangeRedis`) | Low — one NuGet package, one line of startup code | High — official, production-proven pattern (same mechanism Azure SignalR Service provides managed) | High for this workload | Excellent — purpose-built for exactly this problem | Excellent — works with any managed Redis (Azure Cache for Redis, AWS ElastiCache, or a Redis pod) |
| Message broker (Kafka / RabbitMQ) | High — new infra, producer/consumer plumbing, and we would still have to hand-write the per-pod relay-to-local-clients logic ourselves | High, but solving a different problem class (durable event streaming, not ephemeral live fan-out) | Very high — far beyond what this system needs | Poor — significant over-engineering relative to the actual requirement | Good, but heavy operational footprint |
| Shared DB + polling | Medium | Medium — polling interval introduces latency and risk of missed reads | Poor — read load scales with pods × poll frequency, not with actual data rate | Poor — reinvents pub/sub, worse than the real thing | Not idiomatic |

## Decision
Use the **official SignalR Redis backplane** (`AddStackExchangeRedis`). All backend pods connect to a shared Redis instance. When any pod's `IHubContext.SendAsync` is called, SignalR internally publishes the message to a Redis pub/sub channel; every pod (including the sender) is subscribed and relays the message to its own locally-connected clients.

```csharp
builder.Services.AddSignalR()
       .AddStackExchangeRedis(builder.Configuration["Redis:ConnectionString"]);
```

No change is required to `TransactionsController`, `TransactionService`, or `IStorage` — the backplane is entirely internal to the SignalR broadcast mechanism, which is exactly why keeping broadcast isolated behind `IHubContext` (see [DESIGN.md §11](../DESIGN.md#11-real-time-architecture)) pays off here.

## Rationale
- It is the narrowest possible fix for the exact problem stated: it does not introduce durability, ordering, or streaming guarantees the system does not need.
- It is officially supported and documented by Microsoft for this precise scenario, minimizing implementation risk.
- It requires no changes to domain/service/storage code — the layering decided in earlier sections isolates the blast radius of this change to configuration and DI registration only.

## Consequences
- **If implemented:** adds a Redis dependency to both local (`docker-compose`) and cluster (`k8s/redis-deployment.yaml`, `k8s/redis-service.yaml`) environments. This must be added to *both* consistently — a partial implementation (e.g., only in docker-compose) would misrepresent the system's actual cloud-readiness.
- **If not implemented (time-boxed decision):** the multi-pod inconsistency described above remains a known, documented limitation. A single-replica deployment (`replicas: 1`) sidesteps it entirely for demo purposes, at the cost of no horizontal scaling / high availability.
- Session affinity at the Ingress/load-balancer level remains a complementary recommendation for connection *stability* in a full production rollout, but is out of scope here since no Ingress resource was introduced (see [DESIGN.md §19](../DESIGN.md#19-kubernetes)).
