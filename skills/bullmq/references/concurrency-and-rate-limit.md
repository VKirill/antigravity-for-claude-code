# BullMQ — Concurrency & Rate Limiting

## Concurrency

```ts
new Worker(queueName, handler, { connection, concurrency: 20 });
```

Max simultaneous jobs in THIS worker process. With 4 worker processes × concurrency 10 = 40 jobs in flight globally.

### Picking a value

| Job type | Concurrency per worker |
|---|---|
| External HTTP / slow API | 20–100 (I/O bound) |
| Database write | 5–20 (DB-pool size matters) |
| In-memory CPU work | 1 |
| File system / network I/O | 10–50 |
| Mixed | start at 10; profile |

Rule: `concurrency × workers ≈ target throughput / mean job duration`.

### Dynamic concurrency

Adjust at runtime:

```ts
worker.concurrency = 5;   // setter — affects new jobs picked up
```

## Rate limiting per queue

```ts
new Worker(queueName, handler, {
  connection,
  limiter: { max: 100, duration: 60_000 },   // 100 jobs per 60s ACROSS ALL workers
});
```

When the rate is exceeded, jobs are pushed to a `delayed` state and processed when the window resets.

This is **global** for the queue (not per worker process). All workers share the rate budget.

### Hitting external rate limits

The canonical BullMQ pattern: call `worker.rateLimit(duration)` to pause the queue, then throw `RateLimitError` so the job goes back to `waiting` (not `failed`):

```ts
import { Worker, RateLimitError, UnrecoverableError } from 'bullmq';

const worker = new Worker(queueName, async (job) => {
  try {
    return await externalApi.call(job.data);
  } catch (err) {
    if (isRateLimited(err)) {
      const retryAfterMs = parseRetryAfter(err);
      await worker.rateLimit(retryAfterMs);     // pause this worker's queue
      // Stop retrying when attempts are exhausted
      if (job.attemptsStarted >= (job.opts.attempts ?? 1)) {
        throw new UnrecoverableError('rate-limit exhausted attempts');
      }
      throw new RateLimitError();               // re-queue without counting as a failure
    }
    throw err;
  }
}, { connection, limiter: { max: 1, duration: 500 } });
```

`worker.rateLimit(durationMs)` pauses the worker's queue for that duration. The accompanying `throw new RateLimitError()` is required so BullMQ moves the job back to `waiting` instead of treating it as a regular failure (and counting an attempt). Source: [BullMQ rate-limiting docs](https://docs.bullmq.io/guide/rate-limiting).

> Common pitfall: importing a non-existent `RateLimiterPg` from `bullmq`. The exports are `Worker`, `RateLimitError`, `UnrecoverableError`. There is no `RateLimiterPg` in BullMQ — that name belongs to the unrelated `rate-limiter-flexible` package.

## Sequential jobs per key (sequentialize)

You want jobs for `user_123` to run one-at-a-time, but jobs for different users in parallel.

BullMQ doesn't have a built-in `groupKey` (that's a BullMQ Pro feature). DIY via:

### Option 1 — separate queue per user (small N users)

```ts
const queues = new Map<string, Queue>();
function queueFor(userId: string): Queue {
  if (!queues.has(userId)) queues.set(userId, new Queue(`user-${userId}`, { connection }));
  return queues.get(userId)!;
}

// Worker per queue with concurrency 1 — only feasible for small N
```

### Option 2 — distributed lock inside handler

```ts
new Worker('process-user-event', async (job) => {
  const lockKey = `lock:user:${job.data.userId}`;
  const token = crypto.randomUUID();
  const acquired = await redis.set(lockKey, token, 'NX', 'EX', 30);
  if (!acquired) {
    throw new Error('locked');  // BullMQ will retry per backoff
  }
  try {
    return await doWork(job);
  } finally {
    await redis.eval(`if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end`, 1, lockKey, token);
  }
}, { connection, concurrency: 10 });
```

Set `attempts: 50, backoff: { type: 'fixed', delay: 500 }` for jobs that may be locked-out.

### Option 3 — BullMQ Pro group keys

```ts
new Worker(queueName, handler, {
  connection,
  group: { concurrency: 1 },     // 1 job per group at a time
});
// At enqueue:
await queue.add('x', data, { group: { id: `user:${userId}` } });
```

Pro is a paid commercial fork by Taskforce.sh. Adds groups + observables. Free BullMQ doesn't have group concurrency.

## Per-job concurrency (BullMQ Pro)

Not available in OSS BullMQ. Workaround: combine option 2 above with a finer-grained lock key (per-resource).

## `autorun: false` — deferred start

When you need to register listeners or wire side-effects before the worker begins draining the queue, construct it with `autorun: false` and start it explicitly with `worker.run()` (no arguments):

```ts
const worker = new Worker(queueName, handler, { connection, autorun: false });

worker.on('failed', (job, err) => log.error({ jobId: job?.id, err }, 'job failed'));
worker.on('completed', (job) => log.info({ jobId: job.id }, 'job done'));

// Start processing after listeners are attached.
await worker.run();
```

`Worker.run()` has signature `(): Promise<void>` — it does not accept a custom dispatch function. For fine-grained throttling, use `limiter` + `concurrency` options on the constructor instead of trying to override the runner.

## Pausing / resuming

```ts
await queue.pause();          // stop new jobs going active
await queue.resume();

await worker.pause();         // stop this worker; queue may still send to others
await worker.resume();
```

## Long-running jobs and `lockDuration`

BullMQ jobs hold a lock for `lockDuration` (default 30s). The worker renews every `lockRenewTime` (default 15s). If a handler takes longer than `lockDuration` AND fails to renew, the job is considered stalled.

For long jobs, raise these:

```ts
new Worker(name, handler, {
  connection,
  lockDuration: 5 * 60_000,    // 5 min
  lockRenewTime: 60_000,
});
```

Or break the work into smaller jobs (flow / child) and aggregate.

## Anti-patterns

- ❌ Setting `concurrency: 1000` — Redis BLPOPs don't scale that far; tune lower
- ❌ Forgetting that `limiter` is global — multiple workers compete for the budget
- ❌ Using sleep inside a handler to enforce rate limits — use `limiter` or `worker.rateLimit() + throw new RateLimitError()`
- ❌ Distributed lock without TTL → stuck forever if worker crashes
- ❌ Long-running job without raising `lockDuration` → stalled → re-run → duplicate side-effects
- ❌ Adding rate limit via app-side counter → race conditions; use the queue's `limiter`
