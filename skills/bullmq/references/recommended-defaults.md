# Recommended defaults — bullmq

The canonical values for BullMQ 5 in production. **All other files in this skill cite this table — do not redefine inline.** Source: synthesized from `docs.bullmq.io`, BullMQ release notes, and operational experience.

> Citation rule: when a recommendation depends on workload, give a default + a range + a "tune up when..." / "tune down when..." condition. Cargo-culting defaults is worse than no defaults.

## Connection (ioredis)

```ts
const connection: ConnectionOptions = {
  host: process.env.REDIS_HOST ?? '127.0.0.1',
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,   // REQUIRED by BullMQ; not optional
  enableReadyCheck: true,
  retryStrategy: (times) => Math.min(times * 200, 5000),
};
```

| Knob | Default | Why |
|---|---|---|
| `maxRetriesPerRequest` | `null` | Required. BullMQ uses blocking commands that fail with finite retries. |
| Passing the **config object** across instances | YES — pass the same `{ host, port, maxRetriesPerRequest: null }` literal to `Queue`, `Worker`, `QueueEvents` | BullMQ internally instantiates the subscription/blocking clients it needs per instance. Sharing the config is the recommended path. |
| Passing a **live `new IORedis()` instance** across instances | NO — do not reuse the same live client for `Worker` and `Queue`/`QueueEvents` | `Worker` flips its client into blocking mode; the same client can no longer serve non-blocking commands. If you must construct ioredis yourself, give `Worker` its own dedicated instance. |

## Queue defaults

```ts
new Queue('my-queue', {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: { age: 24 * 3600, count: 1000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});
```

| Knob | Default | Range | Tune-up when | Tune-down when |
|---|---|---|---|---|
| `attempts` | **5** | 3–10 | external provider is flaky (≥10) | jobs are non-idempotent and dupes are catastrophic (1–2 + DLQ) |
| `backoff.type` | **`exponential`** | `exponential` / `fixed` | bursty failures | predictable downstream (use `fixed`) |
| `backoff.delay` | **5000 ms** | 1000–30000 | provider needs longer to cool down | first retry should be near-instant (1000) |
| `removeOnComplete.age` | **86400 (24h)** | 3600–604800 | you replay history (7d) | Redis memory is tight |
| `removeOnComplete.count` | **1000** | 100–10000 | high-volume archival need | low-volume queue |
| `removeOnFail.age` | **604800 (7d)** | 86400–2592000 | postmortem cycle is long | DLQ pattern handles failure data |

## Worker defaults

```ts
new Worker('my-queue', handler, {
  connection,
  concurrency: 10,
  lockDuration: 30_000,
  lockRenewTime: 15_000,
  maxStalledCount: 3,
  stalledInterval: 30_000,
});
```

| Knob | Default | Range | Tune-up when | Tune-down when |
|---|---|---|---|---|
| `concurrency` (I/O-bound) | **10** | 5–50 | downstream tolerates more parallelism + you have HTTP pool to match | downstream is fragile / has its own rate limit |
| `concurrency` (CPU-bound) | **2** | 1–4 | n-core machine and jobs are independent | jobs already use worker_threads internally |
| `lockDuration` | **30000 ms** | 15000–600000 | jobs legitimately take minutes (reports, ML) | jobs are sub-second and stalled detection should be fast |
| `lockRenewTime` | **15000 ms** | ~`lockDuration / 2` | always half of `lockDuration` | — |
| `maxStalledCount` | **3** | 1–5 | tolerant of crash-loops | strict environments — fail fast |
| `stalledInterval` | **30000 ms** | 15000–60000 | many workers → reduce contention | few workers → keep at 30s |

## Job Schedulers

Job Schedulers don't have additional defaults — they delegate to `defaultJobOptions` on the queue + per-scheduler overrides. Recommended overrides:

```ts
await queue.upsertJobScheduler(
  'daily-report',
  { pattern: '0 8 * * *', tz: 'Europe/Moscow' },
  {
    name: 'send-daily-report',
    data: {},
    opts: {
      attempts: 3,                                        // less than transactional default
      backoff: { type: 'exponential', delay: 60_000 },    // scheduled jobs can wait minutes
      removeOnComplete: { age: 30 * 24 * 3600, count: 50 },
      removeOnFail: { age: 90 * 24 * 3600 },              // keep failed schedules longer for postmortem
    },
  },
);
```

## Limiter (per-queue rate limit)

```ts
new Worker('emails', handler, {
  connection,
  limiter: { max: 100, duration: 60_000 },   // 100 jobs / minute, queue-wide
});
```

| Knob | Default | Notes |
|---|---|---|
| `limiter.max` | depends on downstream | match downstream's published rate limit minus safety margin |
| `limiter.duration` | depends on downstream | window in ms; 60_000 = per minute |

When provider returns `429`, escalate to manual `worker.rateLimit(retryAfterMs); throw new RateLimitError();` — see `concurrency-and-rate-limit.md`.

## Idempotency

| Pattern | When to use |
|---|---|
| `jobId` (string, derived from business key) | Same business event must not produce duplicate work. BullMQ dedups before enqueue. |
| DB-level dedup table (`processed_events`) | When `jobId` isn't enough — e.g., retries from external system that doesn't carry stable id; or your dedup window is longer than your queue retention. |
| Combined | Production default for webhooks: `jobId = hash(event_id)` **plus** DB row insert with `ON CONFLICT DO NOTHING`. |

## Redis HA / persistence (out-of-scope reference)

This skill does not deep-dive Redis ops. See the `redis` skill or `linux-sysadmin` for `maxmemory-policy`, AOF vs RDB, Sentinel, Cluster.

Minimum production setup:
- Redis 8+ standalone with AOF (`appendonly yes`, `appendfsync everysec`)
- `maxmemory-policy: noeviction` for BullMQ — never silently drop queue data
- Disk monitoring (AOF grows; rewrite policy `auto-aof-rewrite-percentage 100`)

## Citation rule

Other files in this skill MUST NOT redefine these values inline. Use:

> Defaults: see [recommended-defaults.md](recommended-defaults.md).

## Last verified

2026-05-15 against BullMQ 5.76.x official docs + release notes.
