# BullMQ — Events & Progress

## Two event surfaces

| Source | Scope | Use |
|---|---|---|
| `worker.on(event, ...)` | THIS worker process only | Worker-side handling (logging, in-process metrics) |
| `QueueEvents` | Cross-process, all events | Dashboards, external metrics, multi-process orchestration |

## Worker events

```ts
worker.on('completed',  (job, result) => {});
worker.on('failed',     (job, err)    => {});
worker.on('error',      (err)         => {});
worker.on('active',     (job, prev)   => {});
worker.on('progress',   (job, prog)   => {});
worker.on('stalled',    (jobId)       => {});
worker.on('closed',     ()            => {});
worker.on('drained',    ()            => {});  // queue empty
worker.on('paused',     ()            => {});
worker.on('resumed',    ()            => {});
```

Worker events have direct access to the `Job` object — useful when you need `job.data`, `job.opts`, `job.log()`.

## QueueEvents

```ts
import { QueueEvents } from 'bullmq';

const events = new QueueEvents('emails', { connection });

events.on('completed', ({ jobId, returnvalue, prev }) => {});
events.on('failed',    ({ jobId, failedReason, prev }) => {});
events.on('active',    ({ jobId, prev }) => {});
events.on('waiting',   ({ jobId, prev }) => {});
events.on('delayed',   ({ jobId, delay }) => {});
events.on('progress',  ({ jobId, data }) => {});
events.on('stalled',   ({ jobId }) => {});
events.on('removed',   ({ jobId, prev }) => {});
events.on('paused',    () => {});
events.on('resumed',   () => {});
events.on('drained',   () => {});
events.on('cleaned',   ({ count }) => {});
```

QueueEvents subscribes to a Redis Stream that BullMQ writes to. Multiple subscribers can read independently.

Important: QueueEvents only sees jobIds + serialized return values — not the full `Job` object. To inspect, look up: `await queue.getJob(jobId)`.

## Progress reporting

Inside a worker handler:

```ts
new Worker('long-task', async (job) => {
  for (let i = 0; i < 100; i++) {
    await doStep(i);
    await job.updateProgress(i + 1);          // 0–100 or arbitrary structured value
  }
}, { connection });
```

`updateProgress` can take a number or an object:

```ts
await job.updateProgress({ step: 'fetching', percent: 30 });
```

The value is stored on the job (`job.progress`) and emitted as a `progress` event on both `Worker` and `QueueEvents`.

### Reading progress

```ts
const job = await queue.getJob(jobId);
job.progress;   // last reported value
```

Or via `QueueEvents.on('progress', ...)` in real time.

## Job logs

```ts
// Inside handler
await job.log('step 1 complete');
await job.log(`fetched ${rows.length} rows`);

// Read
const { logs, count } = await queue.getJobLogs(jobId, 0, 100);
```

`log()` is async — writes a string to a Redis list keyed by job. Visible in Bull Board.

## Async iterator (Promise-based wait)

```ts
const events = new QueueEvents('emails', { connection });

// Wait for a specific job to complete
const result = await new Promise((resolve, reject) => {
  events.on('completed', ({ jobId, returnvalue }) => {
    if (jobId === myJobId) resolve(returnvalue);
  });
  events.on('failed', ({ jobId, failedReason }) => {
    if (jobId === myJobId) reject(new Error(failedReason));
  });
});
```

Or use `Job.waitUntilFinished(events)` — built-in helper:

```ts
const job = await queue.add('x', { ... });
const result = await job.waitUntilFinished(events, 30_000);   // 30s timeout
```

Useful for request/response style flows where an HTTP handler enqueues a job and waits for the result.

## Lifecycle event order

For a typical successful job:

```
waiting → active → progress (n times) → completed
```

For a failure that retries:

```
waiting → active → failed → delayed (backoff) → active → completed
```

For a stall:

```
waiting → active → (no heartbeat) → stalled → active (another worker) → completed
```

## Metrics integration

```ts
import { Counter, Histogram, register } from 'prom-client';

const jobsCompleted = new Counter({ name: 'bullmq_completed_total', labelNames: ['queue', 'name'] });
const jobDuration = new Histogram({ name: 'bullmq_duration_seconds', labelNames: ['queue', 'name'] });
const jobsFailed = new Counter({ name: 'bullmq_failed_total', labelNames: ['queue', 'name'] });

events.on('completed', async ({ jobId }) => {
  const job = await queue.getJob(jobId);
  if (!job) return;
  jobsCompleted.inc({ queue: 'emails', name: job.name });
  jobDuration.observe({ queue: 'emails', name: job.name }, (Date.now() - job.timestamp) / 1000);
});

events.on('failed', async ({ jobId }) => {
  const job = await queue.getJob(jobId);
  jobsFailed.inc({ queue: 'emails', name: job?.name ?? 'unknown' });
});
```

Expose `register.metrics()` on a `/metrics` endpoint for Prometheus.

## OpenTelemetry integration

```ts
import { trace, context } from '@opentelemetry/api';

const tracer = trace.getTracer('bullmq');

new Worker(name, async (job) => {
  const span = tracer.startSpan(`job.${job.name}`, { attributes: { 'job.id': job.id! } });
  try {
    return await context.with(trace.setSpan(context.active(), span), () => handle(job));
  } catch (err) {
    span.recordException(err as Error);
    span.setStatus({ code: 2 });
    throw err;
  } finally {
    span.end();
  }
});
```

For end-to-end tracing, propagate the trace ID through `job.data.traceContext` when enqueuing.

## Anti-patterns

- ❌ Subscribing to `QueueEvents` inside a hot handler — leaks listeners
- ❌ Calling `await job.log()` on every iteration of a 1M-iteration loop — Redis hit per log
- ❌ Polling `job.getState()` in a tight loop instead of subscribing to QueueEvents
- ❌ Forgetting `await job.updateProgress()` — async; missed updates if you fire-and-forget
- ❌ Using progress as a heartbeat — use BullMQ's built-in `lockRenewTime` instead
