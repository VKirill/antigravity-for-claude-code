# Hono — Runtimes & Adapters

The route code is portable. The **entry file** differs per runtime.

## Cloudflare Workers

`src/index.ts`:

```ts
import { Hono } from 'hono';
type Bindings = { KV: KVNamespace; DB: D1Database };
const app = new Hono<{ Bindings: Bindings }>();
app.get('/', (c) => c.text('hi'));
export default app;  // app exposes a `fetch` method internally
```

`wrangler.toml`:

```toml
name = "my-api"
main = "src/index.ts"
compatibility_date = "2026-05-01"
[[kv_namespaces]]
binding = "KV"
id = "..."
[[d1_databases]]
binding = "DB"
database_id = "..."
```

Use `executionCtx.waitUntil(promise)` for fire-and-forget work after the response is returned.

## Bun

```ts
import app from './app.ts';
Bun.serve({ fetch: app.fetch, port: 3000 });
```

Bun supports Hono out of the box; no adapter needed.

## Deno

```ts
import app from './app.ts';
Deno.serve(app.fetch);
```

Or `Deno.serve({ port: 3000 }, app.fetch)`.

## Node.js (via @hono/node-server)

```ts
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import app from './app.ts';

app.use('/static/*', serveStatic({ root: './public' }));
serve({ fetch: app.fetch, port: 3000, hostname: '0.0.0.0' }, (info) => {
  console.log(`listening on ${info.address}:${info.port}`);
});
```

`@hono/node-server` is the canonical Node adapter. It implements the Fetch API on top of Node's `http`.

## Vercel Edge

`api/[[...route]].ts`:

```ts
import { Hono } from 'hono';
import { handle } from 'hono/vercel';

export const config = { runtime: 'edge' };

const app = new Hono().basePath('/api');
app.get('/hello', (c) => c.json({ hi: 'edge' }));

export default handle(app);
```

For Node runtime use `runtime: 'nodejs'` and import `handle` from `hono/vercel` same way — it adapts both.

## AWS Lambda

```ts
import { Hono } from 'hono';
import { handle } from 'hono/aws-lambda';
const app = new Hono();
app.get('/', (c) => c.text('hi'));
export const handler = handle(app);
```

Works with API Gateway v1 and v2 events automatically.

## Lambda@Edge / Lambda Function URLs

`hono/lambda-edge`:

```ts
import { handle } from 'hono/lambda-edge';
export const handler = handle(app);
```

## Fastly Compute@Edge

```ts
import app from './app';
addEventListener('fetch', (event) => event.respondWith(app.fetch(event.request)));
```

## Service Worker (browser)

```ts
import { Hono } from 'hono';
const app = new Hono();
app.get('/api/cached', (c) => c.json({ at: Date.now() }));
self.addEventListener('fetch', (e) => e.respondWith(app.fetch(e.request)));
```

## Picking a runtime

| Runtime | Best for |
|---|---|
| Cloudflare Workers | Global edge, sub-ms cold start, KV/D1/R2 needs |
| Bun | Maximum local-server throughput, native TS, monolith dev |
| Node.js | Existing Node infra, full ecosystem (Prisma native, BullMQ) |
| Vercel Edge | Co-located with Next.js / Vercel frontend |
| Deno | Standards-first, Deno-deploy, Edge-functions on Supabase |
| Lambda | Sporadic traffic, AWS-native (RDS, SQS, S3) |

## Cold-start vs steady-state

- Cold start: Workers ≈ 0–1 ms; Lambda ≈ 50–300 ms; Node ≈ 80–200 ms; Fastify ≈ 50 ms
- Steady: Fastify ≈ 80k rps; Hono on Bun ≈ 130k rps; Hono on Node ≈ 70k rps; Hono on Workers ≈ unlimited horizontally

Match the runtime to the traffic shape. Long-running connections (websockets, SSE) → Bun/Node. Short bursts at the edge → Workers.
