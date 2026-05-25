# Bull → BullMQ Migration

Bull (`bull` package) and BullMQ (`bullmq` package) are separate npm packages. BullMQ is the modern, TypeScript-first successor — different API, same Redis backing protocol (mostly), shared Taskforce.sh maintainers.

## Key differences

| Aspect | Bull (legacy) | BullMQ |
|---|---|---|
| Language | JS | TS-first |
| Queue class | `new Queue(name, opts)` | `new Queue(name, { connection })` |
| Processor | `queue.process(handler)` | `new Worker(name, handler, { connection })` |
| Events | `queue.on('completed', ...)` | `new QueueEvents(name, { connection })` |
| Delayed-job + stalled | `QueueScheduler` (deprecated in newer BullMQ) | Built into `Worker` |
| Repeating jobs | `queue.add({ repeat })` | `queue.upsertJobScheduler` |
| Flows | Manual chaining | `FlowProducer` |
| Concurrency | `queue.process(N, handler)` | `Worker(.., { concurrency: N })` |
| Pro features | N/A | BullMQ Pro (group keys, observables) |

## Step-by-step migration

### Bull (before)

```ts
import Queue from 'bull';

const queue = new Queue('emails', 'redis://127.0.0.1:6379');

queue.process(10, async (job) => {
  await sendEmail(job.data);
});

queue.on('completed', (job, result) => console.log('done', job.id));

await queue.add('welcome', { userId: 'u_1' }, {
  attempts: 5,
  backoff: { type: 'exponential', delay: 1000 },
});

// Repeating
await queue.add('daily', {}, { repeat: { cron: '0 8 * * *' } });
```

### BullMQ (after)

```ts
import { Queue, Worker, QueueEvents } from 'bullmq';

const connection = { host: '127.0.0.1', port: 6379, maxRetriesPerRequest: null };

const queue = new Queue('emails', { connection });

const worker = new Worker('emails', async (job) => {
  await sendEmail(job.data);
}, { connection, concurrency: 10 });

const events = new QueueEvents('emails', { connection });
events.on('completed', ({ jobId, returnvalue }) => console.log('done', jobId));

await queue.add('welcome', { userId: 'u_1' }, {
  attempts: 5,
  backoff: { type: 'exponential', delay: 1000 },
});

// Repeating — schedulers are upserted on the Queue, not via a separate class
await queue.upsertJobScheduler(
  'daily-emails',
  { pattern: '0 8 * * *' },
  { name: 'daily', data: {} },
);
```

## Checklist

- [ ] Install `bullmq`; uninstall `bull`
- [ ] Replace `new Queue(name, redisUrl)` with `new Queue(name, { connection })`
- [ ] Add `maxRetriesPerRequest: null` to the Redis connection config
- [ ] Split `queue.process()` into `new Worker()` + `new QueueEvents()`
- [ ] Move event handlers from `queue.on(...)` to `events.on(...)` (for cross-process events) or `worker.on(...)` (in-process)
- [ ] Convert `repeat` jobs to `queue.upsertJobScheduler`
- [ ] Replace `Queue.add({ repeat: { cron: '...' } })` calls with explicit upserts on app boot
- [ ] If you used `QueueScheduler` from an earlier BullMQ — remove it (built into `Worker` now)
- [ ] Verify `removeOnComplete`/`removeOnFail` are set
- [ ] Add `jobId` to enqueues that should be idempotent
- [ ] Replace manual job-chaining with `FlowProducer`
- [ ] Update Bull Board to `@bull-board/api` v5+ with `BullMQAdapter`

## API-level mapping

```ts
// Bull
queue.add(data, opts);                         → queue.add(name, data, opts);
queue.process(handler);                         → new Worker(name, handler, opts);
queue.process(concurrency, handler);            → new Worker(.., { concurrency });
queue.on('completed', (job, result) => {});    → worker.on('completed', ...) OR events.on('completed', ({ jobId, returnvalue }) => {});
queue.getJob(id);                               → queue.getJob(id);  // same
queue.clean(grace, type);                       → queue.clean(grace, limit, type);  // different signature
queue.empty();                                  → queue.drain();
queue.close();                                  → queue.close(); worker.close(); events.close();
```

## Redis data format

BullMQ uses a different Redis key layout than Bull. **You cannot share queues between Bull and BullMQ workers**. If you have an existing Bull-formatted queue:

1. **Drain** the old queue (let workers finish all jobs).
2. Stop Bull workers.
3. Run BullMQ workers against the same Redis (different queue name OR different prefix).
4. Re-enqueue any pending work.

If you need a transition period where both run side by side, use **different queue names** (e.g., `emails-bull` → `emails-mq`) and migrate consumers progressively.

## Bull Board

```bash
# Bull (legacy adapter)
npm i bull-board

# BullMQ
npm i @bull-board/api @bull-board/fastify   # or your server adapter
```

```ts
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { BullAdapter } from '@bull-board/api/bullAdapter';

createBullBoard({
  queues: [
    new BullMQAdapter(bullmqQueue),
    new BullAdapter(bullLegacyQueue),     // can mix during migration
  ],
  serverAdapter,
});
```

## QueueScheduler removal (BullMQ ≥ 5)

Older BullMQ docs (1.x–4.x) required a `QueueScheduler` instance per queue for delayed-job promotion and stalled detection. **In BullMQ 5+, this is built into `Worker`** and the `QueueScheduler` class is removed.

If migrating from an older BullMQ:
- Delete `new QueueScheduler(name, ...)` lines
- Ensure `Worker` instance is running (it handles those responsibilities now)

## Migration pitfalls

- ❌ Forgetting `maxRetriesPerRequest: null` on Redis connection — runtime error
- ❌ Trying to use one Redis client for `Queue`, `Worker`, `QueueEvents` — they each need their own
- ❌ Assuming `queue.on('completed')` works in BullMQ (it's `worker.on` or `events.on`)
- ❌ Old `repeat: { cron }` still works in BullMQ but mixes badly with `queue.upsertJobScheduler` — pick one
- ❌ Bull's `priority: 1` (highest) vs `priority: N` semantics — same in BullMQ
- ❌ Bull's `removeOnComplete: true` removes ALL — same in BullMQ; consider `{ age, count }` form
- ❌ Bull's `queue.process` with multiple handlers per queue — BullMQ workers process all job names by default; use `if (job.name === 'x')` branching or one worker per name
