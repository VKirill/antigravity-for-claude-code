# Performance and cost

Logging is "free" until you find out it's costing 30% of CPU or $5000/month. Two ways to break this: synchronous I/O on hot paths, and unbounded volume.

## Async appenders

Synchronous file write blocks the event loop (Node) or the request thread (Python). At scale this becomes throughput cap.

### Pino — async by default

Pino streams to stdout via a worker thread when transports are configured. No special setup needed. Avoid manual `fs.writeSync` patterns.

For maximum throughput: pipe stdout directly (don't transform in-process):

```ts
// ❌ Slow
const logger = pino({ transport: { target: 'pino-pretty' } });
// pino-pretty in main process formats every line

// ✅ Fast — pretty only in dev
if (process.env.NODE_ENV === 'development') {
  // pretty
} else {
  // raw JSON to stdout — fastest path
}
```

### Python — buffer + handler

```python
import logging
from logging.handlers import QueueHandler, QueueListener
import queue

log_queue = queue.Queue()
queue_handler = QueueHandler(log_queue)
real_handler = logging.StreamHandler()
listener = QueueListener(log_queue, real_handler)
listener.start()

root_logger = logging.getLogger()
root_logger.addHandler(queue_handler)
```

Now logging never blocks; a separate thread drains the queue.

### structlog

structlog defers actual write to stdlib handlers; use the same `QueueHandler` pattern.

## Hot-path discipline

Log entry/exit at boundaries only. Don't log inside tight loops without sampling.

```ts
// ❌
for (const item of items) {
  logger.debug({ msg: 'processing item', id: item.id });  // 10000 lines for 10k items
  process(item);
}

// ✅ — log boundary
logger.info({ msg: 'batch.started', count: items.length });
for (const item of items) {
  process(item);  // no log per item
}
logger.info({ msg: 'batch.completed', count: items.length, duration_ms: ... });
```

If you genuinely need to track inside a loop, sample:

```ts
for (let i = 0; i < items.length; i++) {
  if (i % 100 === 0) {
    logger.debug({ msg: 'batch.progress', processed: i, total: items.length });
  }
  process(items[i]);
}
```

## Conditional logging

Avoid building expensive strings/objects if log level filters them out:

```ts
// ❌ — JSON.stringify runs even if debug is disabled
logger.debug({ msg: 'state', state: JSON.stringify(complexObject) });

// ✅ — Pino skips the call entirely if debug filtered
if (logger.isLevelEnabled('debug')) {
  logger.debug({ msg: 'state', state: complexObject });  // pino serializes only if logged
}
```

Pino is smart enough that simply passing the object is fine in most cases; explicit `isLevelEnabled` check is for very expensive computations.

Python:
```python
if logger.isEnabledFor(logging.DEBUG):
    logger.debug('state: %s', expensive_serialize(complex_object))
```

## Sampling

For high-volume events that you still want some visibility on:

```ts
// 1% sampling
if (Math.random() < 0.01) {
  logger.info({ msg: 'cache.hit', key });
}
```

For tracing: most APM tools (Sentry, OpenTelemetry) support `tracesSampleRate` natively.

For "always log errors, sample successes":

```ts
if (success) {
  if (Math.random() < 0.01) logger.info({ msg: 'op.success' });
} else {
  logger.error({ msg: 'op.failed', err });
}
```

## Volume control

### Per-service budget

Calculate expected volume:
- Avg log size: ~500 bytes (small JSON)
- INFO frequency: ~1-5 per request
- RPS: 100 (example)
- Daily: 100 × 86400 × 3 × 500 = ~13 GB / day uncompressed

If this exceeds your aggregator quota: sample or reduce verbosity.

### Per-event budget

```
event "http.request" — 1× per request                  → 100 events/s × 500 bytes = 50 KB/s
event "db.query"     — ~3× per request                 → 300 events/s × 800 bytes = 240 KB/s
event "cache.hit"    — ~10× per request (every check)  → 1000 events/s × 300 bytes = 300 KB/s  ← demote to DEBUG
```

`cache.hit` is the killer. Either:
- Demote to DEBUG (not logged in prod)
- Sample at 1%
- Aggregate: log a summary every 10 seconds instead of per-hit

## Aggregation patterns

When logging individual events is too noisy, log aggregated counters:

```ts
// Counter that flushes every 10s
class CacheStats {
  hits = 0; misses = 0;

  recordHit() { this.hits++; }
  recordMiss() { this.misses++; }

  start() {
    setInterval(() => {
      if (this.hits + this.misses > 0) {
        logger.info({ msg: 'cache.stats', hits: this.hits, misses: this.misses, period_s: 10 });
        this.hits = this.misses = 0;
      }
    }, 10000);
  }
}
```

One log line every 10s instead of one per cache lookup. Lose per-event detail, keep operational signal.

## Cost calculation

Aggregator pricing typically: $X per GB ingested per month.

| Aggregator | Approx cost / GB / month |
|---|---|
| Loki self-hosted | ~$0.03 (disk + electricity) |
| CloudWatch | $0.50 ingestion + $0.03 storage |
| Datadog | $1-3 |
| Better Stack | $0.50-1 |
| Sentry (logs beta) | $0.50-1 |

If you emit 100 GB/month from your app and use Datadog, that's $100-300/month just for logs. Loki self-hosted: $3-30. Worth optimising if you don't NEED Datadog's other features.

## Rotation discipline

Even if you ship to an aggregator, your local PM2 / docker logs need rotation:

```bash
# Already in your memory: pm2-logrotate
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

Don't let logs fill disk. `df -h` should never be > 80% from logs alone.

## Monitoring your monitoring

Set up alerts on:

- Log volume per service spikes 2x baseline → likely a noisy bug or runaway log
- Aggregator ingest rate spikes 2x → same
- Disk usage on PM2 / journal hosts > 80%
- Loki query latency p95 > 5s → label cardinality explosion

## Hot path summary

| Hot-path code | Log level |
|---|---|
| Inside request handler, per request | INFO (boundaries only — entry + exit) |
| Inside tight loop over many items | DEBUG (off in prod) or sampled INFO |
| Inside cache lookup | DEBUG or sampled (aggregate counter instead) |
| Inside DB query layer | DEBUG (the actual SQL); INFO only for slow queries |
| Inside scheduler tick | DEBUG only |
| Inside health-check endpoint | DEBUG or off (otherwise ~1 line per minute per replica) |

## Anti-patterns

- ❌ `logger.info` inside `setInterval(..., 100)` — 10/sec, accumulates
- ❌ JSON.stringify huge object at DEBUG level (still costs CPU even if not emitted)
- ❌ Synchronous file appender on every request
- ❌ Not rotating logs (disk fills → server OOMs)
- ❌ "Just in case" trace logs left in prod
- ❌ Logging in a `finally` clause that always fires (combined with above = volume bomb)

## Verification

Measure log volume per service:

```bash
# Last hour
journalctl -u my-service --since "1h ago" | wc -c   # bytes

# Per minute
journalctl -u my-service --since "1h ago" -o json | wc -l    # lines
# Divide by 60 → lines/min
```

If a service emits > 100 lines/sec sustained — likely noisy. Audit.
