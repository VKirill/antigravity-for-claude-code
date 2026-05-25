# Hono — Middleware

## Built-in middleware (import from `hono/<name>`)

| Middleware | Import | Purpose |
|---|---|---|
| `cors` | `hono/cors` | CORS allowlist + credentials |
| `logger` | `hono/logger` | Request log line per request |
| `etag` | `hono/etag` | Strong/weak ETag generation |
| `secureHeaders` | `hono/secure-headers` | CSP, HSTS, X-Frame-Options, etc. |
| `csrf` | `hono/csrf` | Origin header verification |
| `compress` | `hono/compress` | gzip/deflate response (Workers/Node) |
| `jwt` | `hono/jwt` | Verify Bearer JWT; sets `c.get('jwtPayload')` |
| `basicAuth` | `hono/basic-auth` | HTTP Basic |
| `bearerAuth` | `hono/bearer-auth` | Static bearer token |
| `bodyLimit` | `hono/body-limit` | Reject large bodies |
| `cache` | `hono/cache` | Cache API integration (Workers/CF) |
| `prettyJSON` | `hono/pretty-json` | Pretty-print on `?pretty` |
| `serveStatic` | `hono/serve-static` (adapter-specific) | Static files |
| `timeout` | `hono/timeout` | Abort slow handlers |
| `timing` | `hono/timing` | Server-Timing header |
| `requestId` | `hono/request-id` | Inject request ID header |
| `ipRestriction` | `hono/ip-restriction` | Allow/deny by IP CIDR |
| `combine` (`every`/`some`/`except`) | `hono/combine` | Compose middleware |

## CORS

```ts
import { cors } from 'hono/cors';
app.use('/api/*', cors({
  origin: ['https://example.com', 'https://staging.example.com'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Authorization', 'Content-Type'],
  credentials: true,
  maxAge: 86400,
}));
```

`origin` can be a function `(origin) => string | null`.

## JWT

```ts
import { jwt, sign, verify } from 'hono/jwt';

app.use('/admin/*', jwt({ secret: c.env.JWT_SECRET, alg: 'HS256' }));

app.get('/admin', (c) => {
  const payload = c.get('jwtPayload');  // typed via Variables augmentation
  return c.json({ payload });
});

// issue
const token = await sign({ sub: 'u1', exp: Math.floor(Date.now()/1000) + 900 }, secret, 'HS256');

// verify manually
const payload = await verify(token, secret, 'HS256');
```

## secureHeaders

```ts
import { secureHeaders } from 'hono/secure-headers';
app.use('*', secureHeaders({
  contentSecurityPolicy: { defaultSrc: ["'self'"] },
  strictTransportSecurity: 'max-age=31536000; includeSubDomains',
  xFrameOptions: 'DENY',
}));
```

Sets a recommended baseline (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, X-XSS-Protection, COOP, COEP, etc.).

## etag

```ts
import { etag } from 'hono/etag';
app.use('*', etag({ weak: true }));
```

Computes a hash of the body; returns 304 on `If-None-Match` match.

## bodyLimit

```ts
import { bodyLimit } from 'hono/body-limit';
app.post('/upload', bodyLimit({ maxSize: 10 * 1024 * 1024, onError: (c) => c.text('too big', 413) }), handler);
```

## Custom middleware

```ts
import type { MiddlewareHandler } from 'hono';

const requireAdmin: MiddlewareHandler<{ Variables: { user: User } }> = async (c, next) => {
  const u = c.get('user');
  if (u?.role !== 'admin') return c.json({ error: 'forbidden' }, 403);
  await next();
};

app.get('/admin', requireAdmin, handler);
```

Patterns:

- Always call `await next()` (or short-circuit via `return c.json(..., 4xx)`)
- Set variables via `c.set` BEFORE `await next()`
- Read response in `c.res` AFTER `await next()` (for logging, headers)

```ts
// Response-modifying middleware
const responseTimer: MiddlewareHandler = async (c, next) => {
  const start = Date.now();
  await next();
  c.res.headers.set('Server-Timing', `total;dur=${Date.now() - start}`);
};
```

## Multiple middleware on a route

```ts
app.post('/users', requireAuth, requireRole('admin'), zValidator('json', schema), handler);
```

Order is left-to-right. `zValidator` (or any validator) must come BEFORE the handler.

## `every` / `some` / `except`

```ts
import { every, some, except } from 'hono/combine';

app.use('/api/*', except('/api/public/*', requireAuth));
app.use('/api/*', some(apiKeyAuth, jwtAuth));   // OR
app.use('/api/*', every(jwtAuth, requireAdmin)); // AND
```

## Rate limiting

Built-in does NOT exist; use:
- Cloudflare Workers: bind a Durable Object or use `@hono-rate-limiter/cloudflare`
- Node: `hono-rate-limiter` (memory or Redis backend)

```ts
import { rateLimiter } from 'hono-rate-limiter';
app.use('/api/*', rateLimiter({ windowMs: 60_000, limit: 100, keyGenerator: (c) => c.req.header('x-forwarded-for') ?? 'anon' }));
```
