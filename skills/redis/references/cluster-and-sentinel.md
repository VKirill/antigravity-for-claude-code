# Redis — Cluster & Sentinel

## Sentinel vs Cluster — quick pick

| Need | Topology |
|---|---|
| HA for one Redis up to ~64 GB working set | **Sentinel** |
| Horizontal scale beyond one host's RAM | **Cluster** |
| Read scaling via replicas | Either; cluster naturally distributes |
| Strict atomic ops across keys | Sentinel (Cluster requires keys in same slot) |

## Sentinel

Standalone HA. One primary, N replicas. Sentinels watch them and trigger failover.

### Setup

3 Sentinel processes on separate hosts. Each:

```conf
# /etc/redis/sentinel.conf
port 26379
dir /var/lib/redis-sentinel
sentinel monitor mymaster 192.168.1.10 6379 2     # quorum 2
sentinel down-after-milliseconds mymaster 5000
sentinel parallel-syncs mymaster 1
sentinel failover-timeout mymaster 60000
sentinel auth-pass mymaster <password>
```

Quorum (`2`) = number of sentinels that must agree the primary is down before failover.

### Client (ioredis)

```ts
const redis = new Redis({
  sentinels: [
    { host: 'sentinel-1', port: 26379 },
    { host: 'sentinel-2', port: 26379 },
    { host: 'sentinel-3', port: 26379 },
  ],
  name: 'mymaster',
  password: process.env.REDIS_PASSWORD,
});
```

The client asks the sentinels for the current primary. On failover, it transparently reconnects to the new primary.

### Manual failover

```
redis-cli -p 26379 SENTINEL FAILOVER mymaster
```

## Cluster

Sharded across N primaries (each can have replicas). 16384 hash slots distributed.

### Minimum production topology

- 3 primaries + 3 replicas (6 nodes minimum for HA cluster)
- Each replica must be on a different host than its primary

### Setup

```bash
redis-server /etc/redis/redis.conf --port 7000 --cluster-enabled yes --cluster-config-file nodes.conf --cluster-node-timeout 5000 --appendonly yes

# Repeat for ports 7001..7005 on different hosts

redis-cli --cluster create \
  10.0.0.1:7000 10.0.0.2:7001 10.0.0.3:7002 \
  10.0.0.4:7003 10.0.0.5:7004 10.0.0.6:7005 \
  --cluster-replicas 1
```

### Hash slots

Each key's slot: `CRC16(key) % 16384`. Slot 0–5460 → primary A, 5461–10922 → B, 10923–16383 → C (default split for 3 primaries).

```
CLUSTER NODES
CLUSTER SLOTS
CLUSTER KEYSLOT mykey
CLUSTER COUNTKEYSINSLOT 1234
```

### Hash tags (keep keys in same slot)

```
SET {user:42}:profile  "..."
SET {user:42}:settings "..."
SET {user:42}:posts    "..."
```

The text in `{...}` is what gets hashed. All keys with the same tag go to the same slot, enabling `MULTI`/`EXEC` / Lua scripts across them.

### Client (ioredis)

```ts
const cluster = new Redis.Cluster([
  { host: '10.0.0.1', port: 7000 },
  { host: '10.0.0.2', port: 7001 },
  { host: '10.0.0.3', port: 7002 },
], {
  redisOptions: { password: process.env.REDIS_PASSWORD },
  scaleReads: 'slave',           // read from replicas
  enableAutoPipelining: true,
});
```

`scaleReads: 'slave' | 'master' | 'all'`. `'slave'` saves primary CPU for writes.

### Cluster `MULTI`/`EXEC` limitation

Only one slot per transaction. Use hash tags or split the work:

```ts
// ❌ Cross-slot — errors
await cluster.multi().set('foo', '1').set('bar', '2').exec();

// ✅ Same slot via tag
await cluster.multi().set('{order:42}:status', 'paid').set('{order:42}:amount', '1000').exec();
```

### Resharding

```bash
redis-cli --cluster reshard 10.0.0.1:7000 \
  --cluster-from <node-id> \
  --cluster-to <node-id> \
  --cluster-slots 1000 \
  --cluster-yes
```

Or via `redis-cli --cluster rebalance` to even out slots.

### Adding/removing nodes

```bash
# Add
redis-cli --cluster add-node 10.0.0.7:7006 10.0.0.1:7000
redis-cli --cluster add-node 10.0.0.8:7007 10.0.0.1:7000 --cluster-slave --cluster-master-id <new-master-id>
# Reshard to balance

# Remove
redis-cli --cluster del-node 10.0.0.1:7000 <node-id>
```

### Pub/Sub in Cluster

Cluster-wide pub/sub by default (messages propagate). Use `SHARDED` (sharded pub/sub, Redis 7+) for per-slot pub/sub:

```
SPUBLISH channel message
SSUBSCRIBE channel
```

Sharded pub/sub stays within the slot, scaling pub/sub throughput linearly with shards.

## Comparing cost / complexity

| Aspect | Sentinel | Cluster |
|---|---|---|
| Min nodes | 1 primary + 1 replica + 3 sentinels = 5 processes (3 hosts) | 6 nodes / 6 processes (3+3 hosts) |
| Failover time | 5–30s | 5–30s |
| Horizontal scale | No | Yes |
| Cross-key transactions | Yes | Only within slot |
| Operational complexity | Lower | Higher (resharding, slot migration) |
| Client config | Sentinels + master name | List of any nodes; client discovers |

For most teams: start with Sentinel; migrate to Cluster only when a single primary's memory or CPU becomes the bottleneck.

## Common gotchas

- ❌ Cluster with cross-slot `MULTI`/`EXEC` → CROSSSLOT error
- ❌ Forgetting `--cluster-replicas 1` → no HA inside the cluster
- ❌ Sentinel quorum < majority → split-brain risk
- ❌ Client connecting to a single Cluster node and missing the others on failover → use the multi-host config
- ❌ Forgetting `enableAutoPipelining` → many round-trips per command in Cluster mode
- ❌ Pub/Sub on Cluster without `SPUBLISH` → all-shards fanout
