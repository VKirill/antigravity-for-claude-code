---
name: redis
description: "Redis 8 — in-memory data store. Cache, sessions, rate limiting, pub/sub, streams, hash field TTL, vector search. Use when: redis, redis 8, ioredis, node-redis, redis-om, valkey, SET EX, GETEX, HSET, HEXPIRE, LPUSH, RPOPLPUSH, ZADD, ZRANGEBYSCORE, XADD, XREADGROUP, consumer group, SUBSCRIBE, PUBLISH, MULTI EXEC pipeline, Lua EVAL, BITFIELD, BITOP, HyperLogLog PFADD, GEO commands, Redis Streams, RedisJSON, RediSearch FT.SEARCH, RedisInsight, RDB, AOF, AOF rewrite, cluster, sentinel, ACL. SKIP: BullMQ queue patterns (→bullmq), Memcached, Valkey-only forks."
stacks:
  - redis
  - cache
  - nodejs-backend
  - linux
packages:
  - ioredis
  - redis
  - redis-om
  - "@redis/json"
  - "@redis/search"
tags:
  - redis
  - cache
  - session
  - pubsub
  - streams
  - rate-limit
  - vector-search
manifests:
  - redis.conf
source: vechkasov-global-skills
risk: high-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- Redis: `8.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->

## Usage

Loaded automatically when its description matches the active task. Read only the section you need.

## Use this skill when

- Using Redis 8 as a cache, session store, distributed lock, rate-limit backend, or queue substrate
- Picking a client — `ioredis` (Node default) vs `node-redis` (official) vs `redis-om` (object mapper)
- Designing cache-aside / write-through patterns with TTL strategies and stampede protection
- Picking the right data structure (string/list/hash/set/zset/stream/HLL/GEO/bitmap)
- Building Pub/Sub channels or Streams consumer groups (`XREADGROUP` / `XACK` / `XAUTOCLAIM`)
- Configuring persistence (RDB + AOF) and replication / Sentinel / Cluster
- Setting up ACLs, TLS, and command renaming for production lockdown
- Adopting Redis 8 features — hash field TTL (`HEXPIRE`), enhanced FT.SEARCH, vector data type
- Tuning `maxmemory` / `maxmemory-policy` per use case (cache vs queue vs primary store)
- Distinguishing Redis (BSL/SSPLv1) from **Valkey** (LF Apache-2.0 fork after 7.4) when picking deployment

## Do not use this skill when

- Task is BullMQ queue / worker / job options — use `bullmq`
- Task is Memcached (different protocol, no persistence) — out of scope
- Task is Valkey-fork-only patterns (post-Redis 7.4 OSS branch) — note the distinction but use this skill (commands are >99% identical)
- Task is a generic cache layer concept without Redis specifics — use `nodejs`
- Task is Postgres `LISTEN`/`NOTIFY` — use `postgresql`

## Purpose

Redis 8 is the dominant in-memory data store in 2026 — cache, session store, distributed lock, queue (lists/streams), pub/sub broker, leaderboard/counter, feature store. Redis 8 unified the former Redis Stack modules (RedisJSON, RediSearch, RedisTimeSeries, RedisBloom) into the core binary. Hash field TTL (`HEXPIRE`/`HTTL`/`HPERSIST`, introduced in 7.4 and tightened in 8.x), enhanced FT.SEARCH with expiring fields, and vector data types are the Redis 8 highlights.

This skill covers all 9 data structures, client choice, caching patterns, pub/sub and Streams, persistence/replication, cluster/sentinel topology, ACL/TLS, Redis 8 specifics, recommended defaults, and symptom-indexed troubleshooting.

What this skill does NOT do: BullMQ queue semantics (see `bullmq`), raw Linux tuning (see `linux-sysadmin`), Memcached, or framework-specific Redis decorators (those have their own skills).

## Capabilities

Each line below points to the canonical reference. The reference owns code, edge cases, and gotchas — do not duplicate them here.

- **Data structures (9 core)** — strings, lists, hashes, sets, sorted sets, streams, HyperLogLog, GEO, bitmaps. → [data-structures.md](references/data-structures.md)
- **Clients** — `ioredis` default; `node-redis` (`import { createClient } from 'redis'`); `redis-om` (`import { Schema, Repository } from 'redis-om'`). → [clients.md](references/clients.md)
- **Caching patterns** — cache-aside, write-through, TTL jitter, stampede protection (SET NX EX lock). → [caching-patterns.md](references/caching-patterns.md)
- **Pub/Sub & Streams** — fire-and-forget vs persistent log; consumer groups; `XAUTOCLAIM` rescue. → [pub-sub-and-streams.md](references/pub-sub-and-streams.md)
- **Persistence & replication** — RDB + AOF combinations, `appendfsync` tradeoffs, `WAIT N` semi-sync. → [persistence-and-replication.md](references/persistence-and-replication.md)
- **Cluster & Sentinel** — when to use which; hash tags for `MULTI`/`EXEC`; failover. → [cluster-and-sentinel.md](references/cluster-and-sentinel.md)
- **ACL & security** — three-tier user policy, command rename, TLS. → [acl-and-security.md](references/acl-and-security.md)
- **Redis 8 what's new** — hash field TTL, FT.SEARCH integration, vector type, license context (BSL vs Valkey). → [redis-8-whats-new.md](references/redis-8-whats-new.md)
- **Recommended defaults** — canonical values for `maxmemory-policy`, AOF, replication, ioredis client options, stream timing. → [recommended-defaults.md](references/recommended-defaults.md)
- **Troubleshooting** — symptom-indexed: OOM, replication broken, AOF growth, client timeout floods, slow SAVE, Sentinel split-brain, cluster slot move, eviction misfire, MISCONF, ACL denial, keyspace explosion. → [troubleshooting.md](references/troubleshooting.md)

## Behavioral Traits

- Always sets a TTL on cache keys — never bare `SET` for cache use
- Uses `SET key value EX 300` (not `SETEX`) — composes with `NX`/`XX`
- Uses `SCAN`/`HSCAN`/`SSCAN`/`ZSCAN` for iteration — never `KEYS`/`HGETALL` on big keys
- Adds ±10% jitter to cache TTLs to avoid thundering-herd expiry
- Uses `SET NX EX` + Lua release for distributed locks (release only if you own it)
- Uses pipelining for >5 sequential commands on the same connection
- Prefers Streams (`XREADGROUP` + `XACK`) over Pub/Sub for production events
- Names keys hierarchically: `entity:id:field` (`user:123:profile`, `cache:posts:popular`)
- Distinguishes by use: string for cache, hash for object, sorted set for queue/leaderboard, stream for event log
- Sets `maxmemory-policy` per use case: `allkeys-lru` for cache, `noeviction` for queue/primary store (see [recommended-defaults.md](references/recommended-defaults.md))
- Pairs `ioredis` `maxRetriesPerRequest: 3` for app code; `null` only when shared with BullMQ

## Important Constraints

- NEVER `KEYS pattern` in production — blocks the server; use `SCAN`
- NEVER `FLUSHDB` / `FLUSHALL` in prod — disable via `rename-command FLUSHDB ""`
- NEVER trust Pub/Sub for at-least-once delivery — use Streams with consumer groups + ack
- NEVER share one Redis connection for Pub/Sub subscribe AND normal commands — subscribers block
- NEVER set `maxmemory-policy` to any eviction policy on a Redis backing BullMQ queues — silent data loss
- NEVER deploy without persistence in prod (AOF + RDB)
- NEVER use `SAVE` (synchronous) in production — use `BGSAVE`
- NEVER connect as `default` user with `~*` in app code — define a scoped ACL user
- ALWAYS set `maxmemory` and a policy — default behavior on overflow is to reject writes
- ALWAYS use TLS for cross-network Redis traffic
- ALWAYS set TTL on cache writes (`SET k v EX 300`)
- ALWAYS pass `maxRetriesPerRequest: null` to ioredis when the connection is shared with BullMQ

## Wrong vs Right

Six preventive ❌/✅ pairs with "Why it matters" — TTL on cache keys, `SCAN` vs `KEYS`, distributed lock atomic release, `noeviction` for queue-backing Redis, Streams vs Pub/Sub for important events, Pub/Sub connection separation. → [references/wrong-vs-right.md](references/wrong-vs-right.md)

## Related Skills

### Runtime
- ✓ `nodejs` — Node 24 client host
- ✓ `typescript` — typed wrappers around ioredis / node-redis

### Web frameworks
- ✓ `fastify` — `@fastify/redis` decorator
- ✓ `hono` — Hono + ioredis on Node; Upstash REST on Workers
- ✓ `nextjs` — Server Action caching, session store
- ✓ `nuxt` — Nitro `useStorage` Redis driver

### Database & queue
- ✓ `postgresql` — pair for cache-aside, idempotency keys
- ✓ `prisma` — Prisma result caching via Redis
- ✓ `bullmq` — BullMQ runs on Redis; sets `noeviction` constraint

### Deploy & ops
- ✓ `linux-sysadmin` — Ubuntu 24.04, systemd, redis-cli, Sentinel/Cluster ops
- `docker` — Redis container [cascade marker]

### Domain
- ✓ `telegram-bot` — session/state via Redis
- ✓ `cloudpayments` / ✓ `yookassa` — idempotency-key cache, webhook dedup

### Code discipline
- ✓ `karpathy-guidelines`

## API Reference

Domain-specific references (Pattern 2) — load only what's relevant:

| Topic | File |
|---|---|
| Data structures — strings/lists/hashes/sets/zsets/streams/geo/hll/bitmap | [references/data-structures.md](references/data-structures.md) |
| Clients — ioredis (`import Redis from 'ioredis'`) / node-redis (`import { createClient } from 'redis'`) / redis-om | [references/clients.md](references/clients.md) |
| Caching patterns — cache-aside, write-through, TTL jitter, stampede protection | [references/caching-patterns.md](references/caching-patterns.md) |
| Pub/Sub & Streams — channels, `XADD`/`XREADGROUP`, consumer groups, `XAUTOCLAIM` | [references/pub-sub-and-streams.md](references/pub-sub-and-streams.md) |
| Persistence & replication — RDB, AOF, `appendfsync`, `WAIT N`, replication lag | [references/persistence-and-replication.md](references/persistence-and-replication.md) |
| Cluster & Sentinel — sharding, hash tags, `MULTI`/`EXEC` limits, failover | [references/cluster-and-sentinel.md](references/cluster-and-sentinel.md) |
| ACL & security — three-tier user policy, `~pattern` keys, TLS, command rename | [references/acl-and-security.md](references/acl-and-security.md) |
| Redis 8 what's new — hash field TTL, FT.SEARCH, vector data type, license (BSL vs Valkey) | [references/redis-8-whats-new.md](references/redis-8-whats-new.md) |
| **Recommended defaults** — `maxmemory-policy` matrix, AOF, replication, ioredis options, stream timing | [references/recommended-defaults.md](references/recommended-defaults.md) |
| **Troubleshooting** — symptom-indexed: OOM, replication broken, AOF growth, MISCONF, slow SAVE, split-brain, slot move, eviction misfire, ACL denial, keyspace explosion | [references/troubleshooting.md](references/troubleshooting.md) |
| **Wrong vs Right** — 6 preventive code pairs (TTL/SCAN/lock release/noeviction/Streams/pub-sub split) | [references/wrong-vs-right.md](references/wrong-vs-right.md) |
| Eval cases | [references/eval-cases.md](references/eval-cases.md) |

### Templates

| Template | File |
|---|---|
| `ioredis` setup with retry / TLS / error handler | [templates/ioredis-setup.ts.template](templates/ioredis-setup.ts.template) |
| Cache-aside with stampede protection (`SET NX EX` lock) | [templates/cache-aside.ts.template](templates/cache-aside.ts.template) |
| Streams consumer group with `XAUTOCLAIM` of stalled jobs | [templates/streams-consumer.ts.template](templates/streams-consumer.ts.template) |

### Examples

| Scenario | File |
|---|---|
| Rate limiter — token bucket via Lua `EVAL` script | [examples/rate-limiter-lua.md](examples/rate-limiter-lua.md) |
| Session store backed by Redis hash + TTL refresh | [examples/session-store.md](examples/session-store.md) |

**How to use**: open the specific topic file. Cache → `caching-patterns.md`. Events → `pub-sub-and-streams.md`. Production setup → `persistence-and-replication.md` + `cluster-and-sentinel.md` + `acl-and-security.md`. Tuning → `recommended-defaults.md`. Incidents → `troubleshooting.md`.
