# BullMQ — Queues & Workers

## Connection

```ts
import { type ConnectionOptions } from 'bullmq';

// REQUIRED: maxRetriesPerRequest must be null for BullMQ
const connection: ConnectionOptions = {
  host: process.env.REDIS_HOST ?? '127.0.0.1',
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,        // <-- BullMQ requirement
  enableReadyCheck: true,
};
```

BullMQ uses long-blocking commands (`BRPOPLPUSH`). With a finite `maxRetriesPerRequest`, ioredis would abort them. The library throws a clear error on misconfig.

You can also pass an existing `ioredis` instance — but it must be configured this way.

## Queue (producer)

```ts
import { Queue } from 'bullmq';

const queue = new Queue('emails', { connection });

await queue.add('welcome', { userId: 'u_1' });
await queue.add('reset-password', { userId: 'u_2', token: 'abc' }, {
  attempts: 5,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 24 * 3600 },
});
```

### Queue methods

| Method | Purpose |
|---|---|
| `add(name, data, opts)` | Enqueue one job |
| `addBulk([{ name, data, opts }, ...])` | Bulk enqueue (one round-trip) |
| `getJob(id)` | Lookup by id |
| `getJobs(['waiting', 'active'], 0, 100)` | List by status |
| `getJobCounts()` | Counts per status |
| `getWaitingCount()`, `getActiveCount()`, `getCompletedCount()`, `getFailedCount()`, `getDelayedCount()` | |
| `pause()` / `resume()` | Stop / start processing |
| `drain(delayed?)` | Remove all waiting + (optional) delayed |
| `obliterate({ force: true })` | DELETE ALL data for this queue — destructive |
| `clean(grace, limit, type)` | Remove old jobs of a type (`completed` / `failed` / `wait` / `delayed`) |
| `close()` | Close the Queue instance |

## Worker (consumer)

```ts
import { Worker, type Job } from 'bullmq';

const worker = new Worker<{ userId: string }, { sent: boolean }, string>(
  'emails',
  async (job: Job) => {
    await sendEmail(job.data.userId);
    return { sent: true };
  },
  {
    connection,
    concurrency: 10,
    autorun: true,         // start processing immediately (default)
    stalledInterval: 30_000,
    maxStalledCount: 1,
    lockDuration: 30_000,
    lockRenewTime: 15_000,
  },
);

worker.on('completed',  (job, result) => console.log('done', job.id, result));
worker.on('failed',     (job, err)    => console.error('failed', job?.id, err));
worker.on('error',      (err)         => console.error('worker error', err));
```

### Worker options

| Option | Purpose |
|---|---|
| `concurrency` | Max simultaneous jobs in this worker |
| `autorun` | Whether to start consuming immediately (default `true`) |
| `lockDuration` | How long a worker holds the lock before considered stalled (default 30s) |
| `lockRenewTime` | Heartbeat to refresh the lock |
| `stalledInterval` | How often the worker scans for stalled jobs from other workers |
| `maxStalledCount` | How many times a job can stall before moved to failed |
| `limiter` | `{ max, duration }` rate limit |
| `name` | Worker name (used in logs and Bull Board) |
| `prefix` | Redis key prefix (default `'bull'`) |
| `useWorkerThreads` | Use worker_threads for sandboxed processor |

## QueueEvents (cross-process listener)

```ts
import { QueueEvents } from 'bullmq';

const events = new QueueEvents('emails', { connection });

events.on('completed', ({ jobId, returnvalue }) => log('completed', jobId, returnvalue));
events.on('failed',    ({ jobId, failedReason }) => log('failed', jobId, failedReason));
events.on('progress',  ({ jobId, data }) => log('progress', jobId, data));
events.on('waiting',   ({ jobId }) => log('waiting', jobId));
events.on('active',    ({ jobId, prev }) => log('active', jobId, 'from', prev));
events.on('stalled',   ({ jobId }) => log('stalled', jobId));
events.on('delayed',   ({ jobId, delay }) => log('delayed', jobId, delay));
events.on('removed',   ({ jobId }) => log('removed', jobId));
```

Use `QueueEvents` for metrics, dashboards, audit logs. `Worker.on('completed')` fires only in the worker that ran the job; `QueueEvents` fires everywhere.

## Job lifecycle

```text
add()
  └── waiting
        └── active           (worker picks up)
              ├── completed
              ├── failed     (after attempts exhausted)
              └── stalled    (lock expired) → re-queued or moved to failed
delayed (delay > 0 or backoff)
  └── promoted to waiting at delay-time
```

## Inspecting jobs

```ts
const job = await queue.getJob('123');
job.id, job.name, job.data, job.opts, job.attemptsMade, job.timestamp;
job.returnvalue;       // after complete
job.failedReason;      // after fail
job.stacktrace;        // array of stack traces from each attempt

await job.log('progress note');                   // appears in Bull Board
const logs = await queue.getJobLogs('123', 0, 100);
const state = await job.getState();               // 'completed' | 'failed' | ...
await job.remove();
await job.retry();                                // move from failed back to waiting
await job.moveToFailed(new Error('manual'), 'token-uuid');
```

## Cluster compatibility

BullMQ on Redis Cluster requires hash tags so all queue keys go to the same slot:

```ts
new Queue('emails', { connection, prefix: '{bull:emails}' });
```

Or configure cluster client with hash-slot-aware routing. Most BullMQ deployments use single-node or Sentinel — Cluster is doable but adds friction.

## Graceful shutdown

```ts
async function shutdown() {
  console.log('shutdown initiated');
  await worker.close();           // finish in-flight jobs (within their lock duration)
  await events.close();
  await queue.close();
  process.exit(0);
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
```

`worker.close()` waits for current jobs to finish. To force immediate shutdown: `worker.close(true)`.

## Anti-patterns

- ❌ Sharing one Redis client between `Queue` / `Worker` / `QueueEvents` — each needs its own
- ❌ Forgetting `maxRetriesPerRequest: null` — runtime error
- ❌ Running worker inside the web server process — under load, jobs starve HTTP requests; use a separate process / container
- ❌ Setting `concurrency: 1000` — Redis can't deliver that many BLPOPs concurrently efficiently; tune realistically
- ❌ Never calling `clean()` or setting `removeOnComplete` — Redis fills up with completed-job history
- ❌ Using `obliterate()` outside a test — destroys everything
