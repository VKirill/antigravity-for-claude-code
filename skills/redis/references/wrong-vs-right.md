# Wrong vs Right — redis

Preventive code pairs for `risk: high-stakes` Redis usage. Each block: ❌ wrong / ✅ right / **Why it matters**.

---

## 1. TTL on cache keys

**❌ Wrong — cache key with no expiry:**
```ts
await redis.set(`user:${id}`, JSON.stringify(user));
```

**✅ Right — TTL on every cache write:**
```ts
const base = 300;
const jitter = Math.floor(Math.random() * 30); // ±10%
await redis.set(`user:${id}`, JSON.stringify(user), 'EX', base + jitter);
```

**Why it matters:** without TTL, cache keys accumulate forever — Redis OOMs and rejects writes. Jitter prevents synchronized expiry that dogpiles your DB. See `troubleshooting.md` "Keyspace explosion".

---

## 2. Iteration — `KEYS` vs `SCAN`

**❌ Wrong — `KEYS` blocks the server:**
```ts
const all = await redis.keys('cache:*');   // O(N) on entire keyspace
for (const k of all) await redis.del(k);   // worse: per-key roundtrip
```

**✅ Right — `SCAN` with cursor, batched `UNLINK`:**
```ts
const stream = redis.scanStream({ match: 'cache:*', count: 1000 });
for await (const batch of stream) {
  if (batch.length) await redis.unlink(...batch);  // UNLINK is async DEL
}
```

**Why it matters:** `KEYS *` on a million keys blocks Redis for seconds — every other client times out. `SCAN` is incremental, `UNLINK` reclaims memory asynchronously.

---

## 3. Distributed lock release

**❌ Wrong — release lock without ownership check:**
```ts
await redis.set('lock:resource', '1', 'NX', 'EX', 30);
// ... work that takes 35 seconds (lock expired at 30s) ...
await redis.del('lock:resource');         // releases someone else's lock!
```

**✅ Right — release only if you own it (Lua atomic CAS):**
```ts
import { randomUUID } from 'node:crypto';

const token = randomUUID();
const acquired = await redis.set('lock:resource', token, 'NX', 'EX', 30);
if (acquired !== 'OK') throw new Error('lock contended');

try {
  // ... work ...
} finally {
  await redis.eval(
    `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end`,
    1, 'lock:resource', token,
  );
}
```

**Why it matters:** if your lock expires and another worker acquires it, your stale `DEL` releases their lock and two workers run concurrently. Atomic compare-and-delete in Lua is the only safe path.

---

## 4. maxmemory-policy for queue-backing Redis

**❌ Wrong — eviction policy on Redis backing BullMQ:**
```
# redis.conf
maxmemory 4gb
maxmemory-policy allkeys-lru     # silently evicts queue jobs under memory pressure
```

**✅ Right — `noeviction` for queue data:**
```
# redis.conf
maxmemory 4gb
maxmemory-policy noeviction      # writes reject when full — alert + scale
```

**Why it matters:** silent eviction of a BullMQ job is catastrophic — there is no recovery. `noeviction` makes the problem visible (`OOM` errors that page the operator) instead of invisible (lost work, customers refunded later). See `bullmq` skill `references/recommended-defaults.md`.

---

## 5. Pub/Sub vs Streams for important events

**❌ Wrong — Pub/Sub for payment confirmations:**
```ts
// publisher
await redis.publish('payments', JSON.stringify(event));
// subscriber:
await sub.subscribe('payments');
sub.on('message', (_ch, msg) => handle(JSON.parse(msg)));
// subscriber offline → message lost forever; no replay
```

**✅ Right — Streams with consumer groups + ack:**
```ts
// producer
await redis.xadd('payments', '*', 'event', JSON.stringify(event));

// consumer
await redis.xgroup('CREATE', 'payments', 'workers', '$', 'MKSTREAM').catch(() => {}); // ignore BUSYGROUP

while (true) {
  const entries = await redis.xreadgroup(
    'GROUP', 'workers', 'me',
    'COUNT', 10, 'BLOCK', 5000,
    'STREAMS', 'payments', '>',
  );
  if (!entries) continue;
  for (const [, msgs] of entries) {
    for (const [id, fields] of msgs) {
      await handle(fields);
      await redis.xack('payments', 'workers', id);
    }
  }
}

// separate timer: rescue stalled entries from dead consumers
setInterval(async () => {
  const claimed = await redis.xautoclaim('payments', 'workers', 'me', 60_000, '0', 'COUNT', 100);
  // process claimed[1] same way as above
}, 30_000);
```

**Why it matters:** Pub/Sub is fire-and-forget — offline subscribers miss messages permanently, and there's no acknowledgment. Streams persist, support replay on consumer restart, and `XAUTOCLAIM` rescues entries from crashed consumers. For anything where loss has business cost, use Streams. See `pub-sub-and-streams.md` and `recommended-defaults.md` stream timing.

---

## 6. Connection sharing — Pub/Sub vs normal commands

**❌ Wrong — one client doing both subscribe and commands:**
```ts
const redis = new Redis();
await redis.subscribe('events');
await redis.set('k', 'v');  // ERROR: connection in subscriber mode
```

**✅ Right — separate clients per role:**
```ts
const pub = new Redis();   // for normal commands
const sub = new Redis();   // dedicated to subscribe

await sub.subscribe('events');
sub.on('message', (_ch, msg) => handle(msg));

await pub.set('k', 'v');   // works
await pub.publish('events', 'hi');  // works (publish doesn't block)
```

**Why it matters:** once a connection enters subscribe mode it can only run subscribe-family commands until unsubscribed. Mixing the two on one client causes silent breakage in tests, explicit errors in prod.

---

## When to add a new pair

Add when:
- A junior or LLM is likely to write the ❌ version (it compiles, "looks right")
- The wrong version fails silently or only under load
- The fix is non-obvious from the docs

Keep each side under 15 lines. If you need more, the example is doing too much — split into separate sections.
