# redis — Eval Cases

v3 format: **user-voice phrasing** (Russian/typos/incomplete welcome) + **Expected behavior** column (which sub-files / templates should load, not just "this skill activates").

## Positive — should activate (10)

| User-voice prompt | Expected behavior |
|---|---|
| "Redis OOM 'command not allowed when used memory'" | Load `troubleshooting.md` OOM section; cite `recommended-defaults.md` maxmemory/policy matrix |
| "как поставить TTL на поле в хэше" | Load `redis-8-whats-new.md` HEXPIRE section + `data-structures.md` hash row; show `HEXPIRE key seconds FIELDS n field` syntax |
| "ioredis vs node-redis в 2026 — что выбрать" | Load `clients.md`; show both import lines (`import Redis from 'ioredis'` / `import { createClient } from 'redis'`); cite `recommended-defaults.md` for client options |
| "rate limiter через Lua EVAL" | Load `examples/rate-limiter-lua.md`; show token-bucket SCRIPT LOAD pattern |
| "Streams consumer group с auto-claim для зависших" | Load `pub-sub-and-streams.md`; show `XREADGROUP` + `XAUTOCLAIM` loop; cite `recommended-defaults.md` stream timing |
| "appendfsync everysec vs always — что выбрать" | Load `persistence-and-replication.md` AOF section; cite `recommended-defaults.md` persistence profile matrix |
| "Cluster — связанные ключи в один slot через {tag}" | Load `cluster-and-sentinel.md` hash-tag section; show `{user:42}:profile` example |
| "distributed lock через SET NX EX, релиз через Lua" | Load `SKILL.md` wrong-vs-right "Distributed lock release" + `caching-patterns.md` stampede section |
| "Sentinel split-brain — как защититься" | Load `troubleshooting.md` "Sentinel split-brain" section; show `min-replicas-to-write` guard |
| "мигрировать с Pub/Sub на Streams для at-least-once" | Load `pub-sub-and-streams.md`; cite SKILL.md wrong-vs-right "Pub/Sub for important events" |

## Negative — should NOT activate (10)

| User-voice prompt | Should route to | Why |
|---|---|---|
| "BullMQ FlowProducer и children" | `bullmq` | Queue framework, not raw Redis |
| "Memcached SLAB tuning" | (no skill) | Different protocol, no persistence |
| "Postgres LISTEN/NOTIFY" | `postgresql` | Postgres-native pub/sub |
| "Prisma findMany page" | `prisma` | ORM query |
| "Fastify route schema" | `fastify` | HTTP framework |
| "Zod discriminated union" | `zod` | Validation library |
| "Next.js Server Action mutation" | `nextjs` | App Router pattern |
| "Node 24 worker_threads pool" | `nodejs` | Generic Node concurrency |
| "Telegram bot inline keyboard" | `telegram-bot` | Bot API, not data store |
| "BSD vs MIT license — что выбрать для своей либы" | (no skill) | Not Redis-specific |

## Edge cases — 5

| User-voice prompt | Resolution |
|---|---|
| "мигрировать с Redis 7.x на Valkey?" | **redis** PRIMARY (commands identical; surface BSL vs Apache-2.0 license tradeoff). Load `redis-8-whats-new.md` License section. |
| "vector search через FT.SEARCH" | **redis** PRIMARY (load `redis-8-whats-new.md` vector type); cross-link `postgresql` if user already has pgvector. |
| "BullMQ wire-format — какие структуры Redis использует" | Ambiguous. **bullmq** primary for queue surface, **redis** secondary for ZSET/HASH internals. Surface both. |
| "Cache Prisma findMany на 60s" | **redis** PRIMARY (load `caching-patterns.md` cache-aside); cross-link `prisma`. |
| "Redis как session store с Fastify" | **redis** PRIMARY (load `examples/session-store.md`); cross-link `fastify` for `@fastify/session` config. |

## How to verify (manual)

1. Open a fresh session with this skill in `~/.claude/skills/redis/`.
2. Paste each Positive prompt → confirm:
   - System reminder lists `redis` as active
   - Response references files matching "Expected behavior"
3. Paste each Negative prompt → confirm `redis` does NOT activate and the listed alternative skill is mentioned.
4. Edge cases: confirm the response calls out the cross-link explicitly ("primary: redis, see also: postgresql/prisma/bullmq").

If a prompt routes wrong:
- Negative → Positive → tighten `description` SKIP rules
- Positive → Negative → add the missing trigger term to `description`
- Edge routing only to one skill → enrich Related Skills cross-links

Run after any change to SKILL.md description or major reference restructure.
