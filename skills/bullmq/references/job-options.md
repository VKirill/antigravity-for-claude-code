# BullMQ — Job Options

## All options

```ts
await queue.add('name', data, {
  // Retries
  attempts: 5,
  backoff: { type: 'exponential', delay: 1000 },
                   // or { type: 'fixed', delay: 5000 }
                   // or a custom backoff strategy registered on the worker

  // Timing
  delay: 60_000,                              // start in 60s
  priority: 1,                                // lower = sooner (1 is highest)
  lifo: false,                                 // FIFO default; lifo: true = stack
  jobId: `payment-${paymentId}`,               // idempotency key — duplicate add is no-op

  // Lifecycle / cleanup
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail:     { age: 24 * 3600 },

  // Misc
  sizeLimit: 100_000,                          // reject if serialized JSON > N bytes
  timestamp: Date.now(),
  parent: { id: 'parent-id', queue: 'parent-queue' },  // see flows-and-children.md
  stackTraceLimit: 5,
  deduplication: { id: 'unique-key-x', ttl: 60_000 },  // BullMQ Pro
});
```

## Attempts + backoff

```ts
await queue.add('http-call', { url }, {
  attempts: 5,
  backoff: { type: 'exponential', delay: 1000 },
  // attempt 1 fail → wait 1s
  // attempt 2 fail → wait 2s
  // attempt 3 fail → wait 4s
  // attempt 4 fail → wait 8s
  // attempt 5 fail → move to 'failed'
});
```

### Built-in backoff types

| Type | Behavior |
|---|---|
| `fixed` | `delay` ms between every retry |
| `exponential` | `delay * 2^(attempt-1)` |

### Custom backoff

```ts
const worker = new Worker(queueName, handler, {
  connection,
  settings: {
    backoffStrategy: (attemptsMade, type, err, job) => {
      if (err?.message === 'rate-limited') return 5000 * attemptsMade;
      return 500 * 2 ** attemptsMade;
    },
  },
});

await queue.add('x', data, {
  attempts: 5,
  backoff: { type: 'custom' },
});
```

## Priority

`priority: 1` (highest) … `priority: N` (lowest). Default = 0 (treated as highest tier or as no-priority bucket depending on internal sorting; supply explicit values for predictable behavior).

Implementation: priority uses a separate sorted set. Adding priority jobs is slightly slower than FIFO. Use only when you need it.

## `lifo`

```ts
await queue.add('alarm', data, { lifo: true });  // pushed to front, processed first
```

LIFO is useful for "panic" jobs that should preempt the queue. Note: still subject to concurrency / rate-limit.

## `jobId` — idempotency

```ts
// Both calls produce ONE job in the queue
await queue.add('charge', { paymentId: 'p_1' }, { jobId: `charge-p_1` });
await queue.add('charge', { paymentId: 'p_1' }, { jobId: `charge-p_1` });
```

If a job with the same `jobId` already exists in `waiting` / `delayed` / `active`, the second `add` is a no-op. Use for webhook-triggered fan-outs to prevent duplicate work.

If the previous job is already `completed` and removed, a new one is created. Pair with DB-level dedup if at-most-once is critical.

## `delay`

```ts
await queue.add('send-reminder', { id }, { delay: 24 * 3600 * 1000 });  // 24h
```

Job sits in the `delayed` zset until its time. The Worker's `delayedInterval` (internal) promotes it.

## `removeOnComplete` / `removeOnFail`

Without these, every job sticks around. With many jobs/sec, Redis fills up.

```ts
removeOnComplete: true,                                      // remove all completed
removeOnComplete: 1000,                                      // keep last 1000
removeOnComplete: { age: 3600 },                              // keep for 1 hour
removeOnComplete: { age: 3600, count: 1000 },                 // both — whichever first
```

Same shape for `removeOnFail`. **Always set these in production.**

## Repeating jobs — Job Schedulers (BullMQ 5+)

Modern API; replaces the older `Queue.add(name, data, { repeat: { pattern } })`. **Schedulers are upserted on the `Queue` instance** — there is no standalone `JobScheduler` class to instantiate.

```ts
import { Queue } from 'bullmq';

const queue = new Queue('reports', { connection });

await queue.upsertJobScheduler(
  'daily-report',                                  // schedulerId — idempotency key
  { pattern: '0 8 * * *', tz: 'Europe/Moscow' },   // repeat opts
  {                                                 // job template
    name: 'send-daily-report',
    data: { kind: 'daily' },
    opts: { attempts: 3 },
  },
);

// Every 30 seconds
await queue.upsertJobScheduler(
  'health-poll',
  { every: 30_000 },
  { name: 'health-check', data: {} },
);

// Get configured schedulers on this queue
await queue.getJobSchedulers();

// Remove
await queue.removeJobScheduler('daily-report');
```

`pattern` accepts cron syntax (with optional `tz`). `every` is the interval in ms. The two are mutually exclusive within one scheduler.

> Canonical docs: <https://docs.bullmq.io/guide/job-schedulers>

### Endpoint pattern

`queue.upsertJobScheduler(schedulerId, ...)` is idempotent — call on app boot to (re-)register all your schedulers in one place. Same `schedulerId` + new args = updated scheduler, not duplicate.

### Old API (deprecated but works)

```ts
await queue.add('hourly', data, {
  repeat: { pattern: '0 * * * *', tz: 'UTC' },
});
```

Same effect but harder to manage updates (the old API tracks repeat options inside the job; changing them requires removing the old one first).

## Cron syntax

```
# ┌── minute (0-59)
# │ ┌── hour (0-23)
# │ │ ┌── day of month (1-31)
# │ │ │ ┌── month (1-12)
# │ │ │ │ ┌── day of week (0-6, Sunday = 0)
# │ │ │ │ │
# * * * * *

0 8 * * *           # daily at 08:00
*/15 * * * *        # every 15 min
0 0 * * 0           # every Sunday at midnight
0 9-17 * * 1-5      # hourly during business hours, Mon-Fri
```

Timezones: `{ pattern: '...', tz: 'Europe/Moscow' }`. Default UTC.

## `sizeLimit`

```ts
await queue.add('big', { html: '...' }, { sizeLimit: 50_000 });   // reject if > 50 KB serialized
```

Prevents megabyte payloads from clogging Redis. Push large blobs to S3, queue the pointer.

## Patterns

### Idempotent webhook side-effect

```ts
await queue.add('fulfill-order', { orderId }, {
  jobId: `fulfill-${orderId}`,            // idempotent: webhook retry won't double-fulfill
  attempts: 5,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: { age: 86400 },
});
```

### High-priority panic email

```ts
await queue.add('alert', { msg }, { priority: 1, attempts: 3 });
```

### Delayed reminder

```ts
const remindAt = new Date('2026-06-01').getTime() - Date.now();
await queue.add('reminder', { userId }, { delay: remindAt });
```

## Job-level decisions inside handler

```ts
new Worker(name, async (job) => {
  if (shouldDelay(job.data)) {
    await job.moveToDelayed(Date.now() + 60_000, job.token);
    return;
  }
  if (shouldDiscard(job.data)) {
    await job.discard();    // mark complete without doing work
    return;
  }
  // ...
});
```

`job.token` is the lock token; required for `moveToDelayed` / `moveToWaitingChildren` in newer BullMQ.

## Anti-patterns

- ❌ `attempts: 1` on a network-dependent job — silently fails on a single packet loss
- ❌ Setting `delay` longer than `lockDuration` — irrelevant, but be aware delayed != active
- ❌ Using `repeat` AND `jobId` together — repeat generates predictable ids; you'd block them
- ❌ Cron pattern without timezone → UTC; user wants local time
- ❌ Skipping `removeOnComplete` → unbounded Redis growth
- ❌ Forgetting that `jobId` only dedupes against active/waiting/delayed — completed-and-removed jobs are gone, new id is created
