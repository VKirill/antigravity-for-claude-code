# Recommended defaults — redis

Canonical Redis 8 production values. **All other files in this skill cite this table — do not redefine inline.** Source: `redis.io/docs`, Redis 8 release notes, ioredis docs (Context7), operational experience.

> Citation rule: every knob has a default + range + tune-up/tune-down condition + why. Cargo-culting numbers without "why" is worse than no defaults.

## Server `redis.conf`

### Memory & eviction

| Knob | Default | Range | Tune-up when | Tune-down when | Why |
|---|---|---|---|---|---|
| `maxmemory` | **70% of RAM** | 50–80% | dedicated Redis box | shared host, other RAM consumers | hard cap prevents OOM-killer; leave headroom for fork/COW during BGSAVE/BGREWRITEAOF |
| `maxmemory-policy` (cache) | **`allkeys-lru`** | `allkeys-lru` / `allkeys-lfu` / `volatile-lru` | mixed cache + ephemeral data with TTLs (`volatile-lru`) | recency-skewed access (`allkeys-lfu`) | with TTLs on every key, LRU correctly evicts cold entries |
| `maxmemory-policy` (queue / BullMQ) | **`noeviction`** | — | NEVER use eviction for queue data | — | silent eviction = catastrophic data loss; see `bullmq` skill `recommended-defaults.md` |
| `maxmemory-policy` (primary store) | **`noeviction`** | — | data is source of truth | — | eviction would corrupt your only copy |

### Persistence (RDB + AOF combinations)

| Profile | `save` (RDB) | `appendonly` | `appendfsync` | Use case |
|---|---|---|---|---|
| **Cache** | `save ""` (disabled) | `no` | — | rebuildable from DB; persistence is pure overhead |
| **Sessions / queue / general** | `save 3600 1 300 100 60 10000` (default) | `yes` | `everysec` | recommended baseline; ≤1s data loss on crash |
| **Strict durability** | default | `yes` | `always` | every write fsync'd; slower; pair with NVMe |
| **Primary data store** | default | `yes` | `everysec` + AOF + RDB | belt + suspenders |

| Knob | Default | Range | Tune-up when | Tune-down when | Why |
|---|---|---|---|---|---|
| `appendonly` | **`yes`** | yes/no | always for sessions/queue/primary | cache layer (`no`) | AOF gives ≤1s data loss vs minutes for RDB |
| `appendfsync` | **`everysec`** | `always` / `everysec` / `no` | regulatory durability (`always`) | pure cache (`no`) | `everysec` is the durability/perf sweet spot |
| `auto-aof-rewrite-percentage` | **100** | 50–200 | AOF disk full | tight rewrite cycles thrash disk | rewrites when AOF doubles; bound disk |
| `auto-aof-rewrite-min-size` | **64mb** | 32mb–512mb | larger working set | small instance | floor for rewrite trigger |

### Network & client

| Knob | Default | Range | Tune-up when | Tune-down when | Why |
|---|---|---|---|---|---|
| `tcp-keepalive` | **300** (5min) | 60–600 | long-idle pooled clients | NAT timeouts shorter | sends keepalive probes to detect dead peers |
| `timeout` | **0** (off) | 0 or 300+ | resource-constrained host | servicing long-poll clients | 0 = don't disconnect idle; >0 = idle timeout in seconds |
| `tcp-backlog` | **511** | 511–32768 | high connection churn | constrained kernel | match or be below `net.core.somaxconn` |
| `databases` | **16** | 1–16 | never use >0; ACL by user instead | — | logical DBs are an anti-pattern in cluster, deprecated |

### Replication

| Knob | Default | Range | Why |
|---|---|---|---|
| `repl-backlog-size` | **1mb** → **64mb** | 16mb–256mb | bigger backlog = replicas survive network blips without full resync |
| `repl-timeout` | **60** | 30–300 | replica → master link timeout in seconds |
| `min-replicas-to-write` | **0** | 0–N | set to 1+ for "must have replica" durability; pair with `min-replicas-max-lag` |
| `min-replicas-max-lag` | **10** | 5–30 | replicas with lag > this are not counted toward the min |

## ACL roles policy

Default users — three-tier baseline:

| User | Command set | Key pattern | TLS | Notes |
|---|---|---|---|---|
| `default` | DISABLED (`ACL SETUSER default off`) | — | — | Never connect as `default` with `~*` in app code |
| `app` | `+@read +@write +@string +@hash +@list +@set +@zset +@stream -@dangerous` | `~app:*` | required | per-app user; key prefix isolates blast radius |
| `app-readonly` | `+@read -@write -@dangerous` | `~app:*` | required | for read replicas / dashboards |
| `admin` | `+@all` | `~*` | required | break-glass only; not stored in app config |

Always: `rename-command FLUSHDB ""` `rename-command FLUSHALL ""` `rename-command CONFIG ""` (override via specific ACL grant).

## Topology choice — standalone vs sentinel vs cluster

| Topology | Use when | Pros | Cons |
|---|---|---|---|
| **Standalone** | <16 GB working set, dev, single AZ | simplest; full command surface (MULTI/EXEC across all keys) | no HA |
| **Sentinel** | Working set fits one box (≤64 GB), need HA | auto-failover; client lib transparent; full command surface | vertical scaling cap |
| **Cluster** | Working set >64 GB OR throughput >1 master | horizontal scale; sharded | MULTI/EXEC only within hash slot; some commands restricted; client complexity |

Rule of thumb: **start standalone → Sentinel for HA → Cluster only when vertical hits the wall**. Don't pre-optimize to Cluster.

## Client-side (ioredis) defaults

```ts
// Source: https://github.com/redis/ioredis/blob/main/docs/interfaces/CommonRedisOptions.html
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST ?? '127.0.0.1',
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD,
  tls: process.env.REDIS_TLS === '1' ? {} : undefined,

  maxRetriesPerRequest: 3,              // see note below
  enableReadyCheck: true,
  enableOfflineQueue: true,
  connectTimeout: 10_000,
  commandTimeout: 5_000,

  retryStrategy: (times) => {
    if (times > 20) return null;        // give up after 20 attempts
    return Math.min(times * 50, 2_000); // 50ms → cap 2s
  },

  reconnectOnError: (err) =>
    err.message.includes('READONLY') ? 2 : false, // ElastiCache failover
});
```

| Knob | App default | BullMQ override | Why |
|---|---|---|---|
| `maxRetriesPerRequest` | **3** | **`null`** (required by BullMQ) | app retries 3× then errors; BullMQ uses blocking commands and **requires** unbounded retries |
| `enableReadyCheck` | **`true`** | true | wait for INFO before emitting `ready` |
| `enableOfflineQueue` | **`true`** | true | queue commands while reconnecting |
| `retryStrategy` | exponential cap 2s | exponential cap 5s | bound reconnect storms |
| `connectTimeout` | **10000** ms | — | fail fast if TCP can't establish |
| `commandTimeout` | **5000** ms | — | non-blocking commands shouldn't take >5s |

> BullMQ note: pass the **config object** (literal) to `Queue`/`Worker`/`QueueEvents` — never share a live `new Redis()` instance between `Worker` and the other two. See `bullmq` skill `recommended-defaults.md`.

## Stream consumer-group timing (XACK / XAUTOCLAIM)

For Streams consumer groups (`XREADGROUP` → process → `XACK`):

| Knob | Default | Range | Why |
|---|---|---|---|
| `XREADGROUP ... BLOCK ms` | **5000** ms | 1000–30000 | block window for new entries; balance latency vs CPU |
| `XREADGROUP ... COUNT n` | **10** | 1–100 | batch size; downstream throughput vs in-flight ack risk |
| `XAUTOCLAIM ... min-idle-time ms` | **60000** ms (1 min) | 30000–300000 | how long a pending entry sits before another consumer can claim it |
| `XAUTOCLAIM ... COUNT n` | **100** | 10–500 | claim batch size; sweep on a timer |

Pattern: dedicated "claim" loop every `min-idle-time / 2` calls `XAUTOCLAIM` to rescue stuck entries from dead consumers. See `references/pub-sub-and-streams.md`.

## TTL strategies (cache keys)

| Knob | Default | Range | Why |
|---|---|---|---|
| Base TTL | **300s** (5 min) | 60–86400 | per access pattern; rebuild cost dictates upper bound |
| TTL jitter | **±10%** | ±5–20% | avoid synchronized expiry causing dogpile |
| Early-refresh probability | **0.01** at TTL/2 | 0.001–0.1 | probabilistic early refresh (XFetch algorithm) |
| Lock TTL (`SET NX EX`) | **30s** | 5–300 | stampede lock; bound by max work time |

## Tuning guidance

- **Memory grows unbounded** → check `INFO memory` for `mem_fragmentation_ratio` >1.5; consider `MEMORY PURGE` / restart. Confirm TTLs are set on cache keys (`redis-cli scan 0 match 'cache:*' | head` → `TTL k` → expect positive number).
- **Replication lag** → increase `repl-backlog-size`; check `INFO replication` `master_repl_offset` vs `slave_repl_offset` delta.
- **AOF grows unbounded** → tune `auto-aof-rewrite-percentage` lower; verify `BGREWRITEAOF` runs.
- **Slow log noisy** → `redis-cli SLOWLOG GET 25` to inspect; long entries usually = `KEYS`/`HGETALL`/`SMEMBERS` on big keys.

## Citation rule

Other files in this skill MUST NOT redefine these values inline. Use:

> Defaults: see [recommended-defaults.md](recommended-defaults.md).

## Last verified

2026-05-15 against Redis 8.x docs (`redis.io/docs`), ioredis v5.x docs (Context7).
