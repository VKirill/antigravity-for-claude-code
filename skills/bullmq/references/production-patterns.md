# BullMQ — Production Patterns

## Graceful shutdown

```ts
import { Worker, Queue, QueueEvents } from 'bullmq';

const worker = new Worker(queueName, handler, { connection, concurrency: 10 });
const queue  = new Queue(queueName, { connection });
const events = new QueueEvents(queueName, { connection });

async function shutdown(signal: string) {
  console.log(`[${signal}] shutting down`);
  try {
    await worker.close();    // finish in-flight jobs (up to lockDuration)
    await events.close();
    await queue.close();
    process.exit(0);
  } catch (err) {
    console.error('shutdown failed', err);
    process.exit(1);
  }
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT',  () => shutdown('SIGINT'));

// Deadman timer — never hang forever
setTimeout(() => {
  console.error('forced shutdown after 60s');
  process.exit(1);
}, 60_000).unref();
```

`worker.close()` waits for the current handler to finish (subject to `lockDuration`). For force-close: `worker.close(true)`.

In PM2: configure `kill_timeout: 60000` to give workers time to drain.

## Sandboxed processors

Move CPU-bound work out of the main worker process so it doesn't block the event loop.

### Child process (default)

```ts
import { Worker } from 'bullmq';
import path from 'node:path';

new Worker('cpu-heavy', path.join(__dirname, 'processor.js'), { connection });
```

`processor.js`:

```ts
import { type SandboxedJob } from 'bullmq';

export default async function (job: SandboxedJob) {
  // CPU-bound work — runs in a child process
  return doExpensiveThing(job.data);
}
```

Pros: full isolation, separate event loop. Cons: spawn overhead per job (~30ms), IPC serialization cost.

### Worker threads (lighter)

```ts
new Worker('cpu-heavy', path.join(__dirname, 'processor.js'), {
  connection,
  useWorkerThreads: true,
});
```

Shares memory address space (faster startup) but separate event loops. Worker threads pool size = `concurrency`.

### URL-style path (Windows-friendly)

```ts
import { pathToFileURL } from 'node:url';

new Worker('cpu-heavy', pathToFileURL(path.join(__dirname, 'processor.js')), { connection });
```

### Sandboxed job API

```ts
// In processor.js
export default async function (job: SandboxedJob) {
  // job.data         — payload
  // job.id           — job id
  // await job.updateProgress(50);     — works the same
  // await job.log('checkpoint');       — works the same
  // job.moveToFailed / moveToDelayed   — limited; some methods unavailable
  return result;
}
```

Not all `Job` methods work in sandboxed processors. For complex interactions, use a non-sandboxed worker.

## Idempotency via `jobId`

```ts
await queue.add('charge', { paymentId }, {
  jobId: `charge-${paymentId}`,        // dedupes against waiting/active/delayed
  attempts: 5,
  removeOnComplete: { age: 86400 },     // keep for 24h to retain the dedup
});
```

Same `jobId` = same job in the queue. If the previous one already completed AND was removed, a new one is created.

Pair with DB-level dedup (idempotency key column) for at-most-once side-effects:

```ts
async function handler(job: Job) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.idempotencyKey.findUnique({ where: { key: `charge:${job.id}` } });
    if (existing) return JSON.parse(existing.response);

    const result = await processCharge(job.data);
    await tx.idempotencyKey.create({ data: { key: `charge:${job.id}`, response: JSON.stringify(result) } });
    return result;
  });
}
```

## Dead-letter queue (DLQ)

Permanently-failed jobs sit in the `failed` state with `removeOnFail: { age: ... }`. To move them to a dedicated DLQ for human review:

```ts
worker.on('failed', async (job, err) => {
  if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;   // still retrying

  // Final failure → DLQ
  await dlq.add('dead', {
    originalQueue: job.queueQualifiedName,
    originalId: job.id,
    name: job.name,
    data: job.data,
    err: { message: err.message, stack: err.stack },
    failedAt: Date.now(),
  }, {
    removeOnComplete: false,             // keep forever for review
  });
});
```

DLQ workers / operators can re-enqueue:

```ts
async function replay(dlqJobId: string) {
  const dead = await dlq.getJob(dlqJobId);
  if (!dead) return;
  const original = new Queue(dead.data.originalQueue, { connection });
  await original.add(dead.data.name, dead.data.data, { attempts: 3 });
  await dead.remove();
}
```

## Stalled jobs

A job stalls if the worker that's processing it doesn't renew the lock within `lockDuration`. Common causes:
- Worker crashed
- Worker is GC-paused (heap pressure)
- Long-running handler exceeded `lockDuration`

BullMQ automatically detects stalled jobs (`stalledInterval`) and re-queues them. Configure:

```ts
new Worker(name, handler, {
  connection,
  lockDuration: 30_000,
  lockRenewTime: 15_000,
  stalledInterval: 30_000,
  maxStalledCount: 1,           // 1 → after stalling once, move to failed
});
```

`maxStalledCount: 1` is safe — if a job consistently stalls, something's wrong (heap pressure, infinite loop).

## Job payload validation

```ts
import { z } from 'zod';

const PaymentJob = z.object({
  paymentId: z.string().min(1),
  amount: z.number().int().positive(),
  currency: z.string().length(3),
});
type PaymentJob = z.infer<typeof PaymentJob>;

new Worker<PaymentJob>('payments', async (job) => {
  const data = PaymentJob.parse(job.data);   // throws if malformed
  // ...
}, { connection });
```

Without validation, a corrupted payload crashes the worker process (and prevents progress on the queue).

## Worker process layout

| Pattern | Use |
|---|---|
| One process per queue | Predictable isolation; easier to scale heavy queues independently |
| One process, multiple Workers | Less overhead; share Redis connections |
| PM2 cluster mode | Each instance shares the same queue — BullMQ handles fair distribution |
| Kubernetes Deployment | One container = one worker; scale via replicas |

For a typical SaaS: 2–3 worker processes (PM2 cluster) per queue type, with `concurrency: 10–20`.

## Restarting workers under load

When deploying new worker code:
1. Send `SIGTERM` to old workers.
2. Wait for in-flight jobs to drain (up to `kill_timeout`).
3. Start new workers (auto-pick from the same queue).

PM2 `reload` does this naturally. K8s rolling update does it via `terminationGracePeriodSeconds`.

## Memory limits per process

```ts
// node --max-old-space-size=1024
// PM2: max_memory_restart: '1G'
```

Worker handlers leak more than HTTP handlers (long-running, less hot-path-tested). Cap heap and PM2-restart on OOM.

## Anti-patterns

- ❌ Forgetting `await worker.close()` in shutdown → in-flight jobs become stalled
- ❌ CPU-bound work in non-sandboxed worker → blocks all concurrent jobs
- ❌ Synchronously reading large payloads in `add` → can serialize MB-scale to Redis on hot path
- ❌ Skipping Zod validation → corrupt payload crashes the worker process
- ❌ Dead-letter without alerting → DLQ fills silently
- ❌ `attempts: 100` — if the first 5 didn't work, neither will 95 more; investigate, don't retry
- ❌ Not setting `removeOnComplete` / `removeOnFail` → unbounded Redis growth
