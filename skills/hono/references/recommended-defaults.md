# Recommended defaults — hono

The canonical values for Hono 4 in production. **All other files in this skill cite this table — do not redefine inline.** Source: synthesized from `hono.dev` docs, Hono 4 release notes, and operational experience across Workers / Node / Bun / Vercel Edge.

> Citation rule: when a recommendation depends on workload, give a default + a range + a "tune up when..." / "tune down when..." condition. Cargo-culting defaults is worse than no defaults.

## Runtime choice

| Runtime | Pick when | Avoid when |
|---|---|---|
| **Cloudflare Workers** | Global edge, sub-ms cold start, KV/D1/R2/Durable Objects | Long-lived connections (WS/SSE >30s), heavy Node ecosystem (Prisma native client, BullMQ) |
| **Bun** | Max local-server throughput (~130k rps), monolith dev, native TS without build step | Existing PM2/systemd shop; some Node ecosystem still has Bun bugs |
| **Node.js + `@hono/node-server`** | Existing Node infra, Prisma native client, BullMQ workers in same process | Need sub-ms cold start; want pay-per-request billing |
| **Vercel Edge** | Co-located with Next.js / Vercel frontend, mid-tier edge | Standalone API where you can use Workers directly (cheaper) |
| **Deno Deploy** | Standards-first, TypeScript native, Deno-only deps | Need `npm:` packages without compatibility shim |
| **AWS Lambda + API Gateway** | Sporadic traffic, AWS-native (RDS/SQS/S3) | Steady high QPS (Lambda is most expensive at scale) |

## Router choice

```ts
import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { TrieRouter } from 'hono/router/trie-router';
import { LinearRouter } from 'hono/router/linear-router';

const app = new Hono({ router: new RegExpRouter() });
```

| Router | Pick when | Bundle | Lookup |
|---|---|---|---|
| `RegExpRouter` (default) | Most apps. Compiles all routes to a single RegExp at startup | medium | O(1) match |
| `TrieRouter` | Hundreds of static routes — RegExp compilation gets slow | medium | O(depth) |
| `LinearRouter` | One-route Lambdas / Worker — smallest bundle, no compilation | tiny | O(n) |
| `SmartRouter` (explicit) | Lib-author wants the framework to choose | medium | auto |

**`hono/tiny`** — minimum-footprint build (~12 kB), drops dev-only helpers. Pick when bundle budget < 14 kB.

## Bindings & Variables typing

**Always** generic the `Hono` constructor — without it, `c.env` is `{}` and `c.get/set` is `unknown`.

```ts
type Bindings = {
  KV: KVNamespace;                         // Cloudflare KV
  DB: D1Database;                          // Cloudflare D1
  R2: R2Bucket;                            // Cloudflare R2
  COUNTER: DurableObjectNamespace;         // Durable Object
  JWT_SECRET: string;                      // Worker secret
};

type Variables = {
  user: { id: string; role: 'user' | 'admin' };
  requestId: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
```

> **Workers-only types**: `KVNamespace`, `D1Database`, `R2Bucket`, `DurableObjectNamespace`, `Queue<T>`, `Service`, `Hyperdrive`, `Ai`, `Fetcher`, `Vectorize` — all come from `@cloudflare/workers-types` (or via `wrangler types` codegen). Add `"types": ["@cloudflare/workers-types"]` to tsconfig.

## Cookies (`hono/cookie`)

```ts
import { setCookie, getCookie, setSignedCookie, deleteCookie } from 'hono/cookie';

setCookie(c, 'session', sessionId, {
  httpOnly: true,                          // not readable from JS
  secure: true,                            // HTTPS only (set false ONLY in local dev)
  sameSite: 'Strict',                      // Strict for first-party; Lax if cross-site nav needed
  maxAge: 86_400,                          // 24h
  path: '/',
  // domain: 'example.com',                // omit for host-only cookies (more secure)
});
```

| Knob | Default | Range | Notes |
|---|---|---|---|
| `httpOnly` | `false` | **`true` for session cookies** | prevents XSS-driven theft |
| `secure` | `false` | **`true` in prod** | reject over HTTP |
| `sameSite` | `Lax` | `Strict` / `Lax` / `None` | `None` requires `secure: true` and a clear cross-site need |
| `maxAge` | session | 900–2_592_000 | 15 min to 30 days |

> `__Host-` prefix (e.g., `__Host-session`) enforces `secure: true`, `path: '/'`, no `domain` — use for highest-stakes cookies.

## JWT middleware

```ts
import { jwt } from 'hono/jwt';

app.use('/admin/*', jwt({
  secret: c.env.JWT_SECRET,                // 256+ bits; from Worker secret, not code
  alg: 'HS256',                            // PIN algorithm — prevents `alg: none` attack
  // cookie: 'session',                    // OR read from cookie name
}));
```

**Algorithm pinning is non-negotiable.** Without `alg`, a forged JWT with `alg: none` could pass verification on older middleware versions. Always specify `alg` (or `algorithms` array for rotation).

For RS256 / EdDSA with key rotation, fetch the public JWK via `c.env.JWT_PUBLIC_KEY` and pin `alg: 'RS256'`.

## CORS — strict allowlist

```ts
import { cors } from 'hono/cors';

app.use('/api/*', cors({
  origin: ['https://app.example.com', 'https://admin.example.com'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowHeaders: ['Authorization', 'Content-Type'],
  credentials: true,
  maxAge: 86_400,
}));
```

| Knob | Default | Recommended | Notes |
|---|---|---|---|
| `origin` | (none) | **explicit allowlist or function** | `'*'` defeats `credentials: true` |
| `credentials` | `false` | `true` only with explicit origin list | needed for cookies / Authorization |
| `maxAge` | none | **86_400** | preflight cache — fewer OPTIONS round-trips |

> Dynamic origin pattern (recommended for staging + prod): `origin: (o) => allowedSet.has(o) ? o : null`.

## ETag + cache headers (per environment)

```ts
import { etag } from 'hono/etag';

// Workers: pair with cf.cacheTtl for edge cache
app.use('/static/*', etag({ weak: true }));

// Node: pair with reverse-proxy cache
app.get('/api/list', (c) => {
  c.header('Cache-Control', 'public, max-age=60, s-maxage=300');
  return c.json(data);
});
```

| Env | ETag strategy |
|---|---|
| Workers | `etag()` middleware + `cf: { cacheTtl }` — edge cache via Cache API |
| Node behind Angie | `etag()` + `Cache-Control: s-maxage` — Angie caches |
| Vercel Edge | `etag()` + `Cache-Control: s-maxage` + `cdn-cache-control` for Vercel CDN |

## RPC client (`hc<AppType>`) — type-safety boundary

```ts
// server.ts
const route = app
  .get('/posts', (c) => c.json([{ id: 1, title: 'Hi' }]))
  .post('/posts', zValidator('json', schema), (c) => c.json(c.req.valid('json'), 201));
export type AppType = typeof route;

// client.ts
import { hc } from 'hono/client';
const client = hc<AppType>('https://api.example.com');
```

**The `AppType` must be `typeof <chained-routes>`, not `typeof <app>`.** Once a route handler is type-erased (e.g., extracted to a separate module without `as const` schema), the RPC client falls back to `any`. Keep route declarations chained or use Hono's `createFactory()` pattern.

## Body limit middleware

```ts
import { bodyLimit } from 'hono/body-limit';

app.post('/upload',
  bodyLimit({
    maxSize: 10 * 1024 * 1024,              // 10 MB — set per-route, not global
    onError: (c) => c.json({ error: 'too large' }, 413),
  }),
  handler,
);
```

| Endpoint type | Recommended `maxSize` |
|---|---|
| JSON API | `100 * 1024` (100 KB) |
| File upload | `10 * 1024 * 1024` (10 MB) |
| Webhook (payment provider) | `64 * 1024` (64 KB) |

## Compression (env-specific)

| Runtime | Compression source |
|---|---|
| **Cloudflare Workers** | Built into the platform — do NOT use `hono/compress` (double-compresses) |
| **Vercel Edge** | Built into Vercel — skip middleware |
| **Node / Bun** | `hono/compress` middleware (gzip/deflate, 1024-byte threshold default) |
| **Behind Angie/nginx** | Let the proxy compress — skip middleware (CPU-cheaper at the proxy layer) |

```ts
// Node-only:
import { compress } from 'hono/compress';
app.use('*', compress({ encoding: 'gzip', threshold: 1024 }));
```

## Logger middleware (not built-in beyond stdout)

```ts
import { logger } from 'hono/logger';
app.use('*', logger((msg) => console.log(msg)));   // default is console.log
```

Hono ships no structured logger. For production:
- **Node**: pipe to Pino (`logger((m) => pino.info(m))`) or Winston
- **Workers**: pipe to Workers Logpush / Logflare / Axiom

## `@hono/zod-validator` — placement

```ts
import { zValidator } from '@hono/zod-validator';

app.post('/users',
  zValidator('json', z.object({ email: z.string().email() })),
  (c) => {
    const body = c.req.valid('json');                  // ✅ typed
    return c.json(body, 201);
  },
);
```

**Validate BEFORE the handler.** `c.req.valid('json')` only returns typed data when `zValidator('json', schema)` ran in the same chain. Targets: `json`, `query`, `param`, `header`, `form`, `cookie`.

## Workers-specific — KV / D1 / R2 / Durable Objects

```ts
type Bindings = {
  KV: KVNamespace;
  DB: D1Database;
  STORAGE: R2Bucket;
  RATE_LIMITER: DurableObjectNamespace;
};

app.get('/cache/:key', async (c) => {
  const cached = await c.env.KV.get(c.req.param('key'), 'json');
  if (cached) return c.json(cached);
  // ... fetch + KV.put with TTL
});
```

| Binding | Read pattern | Write pattern |
|---|---|---|
| `KVNamespace` | `await KV.get(key, 'json')` — eventually consistent | `await KV.put(key, value, { expirationTtl: 3600 })` |
| `D1Database` | `await DB.prepare('SELECT ...').bind(...).all()` | `await DB.prepare('INSERT ...').bind(...).run()` |
| `R2Bucket` | `await R2.get(key)` returns `R2Object \| null` | `await R2.put(key, body, { httpMetadata })` |
| `DurableObjectNamespace` | `const id = NS.idFromName('singleton'); const stub = NS.get(id); await stub.fetch(...)` | Same — stub is the proxy |

## `node-server` adapter vs native edge

```ts
// Node — must use the adapter
import { serve } from '@hono/node-server';
serve({ fetch: app.fetch, port: 3000, hostname: '0.0.0.0' });

// Workers / Bun / Deno — export `default app`, runtime calls `app.fetch` directly
export default app;
```

Mixing them is a common bug — `export default app` works on Workers but does nothing on Node (no auto-start).

## Citation rule

Other files in this skill MUST NOT redefine these values inline. Use:

> Defaults: see [recommended-defaults.md](recommended-defaults.md).

## Last verified

2026-05-15 against Hono 4.x official docs + `hono/*` middleware source.
