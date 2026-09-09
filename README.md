# Real-Time Financial Monitor

MVP for a real-time financial transaction monitor: an ASP.NET Core (.NET 8) backend
ingests transactions via HTTP, stores them thread-safely in memory, and broadcasts
them live over SignalR to a React + TypeScript dashboard.

**Full design rationale — every decision, every alternative considered, why it was
chosen — lives in [`docs/DESIGN.md`](docs/DESIGN.md).** This README is only "how to
run it"; that document is the "why," including a fast Q&A index (§27) and the
[distributed-sync ADR](docs/adr/0001-distributed-sync-redis-backplane.md).

**MVP vs. bonus:** the ingestion API, real-time broadcast, in-memory storage, both
frontend routes, and the test suites are the required MVP. Everything under
"Running with Docker Compose," "Kubernetes," and the distributed-sync ADR is bonus
work — all of it implemented and verified, not just described (see
[`DESIGN.md §4`](docs/DESIGN.md#4-scope--non-scope-summary) for the exact split).
The dashboard's row-entrance and status-color transitions (`TransactionTable.css`)
are the "Enhanced UI Experience" bonus — plain CSS, animating only `opacity`/
`transform` so it stays cheap under a burst (see `DESIGN.md §16`).

## Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download) (or a newer SDK that can target `net8.0`)
- [Node.js 20+](https://nodejs.org/) and npm
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (only needed for the Docker/Compose/Redis sections below)

## Running locally (no Docker)

Two terminals — the backend and frontend run as separate processes and talk to
each other directly (CORS-enabled for this; see [`DESIGN.md §18`](docs/DESIGN.md#18-docker)).

```bash
# Terminal 1 - backend (http://localhost:5225)
cd backend/src/Backend
dotnet run

# Terminal 2 - frontend (http://localhost:5173)
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173/add` to submit transactions and `http://localhost:5173/monitor`
to watch them arrive live.

## Running with Docker Compose

Builds and runs the frontend (nginx, reverse-proxying to the backend), the
backend, and Redis (the [cross-pod sync backplane](docs/adr/0001-distributed-sync-redis-backplane.md))
together - the closest local approximation of the Kubernetes deployment.

```bash
docker compose up --build
```

Open `http://localhost:5180`. (`5180` is the host-side port; change it in
`docker-compose.yml` if it collides with something else on your machine.)

## Tests

```bash
# Backend - xUnit (Storage, Service, API integration)
cd backend
dotnet test

# Frontend - Vitest + React Testing Library
cd frontend
npm test
```

## Verifying the "100 transactions arrive quickly" requirement

The UI must stay responsive under a burst of transactions (NFR3). This is
deliberately **not** a button inside the app (see [`DESIGN.md §15`](docs/DESIGN.md#15-state-management)
for why) - it's a standalone script:

```bash
# With the backend running locally (default http://localhost:5225):
./scripts/burst-test.sh 100

# Or against the Docker Compose stack, through the reverse proxy:
BASE_URL=http://localhost:5180 ./scripts/burst-test.sh 100
```

Have `/monitor` open in a browser while it runs.

## Kubernetes

Manifests are in [`k8s/`](k8s/) - `deployment.yaml` + `service.yaml` for the
backend, frontend, and Redis. No cluster is required to review them (per the
assignment); if you do have one (e.g. `kind` or `minikube`):

```bash
kubectl apply -f k8s/
```

The backend deliberately runs 2 replicas - see [`DESIGN.md §20`](docs/DESIGN.md#20-distributed-architecture)
and the ADR for the cross-pod broadcast problem this creates, and how the Redis
backplane above solves it.

## Project structure

```text
backend/     ASP.NET Core API + SignalR hub + in-memory storage, xUnit tests
frontend/    React + TypeScript (Vite), Vitest tests
k8s/         Kubernetes manifests
scripts/     burst-test.sh - see above
docs/        DESIGN.md (full technical design) + the ADR
docker-compose.yml
```
