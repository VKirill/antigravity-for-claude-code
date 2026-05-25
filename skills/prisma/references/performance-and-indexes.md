# Prisma — Performance & Indexes

## Index strategy

Add `@@index([col])` for every column that appears in:
- `where` clauses on queries that filter the table
- `orderBy` for queries that sort large result sets
- Foreign keys (Postgres does NOT auto-index FKs)

```prisma
model Order {
  id         String   @id @default(cuid())
  userId     String
  status     String
  createdAt  DateTime @default(now())

  @@index([userId, createdAt(sort: Desc)])    // composite for "user's recent orders"
  @@index([status])
  @@index([createdAt])                         // for global reports
}
```

## Composite index order matters

`@@index([a, b])` covers queries filtering by `a` OR `(a AND b)`. It does NOT efficiently cover queries filtering by `b` alone — that needs a separate index.

## Partial indexes (custom SQL)

Prisma can't express them in schema. Add via custom migration:

```sql
-- Unique email per non-soft-deleted user
CREATE UNIQUE INDEX user_email_active
  ON "User" (email) WHERE "deletedAt" IS NULL;

-- Index only pending orders
CREATE INDEX order_pending ON "Order" (created_at) WHERE status = 'PENDING';
```

## Reading the SQL Prisma emits

```ts
new PrismaClient({ log: ['query'] });
```

Or programmatically:

```ts
prisma.$on('query', (e) => {
  console.log({ query: e.query, params: e.params, duration: e.duration });
});
```

Take the SQL into `psql` and run `EXPLAIN (ANALYZE, BUFFERS)`. Look for:
- `Seq Scan` on filtered columns → missing index
- `Sort` step with `Disk` → `work_mem` too small or missing ordered index
- `Hash Join` with very high cost → consider `select` instead of `include`

## `select` vs `include` (most common win)

```ts
// 2× faster + half the memory
await prisma.user.findMany({
  select: { id: true, email: true },
});

// vs
await prisma.user.findMany({ /* selects all columns */ });
```

Especially impactful when models have large columns (Text, JSON, Bytes).

## N+1 detection

```ts
// In dev, add a logger hook that counts queries per request via AsyncLocalStorage
prisma.$on('query', (e) => {
  const ctx = als.getStore();
  if (ctx) ctx.queryCount++;
});
```

If a request makes 50+ Prisma calls, suspect N+1. Use `include` or `findMany({ where: { id: { in: ids } } })`.

## Connection pool

Driver adapter (`PrismaPg`) inherits the underlying `pg` pool config:

```ts
import { Pool } from 'pg';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                  // pool size
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});
const adapter = new PrismaPg(pool);
```

Rule of thumb: `max = (CPU cores * 2) + 1` per Node process. With PM2 cluster mode of N workers, set `max = totalAllowed / N`.

## pgBouncer compatibility

PgBouncer in `transaction` pooling mode breaks `PREPARE` statements. Use:

```ts
new PrismaPg({ connectionString, prepare: false });
```

Or run pgBouncer in `session` mode (lower throughput but full feature support).

## Query timeouts

Set DB-side timeout to bound slow queries:

```sql
ALTER ROLE myapp SET statement_timeout = '5s';
```

And inside transactions, use `prisma.$transaction(..., { timeout: 30_000 })` to keep idle txns in check.

## Caching layer

Cache-aside with Redis:

```ts
async function getUser(id: string) {
  const cached = await redis.get(`user:${id}`);
  if (cached) return JSON.parse(cached);
  const user = await prisma.user.findUnique({ where: { id } });
  if (user) await redis.set(`user:${id}`, JSON.stringify(user), 'EX', 300);
  return user;
}
```

Invalidate on writes: `await redis.del(\`user:${id}\`)`.

For per-query caching at the edge, see `prisma-accelerate-and-pulse.md`.

## Bulk writes

```ts
// 100× faster than 1k single creates
await prisma.user.createMany({ data: bigArray, skipDuplicates: true });

// For very large (>100k), use COPY FROM
import { from as copyFrom } from 'pg-copy-streams';
const stream = pgClient.query(copyFrom('COPY "User" (email) FROM STDIN'));
csvStream.pipe(stream);
```

## Monitoring

- Slow query log on the DB side (`log_min_duration_statement = 200`)
- `pg_stat_statements` extension for top-N slow queries
- Prometheus metrics via `previewFeatures = ["metrics"]` + `prisma.$metrics.prometheus()`
- OpenTelemetry spans via `previewFeatures = ["tracing"]`

## Anti-patterns

- ❌ Adding indexes "just in case" — every index slows writes; only index what's queried
- ❌ Multi-column indexes that duplicate single-column ones (`@@index([a])` + `@@index([a, b])` — the first is redundant)
- ❌ `include` on hot paths
- ❌ Running migrations on a live DB with `CREATE INDEX` (locks the table) — use `CREATE INDEX CONCURRENTLY` via custom SQL migration
- ❌ Forgetting `skipDuplicates: true` on idempotent seeds → unique violation on re-run
