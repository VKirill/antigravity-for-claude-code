# redis skill — CHANGELOG

## [2.0.0] — 2026-05-15

Full retrofit to skill-evaluation v3 standards using `bullmq` v2.0.1 as the gold-standard exemplar.

### Added
- `references/recommended-defaults.md` — canonical Redis 8 values: `maxmemory` and `maxmemory-policy` per use case (cache vs queue vs primary), `appendonly` + `appendfsync` tradeoffs, RDB/AOF profile matrix, TCP & client knobs, replication tuning, three-tier ACL roles, topology choice (standalone/Sentinel/Cluster), ioredis client defaults with BullMQ override note, Stream `XAUTOCLAIM` timing. Required by v3 for technical skills with operational knobs.
- `references/troubleshooting.md` — required for `risk: high-stakes` per v3. Symptom-indexed entries with Symptoms → Diagnose (bash one-liners) → Common causes → Fix (paste-runnable): OOM, `MISCONF` snapshot error, replication broken, AOF unbounded growth, client timeout floods, slow `SAVE` blocking server, Sentinel split-brain, Cluster slot move (`MOVED`/`ASK`), eviction policy misfire (queue data loss), ACL denial of expected command, keyspace explosion (no TTL).
- `references/wrong-vs-right.md` — 6 preventive ❌/✅ pairs with "Why it matters" rationale: TTL on cache keys, `SCAN`/`UNLINK` vs `KEYS`/`DEL`, distributed lock release with Lua atomic CAS, `noeviction` for queue-backing Redis, Streams vs Pub/Sub for important events, Pub/Sub connection separation. SKILL.md links to this file (kept SKILL.md compact).

### Changed
- Frontmatter: added `risk: high-stakes` — triggers v3 mandatory artifacts (troubleshooting + recommended-defaults).
- SKILL.md compressed 226 → 183 lines. Capabilities collapsed to one-liner-per-domain pointing to references. Inline data-structure table and per-section prose summaries removed (moved into respective references). `## Wrong vs Right` section links to `references/wrong-vs-right.md` rather than inlining pairs.
- `references/eval-cases.md` rewritten in v3 format: user-voice phrasing (Russian/typos/incomplete) + "Expected behavior" column instead of "Why". 10 positive / 10 negative / 5 edge cases, each naming the file/section that should load.
- SKILL.md API Reference table now follows `| Topic | File |` v3 shape with descriptions including correct import lines and section anchors.

### Fixed
- SKILL.md line 134 — removed `(PG8 = "Redis 8")` typo/hallucination from the "Hash field TTL" bullet. PG8 conflated PostgreSQL 18 with Redis 8 with no basis; replaced with a clean description.
- Verified import correctness (Context7, 2026-05-15):
  - `import Redis from 'ioredis'` — default export, confirmed `/redis/ioredis` Upgrading-from-v4-to-v5 doc
  - `import { createClient } from 'redis'` — node-redis named export, confirmed `/redis/node-redis` package README
  - `import { Schema, Repository } from 'redis-om'` — named exports, confirmed `/redis/redis-om-node` README
  - `HEXPIRE key seconds FIELDS numfields field [field ...]` — Redis 7.4+ syntax with mandatory `FIELDS numfields` keyword (existing reference files use correct form; SKILL.md summary keeps shortform `HEXPIRE` in the data-structure table — that's fine for a one-line summary)
  - `HTTL` / `HPERSIST` — confirmed exist with same `FIELDS numfields` syntax
- Behavioral Traits and Important Constraints sections explicitly call out the BullMQ `maxRetriesPerRequest: null` requirement and the `noeviction` rule, and cross-cite `bullmq` skill `recommended-defaults.md`.

### Notes
- The 9 existing references files (`data-structures.md`, `clients.md`, `caching-patterns.md`, `pub-sub-and-streams.md`, `persistence-and-replication.md`, `cluster-and-sentinel.md`, `acl-and-security.md`, `redis-8-whats-new.md` + `eval-cases.md`) are unchanged in this pass except for `eval-cases.md`. Their content was audited and found internally consistent with the new `recommended-defaults.md`.
- Stream `XAUTOCLAIM` timing defaults (`min-idle-time: 60s`, claim every 30s) live in `recommended-defaults.md`; `pub-sub-and-streams.md` cites this rather than redefining inline.

## [1.0.0] — 2026-05-15

### Added
- Initial skill under skill-evaluation v2 standards (Pattern 2)
- SKILL.md navigator with 8 reference files + eval-cases
- `references/data-structures.md` — strings/lists/hashes/sets/zsets/streams/HLL/GEO/bitmaps
- `references/clients.md` — ioredis vs node-redis vs redis-om; cluster/sentinel client config
- `references/caching-patterns.md` — cache-aside, write-through, TTL jitter, stampede protection
- `references/pub-sub-and-streams.md` — channels, Streams, consumer groups, XCLAIM/XAUTOCLAIM
- `references/persistence-and-replication.md` — RDB, AOF, replication, WAIT N
- `references/cluster-and-sentinel.md` — sharding, hash tags, MULTI/EXEC limits, Sentinel
- `references/acl-and-security.md` — ACL SETUSER, command rename, TLS
- `references/redis-8-whats-new.md` — hash field TTL (HEXPIRE/HTTL), FT.SEARCH, vector, BSL/Valkey license context
- `references/eval-cases.md` — 10 positive + 10 negative + 5 edge tests
- `templates/ioredis-setup.ts.template` — connection w/ retry, TLS, error handler, graceful close
- `templates/cache-aside.ts.template` — cache-aside with NX lock stampede protection
- `templates/streams-consumer.ts.template` — Streams consumer group with auto-claim
- `examples/rate-limiter-lua.md` — Lua token-bucket rate limiter
- `examples/session-store.md` — Redis-backed session with TTL refresh

### Verified versions (Context7, 2026-05-15)
- Redis: `8.x` (release notes confirm hash field TTL is "Redis 8" feature; `HEXPIRE` etc. enhanced FT.SEARCH interaction)
- Redis Stack 7.4 → Redis 8 unified (modules built-in to Community Edition)
- Source: `/websites/redis_io` `hexpire` page; `/redis/docs`; release notes for RS 7.8.2-34 confirming hash field expiration
- Note: Redis 7.4+ uses dual SSPLv1/RSALv2 license; **Valkey** is the LF Apache-2.0 fork — surface this distinction in docs

### Notes
- Hash field TTL (`HEXPIRE`/`HTTL`/`HPERSIST`/`HEXPIREAT`) was introduced in Redis 7.4 and enhanced in 8.x with FT.SEARCH integration
- Streams API consumer group commands (`XREADGROUP`, `XACK`, `XCLAIM`, `XAUTOCLAIM`) preferred over Pub/Sub for production
- Pair with `bullmq` (Redis-backed queues), `postgresql` (cache-aside), `prisma` (query cache layer)
