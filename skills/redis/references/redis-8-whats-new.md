# Redis 8 — What's New

> Sources (Context7, 2026-05-15): `/websites/redis_io` HEXPIRE page; Redis Enterprise 7.8.x release notes confirming hash field expiration availability when DB version ≥ 7.4; Redis Stack 7.4 → Redis 8 unification.

## Headlines

1. **Hash field-level TTL** — `HEXPIRE`, `HPEXPIRE`, `HEXPIREAT`, `HPEXPIREAT`, `HTTL`, `HPTTL`, `HPERSIST`, `HEXPIRETIME`
2. **FT.SEARCH integration with field expiry** — search/aggregate properly skip expired fields
3. **Vector data types** — reduced memory footprint, faster cosine ops
4. **Time-series insertion filters** — dedupe / threshold filters on ingestion
5. **License**: Redis 7.4+ uses dual SSPLv1 / RSALv2 (not BSD anymore). The OSS BSD fork is **Valkey** under Linux Foundation
6. **Redis Stack modules** (RedisJSON, RediSearch, RedisTimeSeries, RedisBloom) are now built into Community Edition

## Hash field TTL — the big one

Pre-Redis 7.4, TTL was key-level only. A hash had one expiry for all fields. Redis 7.4 added field-level TTL; Redis 8 polished the FT.SEARCH integration.

```
HEXPIRE key seconds FIELDS numfields field [field ...]
HPEXPIRE key milliseconds FIELDS numfields field [field ...]
HEXPIREAT key unix-time-seconds FIELDS numfields field [field ...]
HPEXPIREAT key unix-time-ms FIELDS numfields field [field ...]

HTTL key FIELDS numfields field [field ...]            -- returns array of seconds
HPTTL key FIELDS numfields field [field ...]
HEXPIRETIME key FIELDS numfields field [field ...]
HPEXPIRETIME key FIELDS numfields field [field ...]

HPERSIST key FIELDS numfields field [field ...]        -- remove TTL from field
```

### Examples

```
HSET session:abc user_id 42 csrf xyz preferences "..."
HEXPIRE session:abc 60 FIELDS 1 csrf                    -- csrf expires in 60s
HEXPIRE session:abc 3600 FIELDS 1 user_id              -- user_id in 1h
HTTL session:abc FIELDS 2 csrf user_id                  -- [60, 3600]
```

The hash itself doesn't expire (no key TTL). Individual fields disappear at their TTL.

### Returns

- `HEXPIRE` returns array of per-field outcomes:
  - `0` — TTL not set; condition not met (e.g., GT/LT)
  - `1` — TTL set
  - `2` — TTL removed (when time is in the past); field also deleted
  - `-2` — field doesn't exist

### NX / XX / GT / LT

```
HEXPIRE key seconds NX FIELDS n f1     -- only if field has no TTL
HEXPIRE key seconds XX FIELDS n f1     -- only if field already has TTL
HEXPIRE key seconds GT FIELDS n f1     -- only if new TTL > current
HEXPIRE key seconds LT FIELDS n f1     -- only if new TTL < current
```

### Use cases

- **Session with mixed lifetimes** — `csrf_token` (1 min), `user_id` (1 hour), `preferences` (1 day) all in one hash
- **Cache with per-field freshness** — `profile` (5 min), `last_login` (30 min)
- **Rate limit with hash fields per endpoint** — one hash per user, fields per endpoint, individual TTL

Replaces the older pattern of one Redis key per field with shared prefix + manual cleanup.

## FT.SEARCH and field expiry

If you index a hash with RediSearch and a field has TTL, FT.SEARCH respects the expiry — expired fields don't appear in results. Pre-Redis 8 this had edge cases; Redis 8 unifies the semantics.

```
FT.CREATE myidx ON HASH PREFIX 1 session: SCHEMA user_id NUMERIC csrf TEXT

HSET session:1 user_id 1 csrf "abc"
HEXPIRE session:1 1 FIELDS 1 csrf
-- after 1s
FT.SEARCH myidx "@csrf:abc"            -- returns 0 results (csrf field expired)
```

## Vector data types

Redis 8 reduces memory per vector and adds faster cosine/L2 operators:

```
FT.CREATE idx ON HASH PREFIX 1 doc: SCHEMA emb VECTOR HNSW 6 TYPE FLOAT32 DIM 1536 DISTANCE_METRIC COSINE

HSET doc:1 emb "<binary float32 vector>"

FT.SEARCH idx "*=>[KNN 5 @emb $query AS dist]" PARAMS 2 query "<binary>" SORTBY dist
```

`FLOAT16` and `BFLOAT16` types reduce vector memory ~2× with minimal recall loss.

## Time-series insertion filters

```
TS.CREATE temperature DUPLICATE_POLICY LAST
TS.ADD temperature * 23.5
TS.ADD temperature * 23.5      -- with FILTER_BY_VALUE this could be dropped
```

Use to skip near-duplicate samples (sensor noise) at ingestion time.

## License — Redis vs Valkey

### Redis 7.4+ dual license

- **SSPLv1** (Server Side Public License v1) — same family as MongoDB's; copyleft
- **RSALv2** (Redis Source Available License v2) — restricts hosted-service competition

This is NOT OSI-approved open source. Most managed cloud providers (AWS, Google) ship Valkey instead now.

### Valkey

Apache 2.0 fork of Redis 7.2 stewarded by Linux Foundation. Drop-in compatible at the wire protocol; command set is 99% identical. **Hash field TTL is in Valkey 7.4 as well.**

Major Redis modules (RediSearch, RedisJSON) are NOT in Valkey — those remain BSL/RSALv2 (Redis Inc.). Valkey ecosystem has alternatives but they're younger.

### Picking

| Need | Pick |
|---|---|
| Redis Cloud / Redis Inc. managed | Redis |
| AWS ElastiCache | Valkey (after 2024 cutover) |
| Self-host with full modules (FT.SEARCH, RedisJSON) | Redis (license cost or self-host with BSL) |
| Self-host plain Redis | Valkey (Apache 2.0) |
| Maximum command compatibility, no modules | Either |

For purposes of this skill: commands are identical, so most of the content applies to both. Module-dependent commands (FT.*, JSON.*, TS.*) require Redis or self-installed Valkey modules.

## Other improvements

- Background AOF rewrite improvements (memory efficiency)
- `CLUSTER LINKS` for cluster bus diagnostics
- `CLIENT NO-EVICT` to mark a client as non-evictable
- `BLMPOP` / `BZMPOP` blocking variants
- Faster `JSON.MGET`
- Improved CLI: `--cluster`, `--scan`, `--bigkeys`, `--hotkeys`

## Migration notes

### From Redis 6 / 7.0

- `HEXPIRE` family is new — must be 7.4+
- ACL syntax expanded — verify existing ACL files still parse (they should)
- License: Redis 6/7.0 are BSD; 7.2 is BSD; 7.4+ is dual SSPL/RSAL. Upgrade in place but be aware of legal terms for self-hosted commercial offerings.

### To Valkey

In-place wire-level. Replace the binary, point clients at the same port. Drop module commands if unavailable.

### From Memcached

- Different protocol. Use the Redis client.
- Memcached has no persistence by default; Redis adds AOF/RDB.
- Redis has more data types; if you only used `get/set/incr/decr`, the migration is straightforward.
