# BullMQ — Observability

## Bull Board — web dashboard

`@bull-board/api` plus an adapter (`@bull-board/fastify`, `@bull-board/express`, `@bull-board/hono`, etc.). Shows: jobs per state, payload, return value, logs, retry / remove buttons, stack traces.

### Install

```bash
npm i @bull-board/api @bull-board/fastify
```

### Fastify mount

```ts
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { FastifyAdapter } from '@bull-board/fastify';

const serverAdapter = new FastifyAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [
    new BullMQAdapter(emailsQueue),
    new BullMQAdapter(reportsQueue),
  ],
  serverAdapter,
});

await app.register(serverAdapter.registerPlugin(), {
  prefix: '/admin/queues',
  basePath: '',
});
```

Now `GET /admin/queues` shows the dashboard. Gate it with auth (basic auth middleware or Fastify's `@fastify/basic-auth`).

### Hono mount

```ts
import { Hono } from 'hono';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { HonoAdapter } from '@bull-board/hono';

const serverAdapter = new HonoAdapter(serveStatic);
serverAdapter.setBasePath('/admin/queues');
createBullBoard({ queues: [new BullMQAdapter(queue)], serverAdapter });

app.route('/admin/queues', serverAdapter.registerPlugin());
```

### Next.js (App Router)

Use the Hono adapter mounted via a catch-all route handler, OR run Bull Board as a separate service.

### What it shows

- Per-queue counts (waiting / active / completed / failed / delayed / paused)
- Job list with filter by state
- Click into a job → payload, return value, logs, stack trace, opts
- Retry / discard / remove buttons
- Performance metrics (per-min throughput, latency)
- Schedulers list

### Security

Bull Board exposes job data — which often contains sensitive PII. Always:
1. Behind auth (basic auth, OAuth proxy, VPN-only).
2. Behind a non-public path (e.g., `/internal/queues`).
3. Logged access — wrap with audit hook.

## OpenTelemetry tracing

```ts
import { trace, context, propagation } from '@opentelemetry/api';

const tracer = trace.getTracer('bullmq');

// Enqueue side — capture trace context
async function enqueue(name: string, data: object) {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  await queue.add(name, { ...data, _trace: carrier });
}

// Worker side — restore context, create child span
new Worker(queueName, async (job) => {
  const parentContext = propagation.extract(context.active(), job.data._trace ?? {});
  const span = tracer.startSpan(`job.${job.name}`, {
    attributes: { 'messaging.system': 'bullmq', 'messaging.destination': queueName, 'job.id': job.id! },
  }, parentContext);

  try {
    return await context.with(trace.setSpan(parentContext, span), () => handle(job));
  } catch (err) {
    span.recordException(err as Error);
    span.setStatus({ code: 2 });
    throw err;
  } finally {
    span.end();
  }
}, { connection });
```

End-to-end traces: HTTP request → enqueue → worker → DB call all in one trace.

## Prometheus metrics

```ts
import { Counter, Histogram, Gauge, register } from 'prom-client';

const completed = new Counter({ name: 'bullmq_completed_total', help: '', labelNames: ['queue', 'name'] });
const failed    = new Counter({ name: 'bullmq_failed_total',    help: '', labelNames: ['queue', 'name'] });
const duration  = new Histogram({ name: 'bullmq_duration_seconds', help: '', labelNames: ['queue', 'name'], buckets: [0.1, 0.5, 1, 5, 10, 30, 60] });
const waiting   = new Gauge({ name: 'bullmq_waiting',  help: '', labelNames: ['queue'] });
const active    = new Gauge({ name: 'bullmq_active',   help: '', labelNames: ['queue'] });
const failedCt  = new Gauge({ name: 'bullmq_failed_ct', help: '', labelNames: ['queue'] });

// Worker-side timing
new Worker(queueName, async (job) => {
  const end = duration.startTimer({ queue: queueName, name: job.name });
  try {
    const result = await handle(job);
    completed.inc({ queue: queueName, name: job.name });
    return result;
  } catch (err) {
    failed.inc({ queue: queueName, name: job.name });
    throw err;
  } finally {
    end();
  }
}, { connection });

// Periodic gauge poll
setInterval(async () => {
  const counts = await queue.getJobCounts();
  waiting.set({ queue: queueName }, counts.waiting);
  active.set({ queue: queueName }, counts.active);
  failedCt.set({ queue: queueName }, counts.failed);
}, 15_000);

// Expose /metrics on a Fastify route
app.get('/metrics', async (req, reply) => {
  reply.type(register.contentType).send(await register.metrics());
});
```

## Structured logging

```ts
import pino from 'pino';
const logger = pino();

new Worker(queueName, async (job) => {
  const log = logger.child({ jobId: job.id, jobName: job.name, attemptsMade: job.attemptsMade });
  log.info('started');
  try {
    const result = await handle(job);
    log.info({ result }, 'completed');
    return result;
  } catch (err) {
    log.error({ err }, 'failed');
    throw err;
  }
}, { connection });
```

Bind correlation ids: `job.data.requestId` from the enqueuing HTTP request → log line.

## Alerting

Key signals:
- `bullmq_failed_total` rate > N/min → fire-incident
- `bullmq_waiting` gauge above threshold for >5 min → workers under-provisioned
- `bullmq_active` always 0 → workers down
- DLQ size > 0 → human investigation needed
- Slow job — duration histogram p99 > X seconds

Wire to Prometheus + Alertmanager / Grafana / Sentry. For low-traffic apps: just a daily email of DLQ contents.

## Inspecting Redis directly

```bash
redis-cli
> KEYS bull:emails:*
> ZRANGE bull:emails:waiting 0 -1
> LRANGE bull:emails:active 0 -1
> HGETALL bull:emails:1234           # job hash
> XLEN bull:emails:events             # event stream length
```

BullMQ uses `bull:` prefix by default. Job ids → hashes; waiting → list (left-to-right); active → list; delayed/completed/failed → sorted sets keyed by score.

## Anti-patterns

- ❌ Exposing Bull Board publicly without auth
- ❌ Logging full job payloads (PII leak) — log only `jobId` and metadata
- ❌ Counting jobs via `KEYS bull:*` — use `getJobCounts()`
- ❌ Polling for metrics inside the handler — affects throughput
- ❌ Tracing without context propagation — orphan spans not joined to the HTTP trace
- ❌ Skipping the DLQ — permanent failures invisible until users complain
