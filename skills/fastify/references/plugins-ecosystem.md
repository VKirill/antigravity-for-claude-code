# Fastify — Plugins & Encapsulation

## Encapsulation rule

By default, plugins are **encapsulated** — a plugin sees its parent's decorators/hooks, but the parent does **not** see the child's. This is the core architectural primitive in Fastify.

```ts
async function pluginA(app) {
  app.decorate('foo', 1);  // visible only inside pluginA
}

app.register(pluginA);
console.log(app.foo);  // undefined — encapsulated
```

To **hoist** a decorator/hook to the parent, wrap with `fastify-plugin`:

```ts
import fp from 'fastify-plugin';

const dbPlugin = fp(async (app, opts) => {
  app.decorate('db', new PrismaClient());
}, { name: 'db', dependencies: [] });

await app.register(dbPlugin);
app.db;  // ✅ visible at parent scope
```

## When to use `fastify-plugin`

| Scenario | Wrap with `fp`? |
|---|---|
| Decorator must be visible globally (db, redis, config) | ✅ yes |
| Hook must apply to all routes (auth, request-id) | ✅ yes |
| Schema must be reused across sibling plugins | ✅ yes |
| Routes scoped to a prefix (e.g., `/v1/*`) | ❌ no — encapsulation isolates them |
| Plugin should not leak its hooks (rate-limit per route) | ❌ no |

## Dependency declaration

```ts
fp(async (app) => { /* ... */ }, {
  name: 'auth',
  dependencies: ['db', 'redis'],  // names of other fp-plugins
});
```

Fastify will throw at `ready()` if a dependency is missing.

## Plugin signature

```ts
import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

interface MyOpts {
  prefix?: string;
}

const myPlugin: FastifyPluginAsync<MyOpts> = async (app, opts) => {
  app.get(`${opts.prefix ?? ''}/health`, () => 'ok');
};

export default fp(myPlugin, { name: 'health' });
```

## Official plugins (high-traffic picks)

| Plugin | Purpose |
|---|---|
| `@fastify/cors` | CORS — register **first** before any route plugin |
| `@fastify/helmet` | Security headers (CSP, HSTS, X-Frame-Options) |
| `@fastify/rate-limit` | In-memory or Redis-backed rate limiting |
| `@fastify/jwt` | JWT sign/verify + `request.jwtVerify()` |
| `@fastify/cookie` | Cookie parsing + signed cookies |
| `@fastify/session` | Session storage (Redis backend recommended) |
| `@fastify/auth` | Compose multiple auth strategies |
| `@fastify/cors` | CORS |
| `@fastify/multipart` | `multipart/form-data` uploads (streaming) |
| `@fastify/static` | Serve static files |
| `@fastify/swagger` + `@fastify/swagger-ui` | OpenAPI 3 generation + UI |
| `@fastify/websocket` | WebSocket support |
| `@fastify/compress` | gzip / brotli |
| `@fastify/under-pressure` | Backpressure / health gating |
| `@fastify/sensible` | `reply.notFound()`, `reply.unauthorized()` etc. |
| `@fastify/env` | Env validation via JSON Schema |
| `@fastify/circuit-breaker` | Per-route circuit breaker |
| `@fastify/redis` | Shared Redis (ioredis) decorator |
| `@fastify/postgres` | pg pool decorator |

## Registration order matters

Register in this order for sanity:

1. `@fastify/sensible`
2. `@fastify/env` (validate env first)
3. `@fastify/helmet`, `@fastify/cors`
4. `@fastify/rate-limit`
5. `@fastify/jwt`, `@fastify/cookie`
6. App decorators (db, redis, queues) — all wrapped in `fp`
7. Route plugins (per feature, with `prefix`)
8. `@fastify/swagger` LAST (after all routes registered)

## Custom plugin: db decorator example

```ts
// plugins/db.ts
import fp from 'fastify-plugin';
import { PrismaClient } from '../generated/prisma/client';

export default fp(async (app) => {
  const db = new PrismaClient();
  await db.$connect();

  app.decorate('db', db);

  app.addHook('onClose', async () => {
    await db.$disconnect();
  });
}, { name: 'db' });

// app.ts
import dbPlugin from './plugins/db';
await app.register(dbPlugin);

// any route
app.get('/users', async () => app.db.user.findMany());
```

## Plugin loading order is sync, execution is async

`app.register(plugin)` is synchronous (returns immediately). Plugins run during `app.ready()` or `app.listen()` in **registration order**. Use `await` only when you need post-registration access (rare).

```ts
app.register(pluginA);
app.register(pluginB);
await app.ready();  // both run NOW, A before B
```
