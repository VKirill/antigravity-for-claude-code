# Troubleshooting — prisma

Symptom-indexed. Required for `risk: high-stakes` skills (skill-evaluation v3).

---

## Generated client not found / "Cannot find module './generated/prisma/client'"

**Symptoms**
- `Cannot find module './generated/prisma/client'` or `Cannot find module '@prisma/client'`
- TypeScript: `Cannot find name 'PrismaClient'`
- Worked locally; broke on CI / Docker / Vercel

**Diagnose**
```bash
ls -la generated/prisma 2>/dev/null || echo "no generated dir"
grep -A4 "generator client" prisma/schema.prisma
node -e "import('./generated/prisma/client').then(m => console.log(Object.keys(m)))"
```

**Common causes**
- Prisma 7 generates into a user-controlled directory (`output = "../generated/prisma"`). Import path must match the `output`.
- `prisma generate` never ran on the deploy host (no `postinstall` hook).
- `generated/` is in `.dockerignore` but not regenerated in the build.
- Using a v6 import (`from '@prisma/client'`) against a v7 generator block.

**Fix**
```json
// package.json — REQUIRED in Prisma 7
{ "scripts": { "postinstall": "prisma generate" } }
```
```ts
// Match this path to your generator block's `output`
import { PrismaClient } from './generated/prisma/client';
```
Re-deploy. If on Vercel, add `prisma generate &&` to the build command.

---

## "datasource.url is required" / "url is not allowed in datasource block"

**Symptoms**
- `Error: P1012 ... The url field must not be defined`
- Or the inverse: `Error: P1012 ... datasource db must have a url`

**Cause**
- Prisma 7 moved `datasource.url` OUT of `schema.prisma` INTO `prisma.config.ts`.
- v6 schemas with `url = env("DATABASE_URL")` inside the datasource block break under v7.

**Fix**

```prisma
// prisma/schema.prisma — v7
datasource db {
  provider = "postgresql"
  // NO url here
}
```

```ts
// prisma.config.ts — v7
// NOTE: import is from 'prisma/config' (NOT '@prisma/config').
import { defineConfig, env } from 'prisma/config';
import 'dotenv/config';

type Env = { DATABASE_URL: string };

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: { url: env<Env>('DATABASE_URL') },
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
});
```

If `dotenv` isn't loading: add `import 'dotenv/config'` at the top of `prisma.config.ts` (`prisma migrate` runs the config in a non-Node context that doesn't auto-load `.env`).

---

## P2024 — Connection pool exhausted / "timed out fetching a new connection"

**Symptoms**
- `PrismaClientKnownRequestError P2024: Timed out fetching a new connection from the connection pool`
- Spikes during traffic surges or long-running transactions
- App becomes unresponsive after N seconds

**Diagnose**
```sql
-- on the DB
SELECT pid, state, query_start, now()-query_start AS age, query
FROM pg_stat_activity
WHERE state IN ('active', 'idle in transaction')
ORDER BY age DESC LIMIT 20;
```
Look for `idle in transaction` rows older than a few seconds — those are leaked transactions holding pool slots.

**Common causes**
- Leaked transaction — handler threw before `tx` committed; client holds the slot until `timeout`.
- Pool too small for concurrency (`?connection_limit=5` on a 50-RPS service).
- External HTTP call inside a `$transaction(async tx => { await fetch(...) })` — keeps the slot occupied for network latency.
- Long-running `findMany` without `take` on a multi-million-row table.
- Many parallel processes (k8s replicas × pool size > Postgres `max_connections`).

**Fix**
1. Raise `connection_limit` in the connection string (see [recommended-defaults.md](recommended-defaults.md)).
2. Remove network calls from transactions — fetch BEFORE `$transaction`, write INSIDE.
3. Set `idle_in_transaction_session_timeout` so the DB self-defends.
4. Cap `maxWait` so callers see `P2024` faster than they pile up.
5. Front the DB with pgBouncer transaction mode (see `postgresql` skill).

```ts
const prisma = new PrismaClient({
  adapter,
  transactionOptions: { maxWait: 5000, timeout: 10000 },
});
```

---

## N+1 query (`include` not used, or N parallel `findUnique` in a loop)

**Symptoms**
- One endpoint takes 1–5 seconds though each query is fast
- `pg_stat_statements` shows the same `SELECT ... WHERE id = $1` with calls >> users
- `prisma:query` log shows one parent + N children

**Diagnose**
```ts
// Enable query log in dev
const prisma = new PrismaClient({ adapter, log: ['query'] });
```
Count queries per request.

**Common cause patterns**
```ts
// ❌ N+1 — separate findUnique per item
const posts = await prisma.post.findMany();
for (const p of posts) {
  p.author = await prisma.user.findUnique({ where: { id: p.authorId } });
}
```

**Fix — `include` (or `select`)**
```ts
const posts = await prisma.post.findMany({
  include: { author: true },                     // single SQL with JOIN
});

// Better — project only what the response needs
const posts = await prisma.post.findMany({
  select: { id: true, title: true, author: { select: { id: true, name: true } } },
});

// Batched by IDs
const authorIds = posts.map(p => p.authorId);
const authors = await prisma.user.findMany({ where: { id: { in: authorIds } } });
```

See `references/relations-and-includes.md`.

---

## Migration drift — "Drift detected: ..."

**Symptoms**
- `prisma migrate dev` reports: `Drift detected: Your database schema is not in sync with your migration history`
- CI fails on `prisma migrate deploy` saying schema is out of sync

**Diagnose**
```bash
prisma migrate diff \
  --from-url $DATABASE_URL \
  --to-migrations prisma/migrations \
  --exit-code
# exit 2 = drift
```

**Common causes**
- Someone ran a hand SQL `ALTER TABLE` directly on prod
- `prisma db push` was used in dev (no migration recorded), then `migrate deploy` in prod doesn't know about the change
- Two branches both added migrations; merge order changed the canonical history
- Provider added columns (e.g., Supabase auth schema) you don't track

**Fix**
1. Reset locally if data is disposable: `prisma migrate reset`.
2. Otherwise: `prisma migrate diff --from-url ... --to-schema-datamodel prisma/schema.prisma --script > fix.sql`, review, apply, then `prisma migrate resolve --applied <migration-name>` to record it.
3. For provider-managed schemas: declare them as external in `prisma.config.ts` (`tables.external: ['audit_log']`).

---

## `$transaction` timeout — "Transaction already closed"

**Symptoms**
- `Transaction already closed: A query cannot be executed on a closed transaction`
- Or `Transaction API error: Transaction not found. Transaction ID is invalid`
- Failure correlates with slow queries inside the transaction

**Cause**
- Interactive transaction exceeded the default `timeout` (5 s) — Prisma rolled back; subsequent operations on `tx` fail.
- HTTP / S3 / sleep inside the callback ate the budget.

**Fix**
```ts
// Bump timeout — see recommended-defaults.md for ranges
const result = await prisma.$transaction(
  async (tx) => { /* ... */ },
  { maxWait: 5000, timeout: 30000, isolationLevel: 'ReadCommitted' },
);
```

Better: move slow work OUT of the transaction. Compute → enter tx → write atomically → exit.

---

## Slow `findMany` with many `include` (over-fetching)

**Symptoms**
- One endpoint returns 5–50 MB JSON
- p99 latency >> p50
- DB CPU rises with no obvious slow query — many "fast" queries adding up

**Cause**
- `include: { posts: true, comments: true, tags: true }` drags entire related rows
- Prisma rewrites this as multiple SQL queries plus client-side join; payload explodes

**Fix**
```ts
// Replace include with select projection
const user = await prisma.user.findUnique({
  where: { id },
  select: {
    id: true,
    name: true,
    posts: { select: { id: true, title: true, createdAt: true }, take: 10, orderBy: { createdAt: 'desc' } },
  },
});
```

Pair with a `take` on every nested relation. See `references/performance-and-indexes.md`.

---

## Driver adapter peer-dep mismatch

**Symptoms**
- `Error: The adapter @prisma/adapter-pg@7.4.0 is not compatible with @prisma/client@7.6.0`
- Or runtime error: `adapter.queryRaw is not a function`

**Cause**
- Prisma 7 enforces matching major.minor between client and adapter. `7.4.x` ↔ `7.4.x`, `7.6.x` ↔ `7.6.x`.

**Fix**
```bash
# Pin both to the same version
npm i @prisma/client@7.6.0 prisma@7.6.0 @prisma/adapter-pg@7.6.0
npx prisma generate
```

Also re-pin all other extensions you use: `@prisma/extension-accelerate`, `@prisma/extension-pulse`.

---

## "Cannot find name 'X'" after schema change

**Symptoms**
- TypeScript: `Property 'newField' does not exist on type 'User'`
- Just edited `schema.prisma` to add a field

**Cause**
- Generated client is stale — `prisma generate` not re-run

**Fix**
```bash
prisma generate
# In editors: restart TS server (VS Code: "TypeScript: Restart TS Server")
```

For CI/CD: ensure `postinstall: prisma generate` is set so every fresh install regenerates.

---

## ESM / CJS mismatch — `ERR_REQUIRE_ESM`

**Symptoms**
- `Error [ERR_REQUIRE_ESM]: require() of ES Module ./generated/prisma/client not supported`
- Or the inverse with `import` in a CJS package

**Cause**
- Generator block sets `moduleFormat = "esm"` but a `require()` consumer reaches in
- Or `"cjs"` but the rest of the app is ESM (`"type": "module"`)

**Fix**

Either flip the generator setting to match your consumers:
```prisma
generator client {
  provider     = "prisma-client"
  output       = "../generated/prisma"
  moduleFormat = "cjs"     // or "esm"
}
```
Then `prisma generate` and confirm the import works from the consumer.

---

## `$queryRawUnsafe` and SQL injection

**Symptoms**
- Security review flags raw SQL with string interpolation
- Or you see `WHERE id = '${userInput}'` somewhere in the codebase

**Always**
```ts
// ❌ unsafe
await prisma.$queryRawUnsafe(`SELECT * FROM "User" WHERE id = '${userId}'`);

// ✅ tagged template — Prisma parameterizes
await prisma.$queryRaw`SELECT * FROM "User" WHERE id = ${userId}`;

// ✅ if you must pass an unsafe identifier (table/column name), validate against an allow-list
const ALLOWED = new Set(['name', 'email']);
if (!ALLOWED.has(sortBy)) throw new Error('invalid');
await prisma.$queryRawUnsafe(`SELECT * FROM "User" ORDER BY "${sortBy}"`);
```

---

## More symptoms?

Capture: Prisma version (`prisma --version`), generator block, adapter import, the error stack, and a sample of `prisma:query` log for the failing path. The Prisma error codes index: <https://www.prisma.io/docs/orm/reference/error-reference>.
