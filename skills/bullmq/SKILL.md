---
name: bullmq
description: "BullMQ 5 — Redis-backed Node.js queue. Jobs, workers, flows, repeating, rate-limit, sandboxed processors, observability. Use when: bullmq, bull mq, taskforcesh, Queue, Worker, QueueEvents, FlowProducer, JobScheduler, repeatable job, cron, delay, backoff, priority, lifo, attempts, removeOnComplete, sandboxed processor, useWorkerThreads, sequentialize, rate limiter, parent-child, child jobs, dependencies, bull-board, bullmq-pro, getJobCounts, drain, obliterate, QueueScheduler (removed), graceful shutdown. SKIP: legacy Bull (→bull-legacy cascade), Agenda, Inngest / Trigger.dev (managed SaaS), Celery (Python), Sidekiq (Ruby)."
stacks:
  - bullmq
  - queue
  - nodejs-backend
  - redis
packages:
  - bullmq
  - "@bull-board/api"
  - "@bull-board/fastify"
  - "@bull-board/express"
  - "@bull-board/hono"
tags:
  - queue
  - bullmq
  - redis
  - background-jobs
  - workers
  - cron
  - flows
manifests:
  - package.json
source: vechkasov-global-skills
risk: high-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- BullMQ: `5.x`
- Redis: `8.x`
- Node.js: `24.x (Active LTS)`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->

## Usage

Loaded automatically when its description matches the active task. Read only the section you need.

## Use this skill when

- Designing background job queues on Node.js backed by Redis (BullMQ 5+)
- Setting up `Queue`, `Worker`, `QueueEvents`, `FlowProducer` instances + Job Schedulers (upserted on the Queue, not a standalone class)
- Configuring job options: `delay`, `attempts`, `backoff`, `priority`, `lifo`, `removeOnComplete`, `removeOnFail`, `jobId`
- Implementing repeating / scheduled jobs (cron + every-N-ms via `queue.upsertJobScheduler` — replaces deprecated `Queue.add` repeat options)
- Designing parent–child flows with `FlowProducer` (waits for children to finish before parent runs)
- Setting concurrency, rate-limiting (`limiter`), `sequentialize` (one-at-a-time per key)
- Wiring sandboxed processors (separate process or `useWorkerThreads`) for CPU-bound jobs
- Adding observability: `QueueEvents` listeners, Bull Board dashboard, OpenTelemetry tracing
- Implementing graceful shutdown for workers (SIGTERM → finish current job → exit)
- Migrating from Bull (legacy) to BullMQ — different API, no `QueueScheduler`, JS-only → TS-friendly
- Auditing existing BullMQ code for common pitfalls (stalled jobs, missing `attempts`, no idempotency)

## Do not use this skill when

- Task is legacy **Bull** (the JavaScript predecessor) — use `bull-legacy` (cascade marker)
- Task is Agenda (MongoDB-backed) — different paradigm, different skill
- Task is Inngest / Trigger.dev / Defer / Hatchet — managed SaaS, different skill
- Task is Sidekiq (Ruby), Celery (Python), Resque — different runtime
- Task is raw Redis Streams consumer (use `redis` for `XADD`/`XREADGROUP`) — BullMQ is built on top, with extras
- Task is queue-design generally (what queue to pick) — broader question; this skill assumes BullMQ chosen

## Purpose

BullMQ 5 is the dominant background-job queue for Node.js in 2026 — successor to Bull (renamed, rewritten in TypeScript, redesigned API). It uses Redis as the backing store (lists + sorted sets + streams + hashes), is single-leader-friendly, supports parent-child flows, scheduled / repeating jobs via `queue.upsertJobScheduler`, rate limiting per queue, per-job concurrency, sandboxed processors (separate child process or `worker_threads`), and a polished dashboard via `@bull-board/*`.

This skill covers queue/worker/event design, job options (attempts, backoff, priority, delay, idempotency via `jobId`), repeating jobs (cron or every-N-ms via `queue.upsertJobScheduler`), parent-child flows, events and progress, concurrency and rate limiting, sandboxed processors with `useWorkerThreads`, production patterns (graceful shutdown, dead-letter, monitoring), and the Bull → BullMQ migration. The `QueueScheduler` class from earlier BullMQ versions is removed — its responsibilities (delayed-job promotion, stalled detection) moved into the `Worker` itself.

What this skill does NOT do: low-level Redis tuning (see `redis`), generic Node patterns (see `nodejs`), HTTP framework wiring (see `fastify` / `hono` for routes that enqueue), database writes from workers (see `prisma` / `postgresql`).

## Capabilities

Each line below points to the canonical reference. The reference owns code, edge cases, and gotchas — do not duplicate them here.

- **Queue & Worker** — `Queue`, `Worker`, `QueueEvents`; `maxRetriesPerRequest: null` required on ioredis. → [queues-and-workers.md](references/queues-and-workers.md)
- **Job options** — `attempts`, `backoff`, `delay`, `priority`, `jobId` (idempotency), `removeOnComplete`/`removeOnFail`. → [job-options.md](references/job-options.md)
- **Flows & children** — `FlowProducer` builds parent-child trees; parent runs only after children finish. → [flows-and-children.md](references/flows-and-children.md)
- **Events & progress** — `QueueEvents` cross-process stream; `job.updateProgress()` inside workers; `job.log()` per-job lines. → [events-and-progress.md](references/events-and-progress.md)
- **Concurrency & rate limit** — per-worker `concurrency`, queue-wide `limiter`, manual 429 handling via `worker.rateLimit() + throw new RateLimitError()`. → [concurrency-and-rate-limit.md](references/concurrency-and-rate-limit.md)
- **Repeating jobs** — `queue.upsertJobScheduler(schedulerId, repeatOpts, jobTemplate)` (NOT `new JobScheduler(...)` — that class is not instantiated directly). → [job-options.md](references/job-options.md) repeat section, canonical: <https://docs.bullmq.io/guide/job-schedulers>
- **Sandboxed processors** — pass a file path/URL as the `processor` argument to `Worker`; `useWorkerThreads: true` for lighter isolation. → [production-patterns.md](references/production-patterns.md)
- **Production patterns** — graceful shutdown, dead-letter queue, idempotency via `jobId` + DB dedup, stalled-job handling. → [production-patterns.md](references/production-patterns.md)
- **Observability** — Bull Board dashboard, `QueueEvents` → Prometheus / OpenTelemetry, `getJobCounts()` for metrics. → [observability.md](references/observability.md)
- **Bull → BullMQ migration** — `QueueScheduler` removed (folded into `Worker`); `Worker` is a class not `queue.process`; repeating jobs via `queue.upsertJobScheduler`. → [migration.md](references/migration.md)
- **Recommended defaults** — canonical values for `attempts`/`backoff`/`concurrency`/`lockDuration`/`removeOnComplete`/limiter. → [recommended-defaults.md](references/recommended-defaults.md)
- **Troubleshooting** — workers don't start, jobs stuck in `waiting`/`delayed`, OOM Redis, stalled-job spam, retry storm, DLQ drain. → [troubleshooting.md](references/troubleshooting.md)

## Behavioral Traits

- Always sets `maxRetriesPerRequest: null` on the BullMQ connection (required)
- Always sets `attempts`, `backoff`, `removeOnComplete`, `removeOnFail` per [recommended-defaults.md](references/recommended-defaults.md) — no inline magic numbers
- Uses `jobId` (e.g., `payment-${paymentId}`) for idempotent retries; combines with DB-level dedup for production webhooks
- Separates worker process from web process (different PM2 / k8s service)
- Uses `FlowProducer` (not manual job chaining) for multi-step pipelines
- Uses `queue.upsertJobScheduler` for cron, not `Queue.add(..., { repeat })`
- Wires graceful shutdown — `SIGTERM` → `worker.close()` → wait for in-flight → exit
- Adds OpenTelemetry / Pino logging per job; never silent `console.log`
- Validates job payload with Zod at the worker entry
- Uses sandboxed processors (`useWorkerThreads` or child process) for any CPU-bound work

## Important Constraints

- NEVER use a Redis connection with `maxRetriesPerRequest != null` for BullMQ — BullMQ requires `null`
- NEVER share a **live `new IORedis()` instance** between `Worker` and `Queue`/`QueueEvents` — `Worker` flips its client into blocking mode, breaking other operations on the same client. Sharing the **config object** (`{ host, port, maxRetriesPerRequest: null }`) across all three is fine and recommended — BullMQ creates the underlying clients per instance. See [recommended-defaults.md](references/recommended-defaults.md).
- NEVER set `concurrency` > 50 without sandboxing — the main event loop can't realistically do more
- NEVER skip `attempts` — single-shot jobs fail silently on transient errors (DB blip, rate-limit)
- NEVER skip `removeOnComplete` / `removeOnFail` — finished jobs persist forever otherwise → Redis OOM
- NEVER do CPU-bound work in the main worker function — blocks event loop, stalls other concurrent jobs; use sandboxed
- NEVER throw raw errors from a handler if you need retry context — throw with `cause` so logs trace
- ALWAYS validate job data with Zod at the worker entry
- ALWAYS implement graceful shutdown — workers killed mid-job leave stalled entries
- ALWAYS use `jobId` for at-least-once idempotency (webhook fan-out, payment side-effects)

## Related Skills

### Runtime
- ✓ `nodejs` — Node 24 host
- ✓ `typescript` — TS 5.9; BullMQ ships types

### Backing store
- ✓ `redis` — BullMQ runs on Redis 6+; understand the data structures it uses

### Web frameworks (enqueue endpoint, Bull Board dashboard)
- ✓ `fastify` — `@bull-board/fastify` adapter
- ✓ `hono` — `@bull-board/hono` adapter
- ✓ `nextjs` — Server Actions enqueue; dashboard via App Router

### Persistence (worker → DB)
- ✓ `prisma` — Prisma writes from worker
- ✓ `postgresql` — raw SQL writes from worker

### Validation
- ✓ `zod` — validate job payloads at worker entry

### Deploy & ops
- ✓ `linux-sysadmin` — PM2 worker process, systemd, log rotation
- `docker` — worker container [cascade marker]

### Domain
- ✓ `cloudpayments` / ✓ `yookassa` — webhook → enqueue side-effects to BullMQ
- ✓ `telegram-bot` — long-running tasks queued from bot handlers

### Code discipline
- ✓ `karpathy-guidelines`

## API Reference

| Topic | File |
|---|---|
| Queues & workers — Queue, Worker, QueueEvents, connection, concurrency | [references/queues-and-workers.md](references/queues-and-workers.md) |
| Job options — attempts, backoff, delay, priority, jobId, removeOnComplete | [references/job-options.md](references/job-options.md) |
| Flows & children — FlowProducer, parent–child trees, getDependencies | [references/flows-and-children.md](references/flows-and-children.md) |
| Events & progress — QueueEvents stream, `job.updateProgress`, `job.log` | [references/events-and-progress.md](references/events-and-progress.md) |
| Concurrency & rate limit — limiter, group keys, sequentialize | [references/concurrency-and-rate-limit.md](references/concurrency-and-rate-limit.md) |
| Production patterns — graceful shutdown, dead-letter, stalled jobs, sandboxed | [references/production-patterns.md](references/production-patterns.md) |
| Observability — Bull Board, OpenTelemetry, Prometheus metrics | [references/observability.md](references/observability.md) |
| Migration Bull → BullMQ — API differences, QueueScheduler removal | [references/migration.md](references/migration.md) |
| **Recommended defaults** — canonical retry/concurrency/lockDuration/limiter values + tuning ranges | [references/recommended-defaults.md](references/recommended-defaults.md) |
| **Troubleshooting** — symptom-indexed: workers don't start, jobs stuck, OOM, stalled spam, retry storm, DLQ | [references/troubleshooting.md](references/troubleshooting.md) |
| Eval cases | [references/eval-cases.md](references/eval-cases.md) |

### Templates

| Template | File |
|---|---|
| Queue + Worker setup with Zod-validated payload, graceful shutdown | [templates/queue-setup.ts.template](templates/queue-setup.ts.template) |
| Repeating cron job via `queue.upsertJobScheduler` | [templates/repeating-job.ts.template](templates/repeating-job.ts.template) |
| Sandboxed processor (worker_threads) for CPU-bound work | [templates/sandboxed-processor.ts.template](templates/sandboxed-processor.ts.template) |

### Examples

| Scenario | File |
|---|---|
| Payment webhook → BullMQ flow with retries + dead-letter | [examples/webhook-flow-dead-letter.md](examples/webhook-flow-dead-letter.md) |
| Bull Board dashboard mounted on a Fastify app | [examples/bull-board-on-fastify.md](examples/bull-board-on-fastify.md) |

**How to use**: open the specific topic file. New queue → `queues-and-workers.md` + `job-options.md`. Cron → `job-options.md` repeat section. Production hardening → `production-patterns.md` + `observability.md`. Upgrading from Bull → `migration.md`.
