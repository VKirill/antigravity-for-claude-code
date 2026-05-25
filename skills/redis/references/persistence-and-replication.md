# Redis — Persistence & Replication

## Persistence modes

### RDB — periodic snapshots

```conf
save 900 1        # snapshot if >=1 change in 900s
save 300 10
save 60 10000
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir /var/lib/redis
```

Pros: small file, fast startup. Cons: data loss between snapshots (up to last `save` interval).

`BGSAVE` triggers a manual snapshot; uses `fork()` (memory-copy-on-write).

### AOF — append-only log

```conf
appendonly yes
appendfilename appendonly.aof
appendfsync everysec        # always | everysec | no
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb
```

Every write command appended to the log. `fsync` policy:
- `always` — fsync after every write (slowest, no data loss)
- `everysec` (default) — fsync every second (≤1s data loss; recommended)
- `no` — let OS flush (fastest, several seconds of loss)

AOF rewrites compact the log periodically. Triggered by `auto-aof-rewrite-*` thresholds or manual `BGREWRITEAOF`.

### Combined RDB + AOF

```conf
appendonly yes
save 900 1
```

Use AOF as the truth, RDB for fast restart. On startup, Redis prefers AOF.

### Picking

| Need | Choice |
|---|---|
| Cache (loss OK) | RDB only or no persistence |
| Sessions / queues (data must survive) | AOF `everysec` |
| Financial / never-lose | AOF `always` (huge perf cost — usually pair with replication) |
| Fast restart | RDB + AOF |

## Memory

```conf
maxmemory 4gb
maxmemory-policy allkeys-lru    # see caching-patterns.md
```

When `maxmemory` is reached, the policy kicks in. Default `noeviction` errors on write.

`maxmemory-samples 5` controls LRU/LFU approximation accuracy. Higher = better but more CPU.

## Replication

```conf
# On replica:
replicaof primary-host 6379
masterauth <primary-password>
replica-read-only yes
replica-serve-stale-data yes
```

Async by default. Primary streams commands as they arrive.

### Reading from replicas

`replica-read-only yes` (default) — accept reads, reject writes. Useful for analytics / report queries.

App-side: route reads to replicas via `Redis.Cluster({ scaleReads: 'slave' })` or maintain a separate `replicaRedis` client.

### Semi-sync writes — `WAIT N timeout`

```
WAIT 1 100         -- wait until 1 replica ack'd, max 100 ms
```

After a write, the client can `WAIT` for the value to be replicated. Returns the count of replicas that ack'd; if < N, the client knows the write is "less durable".

Not as strong as Kafka acks=all (it's still async), but bounds inconsistency in fail-fast scenarios.

## Sentinel (HA failover)

Sentinel is a separate process that monitors primary + replicas and promotes a replica on primary failure.

```conf
# sentinel.conf
port 26379
sentinel monitor mymaster 192.168.1.100 6379 2     # quorum of 2 sentinels
sentinel down-after-milliseconds mymaster 5000
sentinel failover-timeout mymaster 60000
sentinel parallel-syncs mymaster 1
```

Run 3+ Sentinel processes on separate hosts. They gossip; when ≥quorum agree the primary is down, they pick a leader Sentinel to perform the failover.

Client config (ioredis):

```ts
new Redis({
  sentinels: [{ host: 's1' }, { host: 's2' }, { host: 's3' }],
  name: 'mymaster',
  sentinelPassword: '...',
  password: '...',
});
```

The client queries sentinels for the current primary on connect and on reconnect.

## Backup

```bash
# RDB snapshot — copy the file
redis-cli BGSAVE
cp /var/lib/redis/dump.rdb /backups/dump-$(date +%F).rdb

# Or BGSAVE + scp to remote

# AOF — copy the file mid-rewrite (newer redis has BGSAVE/BGREWRITEAOF + integrity check)
redis-cli BGREWRITEAOF
```

Test restores quarterly: start a fresh Redis pointed at the backup; verify key count + sample data.

## Monitoring replication

```
INFO replication
# role:master / role:slave
# connected_slaves:2
# master_repl_offset:1234567
# slave_repl_offset:1234564   -- replica side
```

Lag = `master_repl_offset - slave.master_repl_offset` (bytes of WAL not yet shipped).

```
SLOWLOG GET 10                    -- slow query log
LATENCY DOCTOR                     -- latency events summary
INFO commandstats                  -- per-command call count + total time
```

## Persistence performance tips

- `fork()` for RDB snapshot can take seconds on a large dataset (copy page tables). Use a host with enough CPU + RAM headroom.
- Turn off Transparent Huge Pages: `echo never > /sys/kernel/mm/transparent_hugepage/enabled` (Redis startup warns about this).
- Set `vm.overcommit_memory=1` (sysctl) — required for fork() to succeed on memory-tight hosts.
- Don't run Redis on the same disk as the AOF target for high-throughput workloads.

## Restoring from backup

```bash
# Stop Redis
systemctl stop redis-server

# Replace the data file
cp /backups/dump.rdb /var/lib/redis/dump.rdb
chown redis:redis /var/lib/redis/dump.rdb

# If AOF is enabled and you want RDB only, disable AOF or delete appendonly.aof
rm /var/lib/redis/appendonly.aof.* 2>/dev/null || true

# Start
systemctl start redis-server
redis-cli DBSIZE       # verify
```

For AOF: copy `appendonly.aof.*` files (Redis 7+ uses multi-part AOF in `appendonlydir/`).

## Anti-patterns

- ❌ Running production without ANY persistence — single restart = data loss
- ❌ `appendfsync always` on a normal disk → 5–10× write latency
- ❌ Storing the only backup on the same host as Redis
- ❌ Skipping `vm.overcommit_memory=1` → BGSAVE fails on memory-tight hosts
- ❌ Sentinel without quorum (≥3 nodes) → split-brain on partial failure
- ❌ Replicas without read-only mode → app writes to a replica, lost on failover
- ❌ Forgetting `INFO replication` monitoring → lag grows silently
