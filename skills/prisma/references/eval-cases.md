# prisma — Eval Cases

v3 format: **user-voice phrasing** (Russian/typos/incomplete welcome) + **Expected behavior** column (which sub-files should load).

## Positive — should activate (10)

| User-voice prompt | Expected behavior |
|---|---|
| "обновился до prisma 7, теперь schema.prisma ругается что url нельзя в datasource" | Load `migration.md` + `troubleshooting.md` (datasource.url section); cite `prisma.config.ts` template; note import is `from 'prisma/config'` (not `@prisma/config`) |
| "P2024 timed out fetching connection pool, что делать" | Load `troubleshooting.md` (P2024 section) + `recommended-defaults.md` connection pool table |
| "медленный endpoint, у меня везде `include: { author: true, comments: true }`" | Load `relations-and-includes.md` + `wrong-vs-right.md` (include vs select pair); show `select` projection |
| "Prisma на Cloudflare Workers с Neon — как подключить" | Load `prisma-accelerate-and-pulse.md` (edge section) + `migration.md` (driver adapters); cite `PrismaNeon` from `@prisma/adapter-neon` |
| "interactive transaction для перевода денег между счетами" | Load `transactions.md` + `templates/transaction-pattern.ts.template`; show `Serializable` isolation + `P2034` retry |
| "prisma migrate dev падает Drift detected на CI" | Load `troubleshooting.md` (migration drift) + `migrations.md` shadow DB section |
| "написать $extends чтобы soft-delete всех моделей" | Load `client-queries.md` $extends section; show `$allModels` query interceptor pattern |
| "Cannot find module './generated/prisma/client' в production" | Load `troubleshooting.md` (generated client section); cite `postinstall: prisma generate` |
| "нужен composite unique index `@@unique([orgId, slug])`" | Load `schema-modeling.md` indexes section; show `@@unique` + name option |
| "Next.js dev hot reload плодит коннекции" | Load `wrong-vs-right.md` (singleton pair) + `troubleshooting.md`; show `globalThis` singleton pattern |

## Negative — should NOT activate (10)

| User-voice prompt | Should route to | Why |
|---|---|---|
| "Drizzle relation query with `with`" | `drizzle` (cascade) | Different ORM |
| "TypeORM @Entity decorator" | (no skill — legacy) | Out of scope |
| "raw `CREATE INDEX CONCURRENTLY ... USING gin`" | `postgresql` | Pure SQL, no Prisma |
| "pgBouncer transaction pooling config" | `postgresql` | DB ops |
| "MongoDB aggregation pipeline" | (general) | Prisma MongoDB is niche |
| "Supabase RLS UI policies" | `supabase` (cascade) | Platform-specific |
| "BullMQ worker concurrency 10" | `bullmq` | Queue, not ORM |
| "Zod discriminated union schema" | `zod` | Validation lib |
| "Fastify TypeBox type provider" | `fastify` | HTTP framework |
| "ioredis subscribe to channel" | `redis` | Cache, not ORM |

## Edge cases — 5

| User-voice prompt | Resolution |
|---|---|
| "Prisma на Cloudflare Workers с D1 binding" | **prisma** primary (load `migration.md` driver adapters + `prisma-accelerate-and-pulse.md` edge section); cross-link `hono` for the HTTP shell. Adapter: `PrismaD1` from `@prisma/adapter-d1`. |
| "добавить CHECK (price > 0) в Prisma модель" | **prisma** primary (load `migrations.md` custom SQL section); cross-link `postgresql` for constraint semantics. Prisma doesn't have a native `@check` attribute — use raw SQL migration. |
| "кэшировать `findUnique` в Redis на 60s" | **prisma** primary (cache-aside around the query) + cross-link `redis` for `SET EX` patterns. If Accelerate available, show `cacheStrategy: { ttl: 60 }` alternative. |
| "Prisma vs Drizzle в 2026" | Ambiguous — surface tradeoffs. Prisma: bigger ecosystem, mature migrations, type-safe but generated. Drizzle: lighter, closer to SQL, no codegen. Don't pick for the user. |
| "Prisma `$extends` для soft-delete" | **prisma** primary; load `client-queries.md` $extends section. Show `query.$allModels.findMany` interceptor that adds `where: { deletedAt: null }`. |

## How to verify (manual)

1. Open a fresh session with this skill loaded.
2. Paste each Positive prompt → confirm:
   - System reminder lists `prisma` as active
   - Response references files matching the "Expected behavior" column
3. Paste each Negative prompt → confirm `prisma` does NOT appear in the route, and the suggested skill is called out
4. Edge cases: confirm response calls out the cross-link explicitly ("primary: prisma; see also: hono / postgresql / redis")

If routing is wrong:
- Negative becoming Positive → tighten SKIP rules in description
- Positive becoming Negative → add the missing trigger term to description
- Edge routing only to one skill → enrich Related Skills cross-links

Run after any change to SKILL.md description or major reference restructure.
