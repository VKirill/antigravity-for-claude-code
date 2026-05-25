# Example — Prisma 7 on Cloudflare Workers (D1 / Neon)

Prisma 7 driver adapters make Prisma work on edge runtimes — no native binary, no TCP pool.

## Option A — Cloudflare D1 (SQLite at the edge)

### `prisma/schema.prisma`

```prisma
generator client {
  provider     = "prisma-client"
  output       = "../generated/prisma"
  runtime      = "workerd"
  moduleFormat = "esm"
}

datasource db {
  provider = "sqlite"
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  body      String
  createdAt DateTime @default(now())
}
```

### `prisma.config.ts`

```ts
// In Prisma 7 the package is `prisma/config` (NOT `@prisma/config`).
import { defineConfig } from 'prisma/config';

export default defineConfig({
  datasource: {
    // For local migrations against a local SQLite snapshot
    url: 'file:./local.db',
  },
  migrations: { seed: 'tsx prisma/seed.ts' },
});
```

### `wrangler.toml`

```toml
name = "edge-api"
main = "src/index.ts"
compatibility_date = "2026-05-01"

[[d1_databases]]
binding = "DB"
database_id = "..."
database_name = "edge-api-prod"
```

### `src/index.ts`

```ts
import { Hono } from 'hono';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1';

type Bindings = { DB: D1Database };
const app = new Hono<{ Bindings: Bindings }>();

app.get('/posts', async (c) => {
  const prisma = new PrismaClient({ adapter: new PrismaD1(c.env.DB) });
  const posts = await prisma.post.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
  return c.json(posts);
});

app.post('/posts', async (c) => {
  const { title, body } = await c.req.json();
  const prisma = new PrismaClient({ adapter: new PrismaD1(c.env.DB) });
  const post = await prisma.post.create({ data: { title, body } });
  return c.json(post, 201);
});

export default app;
```

### Migrations on D1

```bash
# Generate migration locally
prisma migrate dev --name init

# Apply to remote D1
wrangler d1 migrations apply edge-api-prod
```

Wrangler reads the generated migration SQL and applies it to D1.

## Option B — Neon serverless Postgres

```ts
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { PrismaClient } from '../generated/prisma/client';

// Workers don't have WebSocket polyfill — Neon uses its own HTTPS transport
neonConfig.fetchConnectionCache = true;

app.get('/users', async (c) => {
  const pool = new Pool({ connectionString: c.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaNeon(pool) });
  return c.json(await prisma.user.findMany({ take: 50 }));
});
```

Schema uses `provider = "postgresql"` instead of `"sqlite"`.

## Option C — Accelerate (any DB)

```ts
import { PrismaClient } from '../generated/prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

app.get('/users', async (c) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,   // prisma:// Accelerate URL
  }).$extends(withAccelerate());

  const users = await prisma.user.findMany({ cacheStrategy: { ttl: 60, swr: 600 } });
  return c.json(users);
});
```

Accelerate is the path of least resistance: works with any DB, brings cache + edge connection pool, ~50ms cold start.

## Important constraints

- Instantiate `PrismaClient` **per request** in Workers — the V8 isolate may persist between requests, but the binding (`c.env.DB`) is request-scoped for D1
- No `prisma migrate dev` against D1 directly — generate migrations locally against SQLite, then apply via `wrangler d1 migrations apply`
- Neon: use `@neondatabase/serverless` (HTTPS) NOT raw `pg` (TCP) inside Workers
- Accelerate URL replaces `DATABASE_URL`; raw Postgres URL becomes the "real" DB known only to Accelerate

## Comparison

| Adapter | Best for | Cold start | Edge compat |
|---|---|---|---|
| `PrismaD1` | SQLite at the edge, low-latency reads | <1ms | Workers |
| `PrismaNeon` | Postgres with global reads | 5–20ms | Workers / Vercel Edge |
| `PrismaPg` + Accelerate | Any Postgres + cache | 50ms first / <5ms cached | Anywhere |
| `PrismaLibSQL` (Turso) | Multi-region SQLite | 5–10ms | Workers / Node |
| `PrismaPg` raw | Self-hosted Postgres on Node | n/a | Node only |

Pick `PrismaD1` for greenfield edge apps with SQLite-friendly access patterns. Pick `PrismaNeon` or `PrismaPg + Accelerate` for production-grade Postgres with global reach.
