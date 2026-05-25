# Troubleshooting — bullmq

Symptom-indexed. Find what the user sees, follow the diagnosis steps, apply the fix. Required for `risk: high-stakes` skills per skill-evaluation v3.

---

## Workers don't start (silent exit, no logs)

**Symptoms**
- `node worker.js` exits with code 0 immediately, no error
- PM2 / Docker shows "online" but `getJobCounts` returns growing `waiting` with `active: 0`
- No structured log line "worker ready" appears

**Diagnose**
```bash
# 1. Confirm Redis is reachable
redis-cli -h $REDIS_HOST -p $REDIS_PORT PING

# 2. Confirm worker process attaches
node -e "
const {Worker} = require('bullmq');
const w = new Worker('test', async () => {}, {
  connection: { host: process.env.REDIS_HOST, maxRetriesPerRequest: null }
});
w.on('ready', () => { console.log('ok'); process.exit(0); });
w.on('error', (e) => { console.error(e); process.exit(1); });
"

# 3. Tail any swallowed exceptions
node --unhandled-rejections=strict worker.js
```

**Common causes**
- ❌ Missing `maxRetriesPerRequest: null` on ioredis connection (BullMQ requires this — without it, blocking commands fail with finite retries and the worker silently disconnects)
- ❌ Top-level `await` failing before any `Worker` is constructed — uncaught rejection, process exits silently
- ❌ DNS resolution failure inside Docker — `localhost` from container points to container, not the Redis host
- ❌ `autorun: false` set but `worker.run()` never called

**Fix**
```ts
const connection = {
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  maxRetriesPerRequest: null,  // REQUIRED
};
new Worker('queue', handler, { connection });
```
See `recommended-defaults.md` for the full connection block.

---

## Jobs stuck in `waiting` (queue grows, never drains)

**Symptoms**
- `await queue.getJobCounts('waiting')` keeps rising
- `active: 0`, `delayed: 0`
- Worker logs show no work

**Diagnose**
```bash
# 1. Confirm worker connects to same queue name (not "emails" vs "email")
# 2. Confirm Redis keyspace prefix matches
redis-cli -h $REDIS_HOST KEYS 'bull:emails:*' | head
# 3. Confirm worker process is alive
pm2 list   # or docker ps
# 4. Inspect a waiting job's state
redis-cli -h $REDIS_HOST LRANGE 'bull:emails:waiting' 0 -1
```

**Common causes**
- ❌ Queue name typo (`emails` produced vs `email` consumed)
- ❌ `prefix` option mismatch between Queue and Worker
- ❌ Worker exited and was never restarted (pm2 startup not configured)
- ❌ Worker is running but processing a different queue (copy-paste error)

**Fix**
- Align queue name and prefix between producer and worker (single shared constant)
- `pm2 startup` + `pm2 save` to survive reboot
- Add a `worker.on('ready')` log on boot to confirm attachment

---

## Jobs stuck in `delayed` (never promoted to `waiting`)

**Symptoms**
- `getJobCounts('delayed')` grows
- Cron / repeat jobs never fire
- `Queue.upsertJobScheduler` was called but no jobs appear

**Diagnose**
```bash
# Inspect the delayed zset
redis-cli -h $REDIS_HOST ZRANGE 'bull:emails:delayed' 0 5 WITHSCORES
# Scores are unix-ms timestamps; if all are in the past, promotion is broken
```

**Common causes**
- ❌ **No `Worker` is running** for this queue. In BullMQ 5 `QueueScheduler` is removed; the `Worker` itself promotes delayed jobs. Without a running worker, delayed jobs accumulate.
- ❌ `stalledInterval` set too high — promotion ticks happen via stalled-job sweep
- ❌ System clock drift between producer and worker host

**Fix**
- Ensure at least one `Worker` is running for the queue — required even if you only schedule jobs from elsewhere
- Reset clock skew via NTP

---

## OOM in Redis

**Symptoms**
- Redis logs: `OOM command not allowed when used memory > 'maxmemory'`
- Producer side: enqueue calls reject with OOM error
- `redis-cli INFO memory` shows `used_memory_human` near `maxmemory`

**Common causes**
- ❌ `removeOnComplete: false` (default if unset) — every completed job persists forever
- ❌ Large payloads stored directly in `job.data` instead of by reference
- ❌ DLQ accumulating without bounded TTL
- ❌ Many repeating-job scheduler entries with `count: <large>` — they each retain history

**Fix**
```ts
new Queue('emails', {
  defaultJobOptions: {
    removeOnComplete: { age: 86400, count: 1000 },   // 24h or last 1k
    removeOnFail: { age: 604800 },                   // 7d
  },
});
```
Plus: move large payloads to S3/blob, pass references in `job.data`. See `recommended-defaults.md`.

---

## Stalled-job spam (jobs run twice, "stalled" log flood)

**Symptoms**
- Logs: `job <id> stalled` followed by re-execution
- Side effects (emails, webhooks) fire 2+ times
- `getJobCounts('failed')` rises with `attemptsMade > 1`

**Common causes**
- ❌ Handler blocks event loop for longer than `lockDuration` (default 30 s) — BullMQ assumes the worker died and reassigns the job
- ❌ Worker process is overloaded — concurrency too high, can't renew locks
- ❌ Slow Redis (high latency on lock-renew commands)
- ❌ Unhandled `await` inside handler causes effective stall

**Fix**
1. **Increase `lockDuration`** to comfortably exceed your p99 handler time:
   ```ts
   new Worker('reports', handler, {
     lockDuration: 5 * 60_000,     // 5 min for jobs that take ≤ 2 min
     lockRenewTime: 60_000,        // renew every minute
   });
   ```
2. **Lower `concurrency`** if the box can't keep up
3. **Always make jobs idempotent** (jobId + DB dedup) so stalled re-execution is safe — see `production-patterns.md`

---

## CPU-bound jobs starve event loop

**Symptoms**
- Jobs take longer than expected
- HTTP server (in same process) becomes unresponsive
- Lock renewal fails → stalled-job spam

**Fix — use sandboxed processor**
```ts
import { Worker } from 'bullmq';
import { pathToFileURL } from 'node:url';

new Worker(
  'image-resize',
  pathToFileURL(new URL('./processors/resize.js', import.meta.url)).href,
  { connection, concurrency: 2, useWorkerThreads: true },
);
```
The processor runs in a separate `worker_threads` (or child process with `useWorkerThreads: false`). Event loop in the main process stays free. See `production-patterns.md` for the full pattern.

---

## Graceful shutdown drops jobs

**Symptoms**
- On SIGTERM (deploy, autoscale), in-flight jobs are killed mid-execution
- Side effects partially applied → inconsistent state

**Fix**
```ts
async function shutdown() {
  await worker.close();    // waits for in-flight jobs to finish
  await queue.close();
  await connection.quit();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Configure container's `terminationGracePeriodSeconds` (k8s) / `kill_timeout` (PM2)
// to exceed your p99 job duration.
```
See `production-patterns.md` for the deadman-timer variant (force-exit if `worker.close()` itself hangs).

---

## Retry storm (jobs hammer failing downstream)

**Symptoms**
- Downstream provider rate-limits/blocks your traffic
- `failed` count rises rapidly
- Logs show same job failing every few seconds

**Common causes**
- ❌ `attempts` set high (e.g., 100) with `fixed` backoff at 1 s → 100 retries per minute
- ❌ Exponential backoff configured but with low cap

**Fix**
```ts
defaultJobOptions: {
  attempts: 5,
  backoff: { type: 'exponential', delay: 5000 },   // 5s, 10s, 20s, 40s, 80s
}
// Plus: handle 429 explicitly — see concurrency-and-rate-limit.md
```
For sustained downstream outage, **stop retrying** with `UnrecoverableError`:
```ts
if (err.status === 401) throw new UnrecoverableError('auth failed');  // no retries
```

---

## DLQ never drains (failures forgotten)

**Symptoms**
- `getJobCounts('failed')` only goes up
- No alerts, no postmortem
- Failed jobs eventually evicted, work permanently lost

**Fix — explicit DLQ pattern**
1. Catch terminal failures in `worker.on('failed', ...)`
2. Persist failure to a `dead_letter` table or separate queue
3. Build a replay endpoint (admin UI) that re-enqueues from the DLQ

See `examples/webhook-flow-dead-letter.md` for the canonical implementation.

---

## More symptoms?

If your symptom isn't listed, capture: queue counts (`getJobCounts(...)`), Redis `INFO memory`, worker process tree (`pm2 jlist` / `docker stats`), and a sample of the failed-job structure (`await queue.getJob('id')`). File an issue with that data; we extend this file when patterns repeat.
