# Hono 3 → 4 Migration

## Constructor generics

```ts
// v3
const app = new Hono<{ Env: { KV: KVNamespace } }>();

// v4
type Bindings = { KV: KVNamespace };
type Variables = { user?: User };
const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
```

`Env` was renamed and split into `Bindings` (runtime env / Workers bindings) and `Variables` (per-request mutable state via `c.set/c.get`).

## Cookie & JWT helpers moved

```ts
// v3
import { getCookie } from 'hono/utils/cookie';

// v4
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { jwt, sign, verify } from 'hono/jwt';
```

## `c.req.body()` removed

```ts
// v3
const body = await c.req.body();

// v4
const json = await c.req.json();
const text = await c.req.text();
const buf  = await c.req.arrayBuffer();
const form = await c.req.parseBody();
```

## `c.req.parseBody()` return type

Now returns `BodyData` (`Record<string, string | File>` with optional `[]` suffix for arrays). Use `parseBody({ all: true })` for repeated keys.

## Validator API

```ts
// v3
import { validator } from 'hono/validator';
app.post('/x', validator('json', (v) => v as MyType), handler);

// v4 — same, but `c.req.valid('json')` is mandatory
const data = c.req.valid('json');
```

For Zod, use `@hono/zod-validator` (was `hono/zod-validator`).

## `c.error()` removed

Use `throw new HTTPException(status, { message })` from `hono/http-exception`.

## `c.html()` strict-type-only

In v4, JSX integration is split:

```ts
import { html } from 'hono/html';
return c.html(html`<h1>${name}</h1>`);
```

With JSX (`tsconfig`: `"jsx": "react-jsx", "jsxImportSource": "hono/jsx"`):

```tsx
return c.html(<h1>{name}</h1>);
```

## `app.fire()` removed (Service Worker)

Use:

```ts
self.addEventListener('fetch', (e) => e.respondWith(app.fetch(e.request)));
```

## `app.notFoundHandler` → `app.notFound(handler)`

```ts
// v3
app.notFoundHandler((c) => c.text('not found', 404));

// v4
app.notFound((c) => c.json({ error: 'not_found' }, 404));
```

## `app.onError(handler)` typing

```ts
app.onError((err, c) => {
  // err is Error; HTTPException check:
  if (err instanceof HTTPException) return err.getResponse();
  return c.json({ error: 'server_error' }, 500);
});
```

## `serveStatic` is adapter-specific

```ts
// v3 generic
import { serveStatic } from 'hono/serve-static';

// v4 per-adapter
import { serveStatic } from '@hono/node-server/serve-static';     // Node
import { serveStatic } from 'hono/cloudflare-workers';            // Workers Sites
import { serveStatic } from 'hono/cloudflare-pages';              // Pages
import { serveStatic } from 'hono/bun';                            // Bun
import { serveStatic } from 'hono/deno';                           // Deno
```

## Middleware composition (`combine`)

```ts
// v3 — manual nesting
app.use('*', m1);
app.use('*', m2);

// v4 — new helpers
import { every, some, except } from 'hono/combine';
app.use('/api/*', every(m1, m2));
app.use('/api/*', except('/api/public/*', requireAuth));
```

## RPC client typing

```ts
// v3 — exported app instance type
type AppType = typeof app;

// v4 — export chained routes
const routes = app.get(...).post(...);
type AppType = typeof routes;
```

If your `hc<AppType>()` client suddenly shows `unknown` types, this is the cause.

## Migration checklist

- [ ] Replace `Env` generic with `Bindings`/`Variables`
- [ ] Replace `hono/utils/cookie` imports → `hono/cookie`
- [ ] Replace `hono/utils/jwt` → `hono/jwt`
- [ ] Replace `c.req.body()` with `.json()`/`.text()`/`.arrayBuffer()`/`.parseBody()`
- [ ] Replace `c.error()` with `throw new HTTPException(...)`
- [ ] Replace `hono/zod-validator` with `@hono/zod-validator`
- [ ] Switch `serveStatic` import to the per-adapter path
- [ ] Ensure RPC routes are chained for `hc<AppType>()`
- [ ] Update `app.notFoundHandler` → `app.notFound(handler)`
