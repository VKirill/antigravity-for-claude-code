# Node.js 24 — Production Architecture

> Node.js 24.14.1 (Active LTS) | Updated: 2026-05-15

---

## Framework Selection Matrix

| Framework | When to choose | Throughput | Cold start |
|---|---|---|---|
| **Hono 4** | Edge/serverless, Cloudflare Workers, Vercel, Deno Deploy | ~500k req/s | <1ms |
| **Fastify 5** | High-performance API, TypeScript-first, plugin ecosystem | ~80k req/s | ~50ms |
| **Express 5** | Legacy migration, maximum ecosystem/middleware | ~15k req/s | ~80ms |
| **NestJS** | Enterprise, DI, teams > 5, decorator-heavy | ~20k req/s | ~200ms |

Node 24 ships with native `fetch`, `WebSocket`, `URL`, `crypto` — do not polyfill.

---

## Express 5 Production Patterns

Express 5 (GA 2024) changes: `async` route handlers propagate rejections automatically — no more `next(err)` wrappers.

```ts
import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'node:http';

const app = express();

// Async handlers — Express 5 catches thrown errors automatically
app.get('/users/:id', async (req: Request, res: Response) => {
  const user = await userService.findById(req.params.id);
  if (!user) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    return;
  }
  res.json({ data: user });
});

// Centralized error handler — always 4 args
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  const status = err instanceof AppError ? err.statusCode : 500;
  const code = err instanceof AppError ? err.code : 'INTERNAL_ERROR';
  logger.error('Request error', { path: req.path, error: sanitizeError(err) });
  res.status(status).json({ error: { code, message: err.message } });
});

// Wrap with node:http for graceful shutdown control
const server = createServer(app);
```

**Express 5 breaking changes vs 4:**
- `req.params`, `req.query` values are never `undefined` — always strings
- Path regex syntax changed (`*` → `{*}`)
- Removed `res.redirect()` with status strings — use numeric codes only
- `router.param()` callback signature changed

---

## Fastify 5 Production Patterns

```ts
import Fastify from 'fastify';

const fastify = Fastify({
  logger: {
    transport: process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty' }
      : undefined,
    level: process.env.LOG_LEVEL ?? 'info',
  },
  // Disable X-Powered-By equivalent — Fastify doesn't add it
  disableRequestLogging: false,
  trustProxy: true, // if behind Nginx/load balancer
});

// Schema-based validation — Fastify compiles to AJV, ~5x faster than Joi
const schema = {
  body: {
    type: 'object',
    required: ['email'],
    properties: {
      email: { type: 'string', format: 'email' },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'object',
      properties: {
        data: { $ref: 'User#' },
      },
    },
  },
} as const;

fastify.post('/users', { schema }, async (request, reply) => {
  const user = await userService.create(request.body);
  return { data: user }; // auto-serialized via schema
});

// Fastify 5: type-safe plugins via TypeBox or JSON Schema
import { Type } from '@sinclair/typebox';

const UserSchema = Type.Object({
  id: Type.String(),
  email: Type.String({ format: 'email' }),
});
```

**Fastify 5 changes vs 4:**
- Full ESM-native, no CommonJS default export
- `reply.send()` deprecated in favor of `return` from handler
- `fastify.listen()` now always returns `Promise<string>` (address)
- Plugin encapsulation improved — `fastify-plugin` required for shared decorators

---

## Hono 4 Production Patterns

```ts
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { bearerAuth } from 'hono/bearer-auth';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const app = new Hono();

// Middleware chain
app.use('*', logger());
app.use('/api/*', cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') ?? [] }));
app.use('/api/private/*', bearerAuth({ token: process.env.API_TOKEN! }));

// Typed route with Zod validation
const createUserSchema = z.object({ email: z.string().email(), name: z.string().min(1) });

app.post('/api/users', zValidator('json', createUserSchema), async (c) => {
  const body = c.req.valid('json'); // fully typed
  const user = await userService.create(body);
  return c.json({ data: user }, 201);
});

// Error handling
app.onError((err, c) => {
  const status = err instanceof AppError ? err.statusCode : 500;
  return c.json({ error: { code: err.name, message: err.message } }, status);
});

// Node.js adapter
import { serve } from '@hono/node-server';
const server = serve({ fetch: app.fetch, port: 3000 });
```

---

## Project Structure — Feature-First

```
src/
├── app/
│   ├── index.ts          ← main() + graceful shutdown
│   └── server.ts         ← framework setup, middleware registration
├── features/
│   ├── users/
│   │   ├── users.router.ts
│   │   ├── users.service.ts
│   │   ├── users.repository.ts
│   │   └── users.schema.ts   ← Zod / TypeBox schemas
│   └── auth/
│       ├── auth.router.ts
│       └── auth.service.ts
├── shared/
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── rate-limit.middleware.ts
│   │   └── error.middleware.ts
│   ├── errors/
│   │   └── app-error.ts
│   ├── config/
│   │   └── env.ts            ← Zod-validated env singleton
│   └── lib/
│       └── logger.ts
└── types/
    └── index.ts
```

---

## AsyncLocalStorage — Request Context

Node 24 `AsyncLocalStorage` (stable since Node 16, optimized in 24) propagates context through async call chains without passing parameters.

```ts
import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestContext {
  requestId: string;
  userId?: string;
  startTime: number;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

// Middleware — inject context
export function contextMiddleware(req: Request, res: Response, next: NextFunction) {
  const ctx: RequestContext = {
    requestId: req.headers['x-request-id'] as string ?? crypto.randomUUID(),
    startTime: Date.now(),
  };
  requestContext.run(ctx, next);
}

// Anywhere in the call chain — no parameter drilling
export function getContext(): RequestContext {
  const ctx = requestContext.getStore();
  if (!ctx) throw new Error('Called outside request context');
  return ctx;
}

// Logger auto-picks up requestId
logger.info('Processing payment', { requestId: getContext().requestId });
```

**Node 24 optimization:** `AsyncLocalStorage` uses `AsyncContextFrame` internally — ~40% lower overhead vs Node 18.

---

## Module System

ESM is the default for new Node 24 projects:

```json
// package.json
{
  "type": "module",
  "engines": { "node": ">=24.0.0" }
}
```

```ts
// Node 24 native — no polyfills needed
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

// ESM dynamic import for lazy-loaded heavy modules
const sharp = await import('sharp'); // loads only when first needed
```

**Node 24 — type stripping (default):** Run `.ts` files directly — type stripping is enabled by default in Node 24. See [type-stripping.md](type-stripping.md).
