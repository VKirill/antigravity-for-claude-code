# Redis — Caching Patterns

## Cache-aside (lazy load)

The most common pattern. App is responsible for cache management.

```ts
async function getUser(id: string): Promise<User | null> {
  const key = `user:${id}`;
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const user = await db.user.findUnique({ where: { id } });
  if (user) await redis.set(key, JSON.stringify(user), 'EX', 300);  // 5 min TTL
  return user;
}

async function updateUser(id: string, data: Partial<User>) {
  const user = await db.user.update({ where: { id }, data });
  await redis.del(`user:${id}`);   // invalidate; next read repopulates
  return user;
}
```

Pros: simple, no consistency issues if you invalidate on write. Cons: cold reads always hit DB.

## Write-through

App writes to BOTH cache and DB synchronously.

```ts
async function updateUser(id: string, data: Partial<User>) {
  const user = await db.user.update({ where: { id }, data });
  await redis.set(`user:${id}`, JSON.stringify(user), 'EX', 300);
  return user;
}
```

Pros: cache always warm. Cons: extra write latency; cache write can fail.

## Write-behind (write-back)

App writes to cache, async flushes to DB. Used for high-throughput counters.

```ts
await redis.incr(`pageviews:${pageId}`);
// Background worker:
const views = await redis.getdel(`pageviews:${pageId}`);
await db.page.update({ where: { id: pageId }, data: { views: { increment: Number(views) } } });
```

Risk: data loss if Redis crashes between increment and flush. Use only for tolerable-loss data.

## TTL strategy

```ts
// Bad — exact same TTL for all entries → thundering-herd expiry
await redis.set(key, value, 'EX', 3600);

// Good — ±10% jitter
const ttl = 3600 + Math.floor(Math.random() * 720) - 360;
await redis.set(key, value, 'EX', ttl);
```

Without jitter, many entries expire at the same second → simultaneous cache misses → DB overload.

## Stampede protection

When a hot key expires, many concurrent requests can flood the DB. Three approaches:

### 1) `SET NX` lock

```ts
async function getWithLock(key: string, fetcher: () => Promise<string>): Promise<string> {
  const cached = await redis.get(key);
  if (cached) return cached;

  const lockKey = `lock:${key}`;
  const token = crypto.randomUUID();
  const acquired = await redis.set(lockKey, token, 'NX', 'EX', 10);

  if (acquired) {
    try {
      const fresh = await fetcher();
      await redis.set(key, fresh, 'EX', 300);
      return fresh;
    } finally {
      // Release only if we still own it (avoid deleting someone else's lock)
      await redis.eval(
        "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0",
        1, lockKey, token,
      );
    }
  } else {
    // Another worker is fetching; wait + retry
    await new Promise((r) => setTimeout(r, 50));
    return getWithLock(key, fetcher);
  }
}
```

### 2) Probabilistic early refresh

```ts
async function get(key: string, fetcher: () => Promise<string>): Promise<string> {
  const [val, ttl] = await redis.pipeline().get(key).ttl(key).exec()!.then((r) => [r[0][1], r[1][1]]);
  if (val) {
    // Refresh probabilistically as TTL approaches 0 (xfetch algorithm)
    const beta = 1.0;
    if (Math.random() < beta * Math.log(Math.random()) / -3600) {
      // background refresh
      fetcher().then((fresh) => redis.set(key, fresh, 'EX', 3600));
    }
    return val as string;
  }
  const fresh = await fetcher();
  await redis.set(key, fresh, 'EX', 3600);
  return fresh;
}
```

Each request has a small chance to refresh early. As TTL → 0, the probability rises. Only one worker (in expectation) refreshes.

### 3) Request coalescing (in-process)

```ts
const inflight = new Map<string, Promise<string>>();

async function get(key: string, fetcher: () => Promise<string>) {
  const cached = await redis.get(key);
  if (cached) return cached;

  if (inflight.has(key)) return inflight.get(key)!;

  const p = (async () => {
    const fresh = await fetcher();
    await redis.set(key, fresh, 'EX', 300);
    return fresh;
  })();
  inflight.set(key, p);
  try { return await p; }
  finally { inflight.delete(key); }
}
```

Within a single Node process, only one fetch per key in flight.

## Invalidation strategies

### Direct invalidation

```ts
await redis.del(`user:${id}`);
```

Simple. Loses cache on every write. Best for low-write workloads.

### Tag-based invalidation

```ts
// On write
await redis.sadd(`tag:user`, `user:${id}`);
await redis.set(`user:${id}`, value, 'EX', 300);

// To invalidate all users:
const keys = await redis.smembers('tag:user');
await redis.del(...keys, 'tag:user');
```

### TTL-only (no invalidation)

For data that can be slightly stale (popular product listings, leaderboard top-10), just rely on short TTLs (60s) and skip invalidation entirely.

## Negative caching

Cache the "not found" too:

```ts
async function get(id: string) {
  const v = await redis.get(`user:${id}`);
  if (v === '__NOT_FOUND__') return null;
  if (v) return JSON.parse(v);

  const user = await db.user.findUnique({ where: { id } });
  if (!user) {
    await redis.set(`user:${id}`, '__NOT_FOUND__', 'EX', 60);  // short TTL
    return null;
  }
  await redis.set(`user:${id}`, JSON.stringify(user), 'EX', 300);
  return user;
}
```

Prevents repeated DB lookups for non-existent keys (e.g., probing 404s).

## Serialization

JSON is universal but slow. For hot paths consider:

- **MessagePack** (`msgpack-lite`) — ~2× faster, smaller
- **CBOR**
- **Protobuf** — pre-compiled schemas; fastest

`redis-om` does this transparently for indexed fields.

## Memory limit + eviction

```conf
maxmemory 4gb
maxmemory-policy allkeys-lru
```

Policies:
- `noeviction` (default) — errors on OOM
- `allkeys-lru` — evict least-recently-used
- `allkeys-lfu` — evict least-frequently-used
- `volatile-lru` — only keys with TTL set
- `volatile-ttl` — evict shortest TTL first
- `allkeys-random` / `volatile-random`

For pure cache, `allkeys-lfu` works well. For mixed (cache + session), `volatile-lru` (only evict TTL'd keys).

## Common mistakes

- ❌ Forgetting TTL → unbounded memory growth
- ❌ Same TTL for many keys → thundering herd
- ❌ Storing huge JSON blobs as single keys (>1 MB) → bandwidth and serialization cost
- ❌ Not handling cache-miss-during-flush race — use `SET NX` lock
- ❌ Caching tenant-specific data without namespacing → tenant A sees tenant B's data
- ❌ Storing rendered HTML when raw JSON would do — caches less useful payload
- ❌ Caching write-heavy data — cache thrash
