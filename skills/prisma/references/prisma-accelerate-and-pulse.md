# Prisma — Accelerate & Pulse

Both are managed Prisma services (paid) that extend the OSS client via `$extends`.

## Accelerate — query cache + edge connection pool

### What it gives you

1. **Global connection pool** — your Prisma client connects to Accelerate (HTTPS endpoint); Accelerate manages a warm pool to your DB. Makes Prisma usable from Workers/Vercel Edge (where TCP pools don't survive).
2. **Per-query result cache** — TTL + stale-while-revalidate. Massive read amplification.

### Setup

```bash
npm i @prisma/extension-accelerate
```

```ts
import { PrismaClient } from './generated/prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,   // prisma://accelerate.prisma-data.net/... key
}).$extends(withAccelerate());
```

`DATABASE_URL` is the Accelerate-issued `prisma://...` URL, not the raw Postgres connection string.

### Caching queries

```ts
const user = await prisma.user.findUnique({
  where: { id },
  cacheStrategy: { ttl: 60, swr: 3600 },     // 60s fresh, 1h SWR
});
```

| Option | Behavior |
|---|---|
| `ttl: N` | Cached response served for N seconds without re-running |
| `swr: M` | After TTL, serve stale up to M seconds while revalidating in the background |
| Both | Best of both: fresh for `ttl`, then stale-while-revalidating for `swr` |

### Cache invalidation

By tag:

```ts
await prisma.user.findMany({ cacheStrategy: { ttl: 300, tags: ['users'] } });
await prisma.$accelerate.invalidate({ tags: ['users'] });
```

Or by key:

```ts
await prisma.$accelerate.invalidateAll();
```

### Edge runtimes

Accelerate is the **recommended path** for Workers / Vercel Edge — no native TCP pool needed.

```ts
// Cloudflare Workers
import { PrismaClient } from './generated/prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

export default {
  async fetch(req, env: { DATABASE_URL: string }) {
    const prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL }).$extends(withAccelerate());
    const users = await prisma.user.findMany({ cacheStrategy: { ttl: 60 } });
    return Response.json(users);
  },
};
```

Instantiate per-request — the underlying HTTPS connection to Accelerate is pooled across requests by the runtime.

## Pulse — real-time change data capture (CDC)

### What it gives you

Streams Postgres `INSERT/UPDATE/DELETE` events to your application as typed Prisma events. Built on logical replication slots.

### Setup

```bash
npm i @prisma/extension-pulse
```

Enable logical replication on the DB (`wal_level=logical`) and create a publication.

```ts
import { PrismaClient } from './generated/prisma/client';
import { withPulse } from '@prisma/extension-pulse';

const prisma = new PrismaClient().$extends(withPulse({ apiKey: process.env.PULSE_KEY! }));

const sub = await prisma.user.subscribe({
  create: { after: { role: { equals: 'ADMIN' } } },
});

for await (const evt of sub) {
  // evt = { action: 'create', created: User }
  await notifyAdminCreated(evt.created);
}
```

Subscribe variants:

```ts
prisma.user.subscribe({ update: { ... } });
prisma.user.subscribe({ delete: { ... } });
prisma.user.subscribe();   // all actions
```

### Use cases

- Real-time dashboards (broadcast DB changes via WebSocket)
- Audit log → Kafka / S3
- Cache invalidation
- Trigger background jobs (instead of DB triggers + LISTEN/NOTIFY)
- Replicate data to search indexes (Algolia / Meili / Elastic)

### Tradeoffs

- Adds a hop (Pulse service in the middle)
- Latency: ~50–200ms from commit to event delivery
- Requires logical replication slot — back-pressure if the consumer can't keep up
- Free tier is limited; production usage is metered

## When to use which

| Need | Service |
|---|---|
| Workers/Edge + need DB | Accelerate (always) |
| Read-heavy with low write churn | Accelerate cache |
| Real-time UI updates from DB | Pulse |
| Sync DB to search/cache | Pulse |
| Audit/event sourcing | Pulse |

## Self-hosted alternatives

- Accelerate cache → Redis cache-aside (manual but free)
- Pulse → `LISTEN/NOTIFY` + `pg_logical_emit_message` + a self-hosted CDC pipe (Debezium, Kafka Connect)
- Edge connection pool → bring your own pgBouncer behind a public proxy or use Neon/Supabase REST APIs

Pick managed when ops cost > service cost; self-host when you have a DBA / SRE.
