# Redis — Pub/Sub & Streams

## Pub/Sub — fire-and-forget

```ts
// Subscriber (separate connection from regular commands!)
const sub = new Redis();
await sub.subscribe('events');
sub.on('message', (channel, message) => {
  console.log(channel, JSON.parse(message));
});

// Pattern subscribe
await sub.psubscribe('events.*');
sub.on('pmessage', (pattern, channel, message) => { /* ... */ });

// Publisher
await redis.publish('events', JSON.stringify({ type: 'hello' }));
```

Semantics:
- **No persistence** — if no subscriber is connected when `PUBLISH` runs, the message is lost
- **No backpressure** — fast publishers can overwhelm slow subscribers
- **Per-channel; channels are ephemeral** — `PUBSUB CHANNELS` lists active

Use for: server-side broadcast (e.g., signal config change), heartbeats, ephemeral UI updates.

**Don't use** for: order events, audit logs, anything requiring delivery guarantees. Use Streams.

## Streams — persisted, consumer groups, ack

```
XADD stream * field1 v1 field2 v2     -- add entry; * = auto-id (ms-timestamp-N)
XADD stream MAXLEN ~ 10000 * ...       -- bounded with approx trim (~10k entries)
```

```ts
await redis.xadd('events', '*', 'type', 'order.paid', 'orderId', '42', 'amount', '1000');
```

### Consumer groups

Group lets multiple consumers split work. Each entry goes to exactly one consumer in the group; consumers ack to mark "done".

```
XGROUP CREATE events orders-processors $ MKSTREAM   -- $ = start at "now"
```

```ts
// Consumer loop
while (running) {
  const result = await redis.xreadgroup(
    'GROUP', 'orders-processors', 'consumer-1',
    'COUNT', 10,
    'BLOCK', 5000,
    'STREAMS', 'events', '>',          // > = entries not yet delivered to this consumer
  );
  if (!result) continue;

  const [[, entries]] = result;
  for (const [id, fields] of entries) {
    try {
      await process(fields);
      await redis.xack('events', 'orders-processors', id);
    } catch (err) {
      console.error('process failed; will be re-delivered', err);
      // Don't XACK — Redis will eventually deliver to another consumer
    }
  }
}
```

### Pending entries list (PEL)

Entries delivered but not yet acked sit in PEL. If a consumer crashes, those entries are recoverable.

```
XPENDING events orders-processors           -- summary
XPENDING events orders-processors IDLE 60000 - + 100 consumer-2     -- detailed
```

### Claiming stalled entries

If a consumer is dead, another consumer can take over its un-acked entries:

```ts
// Claim entries idle > 60s, ack-style
const claimed = await redis.xautoclaim(
  'events', 'orders-processors', 'consumer-1',
  60000,           // min-idle ms
  '0-0',            // start ID
  'COUNT', 100,
);
const [nextCursor, entries] = claimed;
for (const [id, fields] of entries) {
  // process as if just received
}
```

`XAUTOCLAIM` is the recommended modern approach (Redis 6.2+); replaces `XPENDING` + `XCLAIM` patterns.

### Trimming

Streams grow unbounded by default. Trim by length or age:

```
XADD events MAXLEN ~ 100000 * ...       -- approximate trim per insert
XTRIM events MAXLEN 100000               -- exact trim
XTRIM events MINID 1700000000000-0       -- trim entries older than this ID
```

`~` is approximate (faster) — uses macro-nodes. Use it unless you need exact bounds.

### Stream IDs

Auto-IDs: `<ms>-<seq>` (e.g., `1700000000000-0`). Monotonically increasing. Custom IDs allowed (`XADD stream 12345-0 ...`).

`$` = "last existing ID" (start consuming new only). `0` = from beginning. `>` (in `XREADGROUP`) = new for this consumer.

### Single-consumer Streams (without groups)

```ts
await redis.xread('COUNT', 10, 'BLOCK', 5000, 'STREAMS', 'events', lastSeenId);
```

Use when you want at-least-once but only one consumer.

## When to pick which

| Need | Tool |
|---|---|
| Broadcast to all connected listeners (ephemeral, e.g., WebSocket fanout) | **Pub/Sub** |
| Order processing, payment confirmations (durable) | **Streams** |
| Multi-worker fan-out (each event processed once) | **Streams + consumer group** |
| At-least-once with retry on crash | **Streams** |
| Job queue with retries, delays, priorities | **BullMQ** (built on top of Redis structures) |

## Streams vs Kafka (high-level)

| | Redis Streams | Kafka |
|---|---|---|
| Persistence | RDB/AOF | Disk log |
| Throughput | ~100k entries/s per shard | Millions/s per shard |
| Retention | TTL or MAXLEN | Time/size-based |
| Setup | Single binary | ZooKeeper / Kraft, brokers |
| Consumer groups | Yes | Yes |
| Ordering | Per-stream | Per-partition |
| Backpressure | None | Yes |
| Use case | Apps with existing Redis | Org-wide event bus |

Redis Streams covers ~80% of Kafka use cases for small/medium scale without the operational burden.

## Patterns

### Outbox via Streams

Application writes domain events to a Stream in the same transaction (via `MULTI` + `XADD`):

```ts
await redis.multi()
  .set(`order:${id}`, JSON.stringify(order))
  .xadd('events', '*', 'type', 'order.created', 'orderId', id)
  .exec();
```

A consumer reads the stream and pushes to webhooks / other services.

### SSE / WebSocket fanout

Browser subscribes to SSE → server reads from Stream → pushes to client. Use `XREAD BLOCK` for low-latency tailing.

### Replay

Restart a consumer with `XREADGROUP ... STREAMS events 0` (instead of `>`) → re-reads PEL only. To replay from scratch, drop the group: `XGROUP DESTROY events grp` and recreate from `0`.

## Anti-patterns

- ❌ Sharing the subscriber connection with regular commands
- ❌ Using Pub/Sub for production event flows that need guaranteed delivery
- ❌ Forgetting `MAXLEN` → stream grows to infinity
- ❌ Acking before processing → loses event on crash
- ❌ Acking on retryable failure → never recovered
- ❌ One consumer name across processes — IDs collide; use unique names per worker (`hostname-pid`)
