# Redis — Data Structures

## Strings

```
SET key value [EX seconds|PX ms|EXAT ts|KEEPTTL] [NX|XX] [GET]
GET key
GETEX key [EX seconds|PERSIST]          -- get + optionally update TTL
GETDEL key                                -- get + delete atomically
MGET key1 key2 key3
MSET k1 v1 k2 v2
INCR counter / INCRBY counter 5 / DECR / DECRBY
APPEND key value
STRLEN key
SETRANGE / GETRANGE
```

Use for: cache value, atomic counter, simple flag.

`SET key val EX 60 NX` = set-if-not-exists with TTL (used for locks).

## Lists

```
LPUSH / RPUSH key v1 v2 v3
LPOP / RPOP key [count]
BLPOP / BRPOP key timeout                 -- blocking; queue consumer
LMPOP numkeys key1 key2 LEFT|RIGHT COUNT N
LRANGE key start stop
LLEN key
LREM key count value
LSET / LINSERT
LMOVE source dest LEFT|RIGHT LEFT|RIGHT   -- atomic move (replaces RPOPLPUSH)
BLMOVE ... timeout                         -- blocking variant
```

Use for: FIFO/LIFO queue, recent-N items (`LPUSH + LTRIM 0 99`), audit log.

For at-least-once queue patterns, prefer **Streams** over LMOVE — Streams provide consumer groups + ack.

## Hashes

```
HSET key field1 v1 field2 v2
HGET key field
HMGET key f1 f2
HGETALL key                  -- avoid on large hashes
HDEL key f1 f2
HINCRBY key field 1
HEXISTS key field
HLEN key
HKEYS key / HVALS key
HSCAN key cursor
HEXPIRE key seconds FIELDS n f1 f2     -- Redis 7.4+ / 8 — TTL per FIELD
HTTL key FIELDS n f1
HPERSIST key FIELDS n f1
HEXPIREAT key unix-ts FIELDS n f1
```

Use for: object (row equivalent), session blob, per-user counters.

**Redis 8** adds field-level TTL via `HEXPIRE` / `HTTL` / `HPERSIST` / `HEXPIREAT`. Lets one hash store related fields with different lifetimes — useful for session attributes that expire independently.

## Sets

```
SADD / SREM key member
SISMEMBER / SMISMEMBER key m1 m2          -- batch existence check
SMEMBERS key                              -- avoid on huge sets
SINTER / SUNION / SDIFF k1 k2 k3
SINTERSTORE / SUNIONSTORE / SDIFFSTORE dest k1 k2
SCARD key
SRANDMEMBER key count
SPOP key count                            -- random remove
```

Use for: unique members (visitors, tags), set algebra (online users intersected with notify-list).

## Sorted Sets (ZSets)

```
ZADD key score1 m1 score2 m2 [NX|XX|GT|LT|CH|INCR]
ZSCORE / ZMSCORE key m1 m2
ZRANGE key min max [BYSCORE|BYLEX] [REV] [LIMIT off count] [WITHSCORES]
ZRANGEBYSCORE / ZRANGEBYLEX                -- legacy; ZRANGE BYSCORE/BYLEX preferred
ZREM / ZREMRANGEBYSCORE / ZREMRANGEBYRANK
ZINCRBY key 1 member
ZCARD / ZCOUNT
ZPOPMIN / ZPOPMAX key count
BZPOPMIN / BZPOPMAX                        -- blocking variants
ZRANGESTORE dest src min max
```

Use for: leaderboard (score = points), priority queue (score = priority), time-ordered queue (score = unix ms), rate-limiter sliding window.

`ZADD key NX score member` = insert-or-keep. `ZADD GT score member` = update only if score is greater.

## Streams

```
XADD stream * field1 v1 field2 v2          -- * = auto-id
XADD stream MAXLEN ~ 10000 * ...           -- bounded with approximate trim
XLEN stream
XRANGE stream - +                          -- range scan
XREAD COUNT 10 BLOCK 0 STREAMS stream $    -- $ = only new entries
XREADGROUP GROUP grp consumer COUNT 10 BLOCK 0 STREAMS stream >
XGROUP CREATE stream grp $ MKSTREAM
XACK stream grp id
XPENDING stream grp [IDLE ms] [start end count [consumer]]
XCLAIM stream grp consumer 60000 id1 id2   -- claim stalled
XAUTOCLAIM stream grp consumer min-idle 0 COUNT 100
XTRIM stream MAXLEN ~ 10000
```

Use for: event log with persistence, multi-consumer fan-out with at-least-once delivery.

Consumer group flow: each consumer in the group sees disjoint entries. Crash → another consumer claims un-acked entries via `XAUTOCLAIM`.

## HyperLogLog

```
PFADD key element1 element2
PFCOUNT key                                -- approximate cardinality (~0.81% error)
PFMERGE dest src1 src2
```

Constant ~12 KB per HLL regardless of cardinality. Use for: DAU/MAU, unique URL clicks at huge scale.

## GEO

```
GEOADD key longitude latitude member
GEODIST key m1 m2 [m|km|mi|ft]
GEOPOS key m1 m2
GEOSEARCH key FROMMEMBER m | FROMLONLAT lon lat
            BYRADIUS r m | BYBOX w h m
            COUNT 100 [ASC|DESC] WITHCOORD WITHDIST
GEOSEARCHSTORE dest src ...
```

Use for: nearest-N points (drivers, restaurants).

## Bitmaps

```
SETBIT key offset 0|1
GETBIT key offset
BITCOUNT key [start end [BYTE|BIT]]
BITOP AND|OR|XOR|NOT dest k1 k2
BITPOS key 0|1
BITFIELD key SET|GET|INCRBY ...
```

Use for: per-user feature flags by user_id offset, DAU bitmap union for MAU.

## Keys — naming + lifecycle

Keys are flat strings. Convention: `entity:id:attribute` (`user:42:profile`, `cache:posts:popular`, `lock:order:42`).

```
EXISTS key1 key2                           -- count of existing
TYPE key                                   -- 'string' | 'list' | 'hash' | 'set' | 'zset' | 'stream'
EXPIRE / PEXPIRE / EXPIREAT / PEXPIREAT
TTL / PTTL key                              -- seconds | ms remaining; -1 no TTL; -2 doesn't exist
PERSIST key                                 -- remove TTL
RENAME / RENAMENX
DEL key1 key2
UNLINK key1 key2                            -- async delete; doesn't block
COPY src dest [DB N] [REPLACE]
SCAN cursor MATCH pattern COUNT 1000 [TYPE type]
```

**Never** `KEYS pattern` in production — blocks the server O(N). `SCAN` iterates with a cursor.

## Transactions & pipelines

```
MULTI
SET k1 v1
INCR counter
EXEC
```

`WATCH key1 key2` for optimistic concurrency — `EXEC` returns nil if any watched key changed.

Pipelining is different: queue commands and flush in one round-trip. Faster, but NOT atomic (use `MULTI`/`EXEC` if you need atomicity).

## Lua EVAL

```
EVAL "redis.call('SET', KEYS[1], ARGV[1]); return 1" 1 mykey myvalue
EVALSHA <sha> 1 mykey myvalue              -- after SCRIPT LOAD
```

Atomic, server-side. Use for: compare-and-set, rate limiter, lock release with token check.

```lua
-- Release lock only if value matches (avoid releasing someone else's)
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
```

## Server commands

```
INFO [section]                              -- replication, memory, clients, etc.
CONFIG GET maxmemory / SET
DBSIZE
CLIENT LIST / CLIENT KILL
MEMORY USAGE key
OBJECT ENCODING key                          -- 'ziplist' / 'listpack' / 'embstr' / 'hashtable' / etc.
LATENCY DOCTOR
SLOWLOG GET 10
DEBUG SLEEP 5                                -- testing only
```
