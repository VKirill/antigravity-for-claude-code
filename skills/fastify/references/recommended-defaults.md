# Recommended defaults — fastify

The canonical values for Fastify 5 in production. **All other files in this skill cite this table — do not redefine inline.** Source: synthesized from `fastify.dev` docs, Fastify 5 release notes, and operational experience behind Angie/nginx reverse proxies.

> Citation rule: when a recommendation depends on workload, give a default + a range + a "tune up when..." / "tune down when..." condition. Cargo-culting defaults is worse than no defaults.

## Server factory options

```ts
import Fastify from 'fastify';

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-api-key"]',
        '*.password',
        '*.token',
        '*.secret',
        '*.cardNumber',
      ],
      remove: true,
    },
    transport: process.env.NODE_ENV === 'production'
      ? undefined                          // ndjson to stdout — pipe to log shipper
      : { target: 'pino-pretty' },         // dev only
  },
  trustProxy: true,                        // set ONLY when behind a known reverse proxy
  bodyLimit: 1_048_576,                    // 1 MB — Fastify default
  connectionTimeout: 30_000,               // 30 s — Fastify default is `null` (disabled)
  keepAliveTimeout: 5_000,                 // MUST be < upstream LB keepalive
  requestTimeout: 30_000,                  // 30 s — Fastify default is `null` (disabled)
  disableRequestLogging: false,
  ignoreTrailingSlash: false,
  caseSensitive: true,
  ajv: {
    customOptions: {
      coerceTypes: 'array',
      useDefaults: true,
      removeAdditional: 'all',             // strip unknown fields from inputs
      allErrors: false,                    // fail-fast on first violation
    },
  },
});
```

| Option | Default (Fastify) | Recommended | Range | Tune-up when | Tune-down when |
|---|---|---|---|---|---|
| `bodyLimit` | `1_048_576` (1 MB) | **1 MB** | 64 KB – 50 MB | accepting file uploads (set on the route, not globally) | API only handles short JSON |
| `connectionTimeout` | `null` (disabled) | **30_000** | 10_000–120_000 | upstream is bursty | tight DoS budget — drop slower |
| `keepAliveTimeout` | `null` (~5 s in Node) | **5_000** in prod | must be **less** than upstream LB idle timeout | LB has long keepalive (e.g., AWS ALB 60s → set 5s here, 65s on LB) | direct client (no proxy) — can raise |
| `requestTimeout` | `null` (disabled) | **30_000** | 5_000–120_000 | uploads / long reports | strict SLO — fail fast |
| `trustProxy` | `false` | **`true`** behind Angie/nginx/CDN | `true` / IP allowlist string | known proxy chain | direct internet exposure |
| `pluginTimeout` | `30_000` | **30_000** | 10_000–120_000 | slow DB warmup in plugin | unit-test speed |

> **`keepAliveTimeout` rule**: Fastify's keep-alive must EXPIRE BEFORE the upstream LB's. Otherwise the LB sends a request on a socket Fastify just closed → 502/504. Standard pattern: LB 60s → Fastify 5s.

## Type providers — when each

| Provider | Pick when | Avoid when |
|---|---|---|
| `@fastify/type-provider-typebox` (TypeBox) | Schema-first, want JSON Schema output for OpenAPI, no Zod elsewhere | Already using Zod across the codebase |
| `fastify-type-provider-zod` (Zod adapter — community) | Already using Zod for env / frontend / shared schemas | Need JSON Schema output without `z.toJSONSchema()` plumbing |
| `@fastify/type-provider-json-schema-to-ts` | Plain JSON Schema files already exist (codegen / openapi) | Want runtime ergonomics — JSON Schema is verbose |

> Mixing two providers on one instance is supported but adds boilerplate (two compiler setters, two type generics). Default: pick one per service.

## Schema-based serialization (the hot path)

Response schemas drive `fast-json-stringify` — **2–4× faster** than `JSON.stringify` AND act as an output allowlist (`additionalProperties: false` strips fields silently).

```ts
schema: {
  response: {
    200: { type: 'object', properties: { id: { type: 'string' } }, additionalProperties: false },
  },
}
```

**Always define `response` schema for every public route.** Without it: full `JSON.stringify`, no field stripping, no documentation.

## Plugin `fastify-plugin` (`fp`) — encapsulation

| Scenario | Wrap with `fp`? |
|---|---|
| Decorator must be visible globally (`app.db`, `app.redis`, `app.queues`) | **YES** |
| Hook applies to all routes (auth `onRequest`, request-id, error mapper) | **YES** |
| Schemas shared across sibling plugins (`app.addSchema(...)`) | **YES** |
| Routes scoped to a prefix (`/v1/*`, feature modules) | **NO** (encapsulation isolates them — that's the point) |
| Rate-limit per route, scoped middleware | **NO** |

> Wrong `fp` usage = silent action-at-a-distance bugs (a plugin's hook fires on routes it shouldn't, or doesn't fire on routes it should).

## Plugin registration order

1. `@fastify/sensible` — adds error helpers used by later plugins
2. `@fastify/env` — validate env BEFORE anything reads `process.env`
3. `@fastify/helmet` — security headers
4. `@fastify/cors` — strict allowlist (see CORS below)
5. `@fastify/rate-limit` — before auth so anonymous floods are blocked first
6. `@fastify/cookie`, `@fastify/jwt` — auth primitives
7. App decorators (db, redis, queues) — all wrapped in `fp`
8. Route plugins (per feature, with `prefix`)
9. `@fastify/swagger` + `@fastify/swagger-ui` — LAST so it sees all routes

## Rate limit (`@fastify/rate-limit`)

```ts
await app.register(import('@fastify/rate-limit'), {
  max: 100,                  // requests
  timeWindow: '1 minute',
  cache: 10_000,
  allowList: ['127.0.0.1'],
  redis: app.redis,          // for multi-instance — otherwise in-memory per instance
  skipOnError: false,        // fail-closed — block when limiter is broken
});
```

| Knob | Default | Range | Notes |
|---|---|---|---|
| `max` | **100** | 30–10_000 | per-IP per window |
| `timeWindow` | `1 minute` | seconds–minutes | match downstream tolerance |
| `redis` | none | required for >1 instance | otherwise per-process counts diverge |
| `skipOnError` | **false** | true/false | fail-closed default — `true` only when limiter outage > brief flood |

## CORS — strict allowlist

```ts
await app.register(import('@fastify/cors'), {
  origin: (origin, cb) => {
    const allowed = ['https://app.example.com', 'https://admin.example.com'];
    if (!origin || allowed.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed'), false);
  },
  credentials: true,                       // cookies/Authorization
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  maxAge: 86_400,
});
```

**`origin: '*'` is incompatible with `credentials: true`.** The browser silently drops the request. For public APIs without credentials, `'*'` is fine.

## JWT (`@fastify/jwt`)

```ts
await app.register(import('@fastify/jwt'), {
  secret: process.env.JWT_SECRET!,         // 256+ bits; rotate via JWKS or kid-versioned secrets
  sign: { expiresIn: '15m', algorithm: 'HS256' },
  verify: { algorithms: ['HS256'] },        // PIN algorithm — prevents `alg: none` attack
});
```

> **Secret rotation**: keep `oldSecret` valid for 1 grace period. Verify with both; sign with `newSecret`. Or move to RS256/JWKS and rotate keys.

## HTTPS termination

| Layer | Pick when |
|---|---|
| **Angie / nginx in front** | Production default. Fastify speaks plain HTTP on `127.0.0.1`. TLS terminates at proxy. Easy cert rotation (`certbot --reload`). |
| **Fastify direct HTTPS** | Embedded appliances, single-process deploys without a reverse proxy. Pass `https: { key, cert }` to `Fastify()`. |

Direct HTTPS in production is a smell — you've reinvented nginx's TLS pipeline poorly.

## Graceful shutdown

```ts
async function shutdown(signal: NodeJS.Signals) {
  app.log.info({ signal }, 'shutting down');
  try {
    await app.close();                     // drains in-flight, runs onClose hooks
    process.exit(0);
  } catch (err) {
    app.log.error({ err }, 'shutdown error');
    process.exit(1);
  }
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
setTimeout(() => { app.log.error('forced exit'); process.exit(1); }, 30_000).unref();
```

PM2: set `kill_timeout: 30000` to match. k8s: `terminationGracePeriodSeconds: 35` (5 s headroom > Fastify deadman).

## Webhooks — raw body for HMAC

For CloudPayments / YooKassa / Stripe webhooks, the HMAC is computed over **raw bytes**. Fastify default JSON parser destroys the byte order — use `fastify-raw-body` (community plugin) **or** a custom content-type parser:

```ts
app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
  (req as any).rawBody = body;             // keep bytes for HMAC
  try { done(null, JSON.parse(body.toString('utf8'))); }
  catch (err) { (err as any).statusCode = 400; done(err as Error); }
});
```

See `examples/webhook-with-hmac.md`.

## Citation rule

Other files in this skill MUST NOT redefine these values inline. Use:

> Defaults: see [recommended-defaults.md](recommended-defaults.md).

## Last verified

2026-05-15 against Fastify 5.x official docs + `@fastify/*` plugin READMEs.
