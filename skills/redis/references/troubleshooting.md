# Troubleshooting — redis

Symptom-indexed. Find what the user sees → diagnose with bash one-liners → identify the cause → apply paste-runnable fix. Required for `risk: high-stakes` skills per skill-evaluation v3.

---

## OOM: `OOM command not allowed when used memory > 'maxmemory'`

**Symptoms**
- Writes reject with `OOM` error from client
- `redis-cli INFO memory` shows `used_memory_human` ≥ `maxmemory_human`
- App logs flood with `ReplyError: OOM`

**Diagnose**
```bash
redis-cli INFO memory | grep -E "used_memory_human|maxmemory_human|maxmemory_policy|mem_fragmentation_ratio"
redis-cli --bigkeys                                    # finds top hash/list/zset by size
redis-cli MEMORY STATS | head -40
redis-cli MEMORY USAGE somekey
# Count keys without TTL — the usual culprit
redis-cli --scan --pattern '*' | head -1000 | xargs -I{} redis-cli TTL {} | grep -c "^-1$"
```

**Common causes**
- ❌ `maxmemory-policy noeviction` on a pure cache → writes fail when full
- ❌ Cache keys created without TTL (`SET k v` instead of `SET k v EX 300`)
- ❌ `maxmemory-policy allkeys-lru` on a BullMQ-backed Redis → queue data silently evicted (CATASTROPHIC; see `recommended-defaults.md`)
- ❌ Big keys: a single hash/zset with millions of fields
- ❌ Fragmentation: `mem_fragmentation_ratio` > 1.5

**Fix**
```bash
# Cache use case
redis-cli CONFIG SET maxmemory-policy allkeys-lru
redis-cli CONFIG REWRITE                # persists to redis.conf

# Add TTLs to existing cache keys (one-off backfill)
redis-cli --scan --pattern 'cache:*' | while read k; do
  redis-cli TTL "$k" | grep -q "^-1$" && redis-cli EXPIRE "$k" 600 > /dev/null
done

# Defragment (Redis ≥4.0 active defrag)
redis-cli CONFIG SET activedefrag yes

# Last resort — restart releases fragmented memory (loses ≤1s of AOF data)
systemctl restart redis-server
```

See `recommended-defaults.md` for the policy matrix per use case.

---

## `MISCONF Redis is configured to save RDB snapshots, but is currently not able to persist on disk`

**Symptoms**
- All writes reject with `MISCONF` error
- Read operations still succeed
- Redis log shows `Background saving error` / `Can't save in background: fork: Cannot allocate memory`

**Diagnose**
```bash
redis-cli INFO persistence | grep -E "rdb_last_bgsave_status|aof_last_write_status|rdb_changes_since_last_save"
df -h /var/lib/redis                                    # disk space
free -h                                                 # RAM headroom for fork() COW
ls -la /var/lib/redis/                                  # permissions on data dir
tail -50 /var/log/redis/redis-server.log
```

**Common causes**
- ❌ Disk full on `/var/lib/redis`
- ❌ `vm.overcommit_memory=0` rejects fork() when RAM is tight (fork needs reserve = current RSS)
- ❌ Permission denied on data dir (wrong owner after manual file copy)
- ❌ BGSAVE blocked by an existing child process

**Fix**
```bash
# Disk space
df -h && du -xsh /var/lib/redis/*

# Allow overcommit so BGSAVE fork succeeds under memory pressure
echo 'vm.overcommit_memory = 1' | sudo tee /etc/sysctl.d/99-redis.conf
sudo sysctl -p /etc/sysctl.d/99-redis.conf

# Permissions
sudo chown -R redis:redis /var/lib/redis
sudo chmod 750 /var/lib/redis

# Allow writes while you fix the root cause (DO NOT leave on)
redis-cli CONFIG SET stop-writes-on-bgsave-error no
```

---

## Replication broken — replica can't sync, link down

**Symptoms**
- `redis-cli INFO replication` on replica: `master_link_status: down`
- `master_last_io_seconds_ago` rising
- Replica lag (`slave_repl_offset`) frozen behind `master_repl_offset`

**Diagnose**
```bash
# On master
redis-cli INFO replication
redis-cli CLIENT LIST type replica

# On replica
redis-cli INFO replication | grep -E "role|master_link|master_last_io"
redis-cli ROLE
tail -100 /var/log/redis/redis-server.log | grep -iE "replication|sync|partial"

# Network reachability
nc -zv MASTER_HOST 6379
```

**Common causes**
- ❌ Network partition / firewall closed 6379 to master
- ❌ `requirepass` set on master but `masterauth` not on replica
- ❌ Master's `repl-backlog-size` too small → full resync triggered → replica falls back into PSYNC loop
- ❌ Replica disk full — can't write incoming RDB
- ❌ Mismatched `protected-mode`/binding

**Fix**
```bash
# Replica: set masterauth and re-attach
redis-cli CONFIG SET masterauth "$MASTER_PASS"
redis-cli REPLICAOF MASTER_HOST 6379

# Master: bump replication backlog so blips don't trigger full resync
redis-cli CONFIG SET repl-backlog-size 64mb
redis-cli CONFIG SET repl-backlog-ttl 3600
redis-cli CONFIG REWRITE

# Verify
redis-cli -h MASTER_HOST INFO replication
```

---

## AOF grows unbounded (disk filling)

**Symptoms**
- `/var/lib/redis/appendonly.aof` (or `appendonly.aof.*` files) keeps growing
- Disk alerts on Redis box
- `INFO persistence` shows `aof_current_size` far exceeds working dataset size

**Diagnose**
```bash
ls -lh /var/lib/redis/appendonly*
redis-cli INFO persistence | grep -E "aof_current_size|aof_base_size|aof_pending_rewrite|aof_last_rewrite"
redis-cli CONFIG GET auto-aof-rewrite-percentage
redis-cli CONFIG GET auto-aof-rewrite-min-size
```

**Common causes**
- ❌ `auto-aof-rewrite-percentage 0` (disabled)
- ❌ Failed rewrites — child OOM, disk pressure
- ❌ Huge dataset churn (constant rewrites of same keys) — AOF grows faster than rewrite cadence
- ❌ `aof-use-rdb-preamble no` — full text log; flip to `yes` for compactness

**Fix**
```bash
redis-cli CONFIG SET auto-aof-rewrite-percentage 100
redis-cli CONFIG SET auto-aof-rewrite-min-size 64mb
redis-cli CONFIG SET aof-use-rdb-preamble yes
redis-cli BGREWRITEAOF                 # force one now
redis-cli CONFIG REWRITE
```

---

## Client timeout / disconnect floods

**Symptoms**
- App logs: `Error: Connection is closed` / `ETIMEDOUT` / `read ECONNRESET`
- `redis-cli CLIENT LIST | wc -l` — count grows
- Latency spikes

**Diagnose**
```bash
redis-cli CLIENT LIST | wc -l          # how many connected
redis-cli CONFIG GET maxclients
redis-cli INFO clients
redis-cli --latency -h HOST            # baseline latency
redis-cli --latency-history -h HOST -i 1
redis-cli SLOWLOG GET 25                # commands that block server
```

**Common causes**
- ❌ Slow command (`KEYS *`, `SMEMBERS bigset`, `HGETALL bighash`) blocks server → all clients time out
- ❌ Client `commandTimeout` too tight for typical p99
- ❌ Connection leak — code creates `new Redis()` per request without closing
- ❌ `tcp-keepalive 0` on Redis + NAT timeout in middle → connections dropped silently
- ❌ `maxclients` reached → server refuses new connections

**Fix**
```bash
# Replace KEYS / HGETALL with SCAN / HSCAN — see wrong-vs-right in references
# Pool / decorate client (one per process)
# Raise tcp-keepalive
redis-cli CONFIG SET tcp-keepalive 300

# Raise maxclients (if kernel allows)
redis-cli CONFIG SET maxclients 10000
ulimit -n 65535
```

---

## Slow `SAVE` / `DEBUG SLEEP` blocks the server

**Symptoms**
- Sudden full freeze; all clients hang
- `INFO stats` shows `instantaneous_ops_per_sec: 0`
- Operator ran `SAVE` (sync) or `DEBUG SLEEP` accidentally

**Common causes**
- ❌ Someone ran synchronous `SAVE` (blocks ALL writes until done)
- ❌ Synchronous `DEBUG OBJECT` / `DEBUG SLEEP`
- ❌ `BGSAVE` started but child got stuck on slow disk

**Fix**
```bash
# Never SAVE in production. Use BGSAVE.
redis-cli BGSAVE

# Disable the synchronous SAVE command via ACL/rename
# in redis.conf:
rename-command SAVE ""
rename-command DEBUG ""
# Then reload:
sudo systemctl reload redis-server     # or restart if reload not supported
```

---

## Sentinel split-brain (two masters elected)

**Symptoms**
- Two replicas/masters both accept writes
- App sees inconsistent state across reads
- Sentinel logs: `+sdown` / `+odown` thrashing

**Diagnose**
```bash
redis-cli -p 26379 SENTINEL masters
redis-cli -p 26379 SENTINEL replicas mymaster
redis-cli -p 26379 SENTINEL ckquorum mymaster
# On each Redis: who am I?
redis-cli ROLE
```

**Common causes**
- ❌ Quorum set lower than majority (e.g., `quorum 1` with 3 sentinels)
- ❌ Network partition isolates sentinels into minority groups
- ❌ `min-replicas-to-write 0` — master accepts writes during partition

**Fix**
```bash
# Set quorum to (N/2)+1; require quorum AND majority to fail over
redis-cli -p 26379 SENTINEL SET mymaster quorum 2

# Set min-replicas guard on master config:
# min-replicas-to-write 1
# min-replicas-max-lag 10
# This rejects writes if no replicas are reachable — prevents split-brain writes
```

---

## Cluster slot move during migration causes `MOVED`/`ASK` errors

**Symptoms**
- Client errors: `MOVED 12182 10.0.0.2:6379` or `ASK 12182 10.0.0.2:6379`
- Some keys return errors after `CLUSTER ADDSLOTS` / resharding
- Bull-board / monitoring shows mixed cluster state

**Common causes**
- ❌ Client lib that doesn't follow `MOVED`/`ASK` redirects (use ioredis Cluster, not standalone)
- ❌ Resharding in progress; some slots are `IMPORTING`/`MIGRATING`
- ❌ Cross-slot `MULTI`/`EXEC` rejected — no hash tag on related keys

**Fix**
```bash
redis-cli --cluster check HOST:PORT
redis-cli --cluster fix HOST:PORT      # repairs known states

# Use hash tags on related keys
SET '{user:42}:profile' '...'
SET '{user:42}:settings' '...'
# Same {user:42} → same slot → MULTI/EXEC works
```

---

## Eviction policy misfire (wrong policy → queue data lost)

**Symptoms**
- BullMQ jobs disappear silently
- `redis-cli DBSIZE` keeps fluctuating
- `INFO stats` `evicted_keys` rising on a Redis used for queues

**This is catastrophic** — there is no recovery for evicted queue jobs.

**Diagnose**
```bash
redis-cli CONFIG GET maxmemory-policy
redis-cli INFO stats | grep evicted_keys
```

**Fix**
```bash
# For Redis backing a BullMQ/queue:
redis-cli CONFIG SET maxmemory-policy noeviction
redis-cli CONFIG REWRITE

# Then size up RAM or add a separate Redis for cache layer
```

> Cite `bullmq` skill `recommended-defaults.md` — never share a `maxmemory-policy` eviction Redis with queue data.

---

## ACL denied an expected command

**Symptoms**
- Client error: `NOPERM this user has no permissions to run the 'flushdb' command`
- Or: `NOPERM this user has no permissions to access one of the keys used as arguments`

**Diagnose**
```bash
redis-cli ACL WHOAMI                    # current user
redis-cli ACL LIST                      # all users + their rules
redis-cli ACL GETUSER app               # show one user
redis-cli ACL LOG 10                    # last 10 denials
```

**Common causes**
- ❌ Connecting as `default` user when expecting `app` (forgot `AUTH user pass`)
- ❌ Built-in modules (JSON, search, bloom, timeseries) require explicit `+@json +@search +@bloom +@timeseries`
- ❌ Key prefix mismatch — ACL allows `~app:*` but code uses `cache:*`
- ❌ `+@all -@write` doesn't grant module mutating commands

**Fix**
```bash
# Grant module categories explicitly (Redis 8 unified modules)
redis-cli ACL SETUSER app on \
  '>password' \
  '~app:*' \
  '+@read +@write +@string +@hash +@list +@set +@zset +@stream' \
  '+@json +@search +@bloom +@timeseries' \
  '-@dangerous'
```

---

## Keyspace explosion (no TTL → memory runaway)

**Symptoms**
- `DBSIZE` grows monotonically
- Memory climbs even when app cache hit rate should plateau
- Most keys returned by `--scan` have `TTL -1` (no expiry)

**Diagnose**
```bash
redis-cli DBSIZE
redis-cli --scan --pattern 'cache:*' | head -100 | xargs -I{} sh -c 'echo "$(redis-cli TTL "{}") {}"' | sort -n | head
```

**Common causes**
- ❌ Code path that does `client.set(k, v)` instead of `client.set(k, v, 'EX', ttl)`
- ❌ Session store with no rolling refresh + no max age
- ❌ Hash-field-level cache without `HEXPIRE` (Redis 7.4+) — entire hash never expires

**Fix**
```ts
// Always set TTL on cache writes
await redis.set(key, value, 'EX', 300);     // 5 minutes
// Or: SET key value EX 300 NX   ← also adds dedup

// For hashes with mixed staleness — Redis 7.4+:
await redis.call('HSET', 'user:42', 'name', 'A', 'avatar_url', '...');
await redis.call('HEXPIRE', 'user:42', '86400', 'FIELDS', '1', 'avatar_url');
```

---

## More symptoms?

Capture: `INFO memory`, `INFO persistence`, `INFO replication`, `CLIENT LIST`, `SLOWLOG GET 25`, `--bigkeys` output. File an issue with that data; we extend this file when patterns repeat.
