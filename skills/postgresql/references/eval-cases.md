# postgresql — Eval Cases

v3 format: **user-voice phrasing** (Russian/typos/incomplete welcome) + **Expected behavior** column (which sub-files should load).

## Positive — should activate (10)

| User-voice prompt | Expected behavior |
|---|---|
| "почему запрос делает Seq Scan вместо Index Scan на orders" | Load `indexes-and-explain.md` + `troubleshooting.md` (Slow query section); show `EXPLAIN (ANALYZE, BUFFERS)` workflow |
| "RLS policy для мульти-тенант SaaS на PG18" | Load `roles-and-rls.md` + `examples/multi-tenant-rls.md`; show `CREATE POLICY` with `current_setting('app.tenant_id')` |
| "partial unique index для soft-deleted строк (WHERE deleted_at IS NULL)" | Load `indexes-and-explain.md` partial-index section + `wrong-vs-right.md` (CONCURRENTLY pair) |
| "pgBouncer в transaction pooling mode перед PG" | Load `performance-tuning.md` pool-modes + `recommended-defaults.md` pgBouncer table; note `SET LOCAL` requirement |
| "Postgres queue через SKIP LOCKED" | Load `transactions-and-isolation.md` SKIP LOCKED section; contrast with BullMQ in Related Skills |
| "pg_basebackup + WAL archive для PITR" | Load `replication-and-backup.md` PITR section + `recommended-defaults.md` backup retention |
| "pgvector embedding similarity search" | Load `extensions.md` pgvector section; show `CREATE INDEX USING hnsw` or `ivfflat` |
| "что нового в PG18 async I/O — поможет ли" | Load `pg-18-whats-new.md` async I/O section; show `io_method = 'worker'` / `'io_uring'`; `pg_aios` view |
| "заменить cuid() на uuidv7() в PG18" | Load `pg-18-whats-new.md` uuidv7 section + `data-types-and-modeling.md`; show `id uuid DEFAULT uuidv7()` |
| "CREATE INDEX блокирует таблицу, как concurrently" | Load `wrong-vs-right.md` (CONCURRENTLY pair) + `indexes-and-explain.md`; show INVALID index recovery |

## Negative — should NOT activate (10)

| User-voice prompt | Should route to | Why |
|---|---|---|
| "Prisma findUnique returning undefined" | `prisma` | ORM-specific |
| "Drizzle schema definition" | `drizzle` (cascade) | Different ORM |
| "MySQL InnoDB row format COMPRESSED" | `mysql` (cascade) | Different RDBMS |
| "SQLite WAL mode pragma" | (general) | Different dialect |
| "Redis SET EX TTL" | `redis` | Different store |
| "BullMQ flow children" | `bullmq` | Queue, not DB |
| "Fastify route schema setup" | `fastify` | HTTP framework |
| "Zod discriminated union" | `zod` | Validation lib |
| "Supabase auth.users hooks" | `supabase` (cascade) | Platform |
| "Next.js server action mutation" | `nextjs` | HTTP layer |

## Edge cases — 5

| User-voice prompt | Resolution |
|---|---|
| "Prisma migration to add CHECK constraint" | Ambiguous — **prisma** for the migration tooling + **postgresql** for the constraint syntax. Cross-link both; recommend `prisma migrate --create-only` then hand-edit the SQL |
| "Postgres LISTEN/NOTIFY vs Redis pub/sub" | Both surfaces relevant. Tradeoffs: LISTEN/NOTIFY = same transaction context, no extra service; Redis pub/sub = fan-out at scale, no DB load. Don't pick for the user — surface both |
| "tune work_mem for query spilling to disk" | **postgresql** PRIMARY (load `performance-tuning.md` + `troubleshooting.md` OOM section); cross-link `linux-sysadmin` for host RAM context. Show `SET LOCAL work_mem` per-query alternative |
| "encrypt sensitive columns in Postgres" | **postgresql** PRIMARY (load `extensions.md` pgcrypto section). Note PG18 `gen_random_uuid()` no longer needs pgcrypto; encryption itself still does |
| "uuidv7 vs cuid2 for IDs" | **postgresql** PRIMARY (load `pg-18-whats-new.md` uuidv7 section). Tradeoffs: DB-native vs client-side; sortable in both; cuid2 has client-side randomness, uuidv7 has ms-timestamp prefix |

## How to verify (manual)

1. Open a fresh session with this skill loaded.
2. Paste each Positive prompt → confirm:
   - System reminder lists `postgresql` as active
   - Response references files matching the "Expected behavior" column
3. Paste each Negative prompt → confirm `postgresql` is NOT the primary skill; the suggested fallback is called out
4. Edge cases: confirm response calls out the cross-link explicitly ("primary: postgresql; see also: prisma / linux-sysadmin / redis")

If routing is wrong:
- Negative becoming Positive → tighten SKIP rules in description
- Positive becoming Negative → add the missing trigger term to description
- Edge routing only to one skill → enrich Related Skills cross-links

Run after any change to SKILL.md description or major reference restructure.
