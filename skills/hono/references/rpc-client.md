# Hono — Type-safe RPC Client `hc<AppType>()`

## Server side — export the routes type

```ts
// server.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const app = new Hono();

const routes = app
  .get('/posts', (c) => c.json([{ id: 1, title: 'Hi' }]))
  .post('/posts', zValidator('json', z.object({ title: z.string() })), (c) => {
    const body = c.req.valid('json');
    return c.json({ id: 2, title: body.title }, 201);
  })
  .get('/posts/:id', (c) => c.json({ id: c.req.param('id'), title: 'X' }));

export type AppType = typeof routes;
export default app;
```

> CRITICAL: routes MUST be chained (`.get(...).post(...).get(...)`). Type inference only works on the chained value.

## Client side

```ts
import { hc } from 'hono/client';
import type { AppType } from '../server/app';

const client = hc<AppType>('https://api.example.com');

// GET /posts
const r1 = await client.posts.$get();
if (r1.ok) {
  const posts = await r1.json();  // typed [{ id: number; title: string }]
}

// POST /posts with json body
const r2 = await client.posts.$post({ json: { title: 'New' } });
const created = await r2.json();  // typed { id: number; title: string }

// GET /posts/:id — path param via `$get({ param })`
const r3 = await client.posts[':id'].$get({ param: { id: '42' } });
```

## Methods on each route

| Method | Sends |
|---|---|
| `$get({ query, header })` | GET |
| `$post({ json, form, query, header })` | POST |
| `$put({ json, ... })` | PUT |
| `$patch({ ... })` | PATCH |
| `$delete({ ... })` | DELETE |
| `$url({ param, query })` | Builds the URL only — doesn't fetch |

## Custom `fetch`

```ts
const client = hc<AppType>('https://api.example.com', {
  fetch: (input, init) => fetch(input, { ...init, credentials: 'include' }),
  headers: { 'x-app-version': '2026.05' },
});
```

For per-request headers:

```ts
await client.posts.$get({}, { headers: { Authorization: `Bearer ${token}` } });
```

## Response narrowing

```ts
const res = await client.posts.$post({ json: { title: 'Hi' } });
if (res.ok) {
  const data = await res.json();   // 201 success type
} else if (res.status === 400) {
  const err = await res.json();    // typed 400 response if defined
}
```

Define multiple response statuses in your zValidator + route to widen the union.

## Splitting clients

For huge APIs, split the AppType to reduce TS compile time:

```ts
// server
const usersRoutes = new Hono().get('/users', ...).post('/users', ...);
const postsRoutes = new Hono().get('/posts', ...).post('/posts', ...);
const app = new Hono().route('/api', usersRoutes).route('/api', postsRoutes);
export type UsersType = typeof usersRoutes;
export type PostsType = typeof postsRoutes;
```

Client imports only what it needs.

## Monorepo setup (pnpm workspace)

```
apps/
  api/         # Hono server — exports AppType
  web/         # React/Next consumer — imports AppType
packages/
  shared/      # zod schemas shared between
```

In `apps/web/package.json`: `"dependencies": { "@my/api": "workspace:*" }`. Import: `import type { AppType } from '@my/api'`.

The shared `zod` schemas should be in `packages/shared` so both the server validator and any client-side form share them.

## Limitations

- Streaming responses (`streamSSE`) — the client returns the raw `Response`; you read the stream manually
- File uploads (`multipart/form-data`) — pass `{ form: { file: File } }`; types are weaker than JSON
- WebSockets — not RPC; use `c.upgradeWebSocket()` and a separate client
- Path params with multiple segments — chained slashes work but inference is heavier; prefer flat keys

## Performance

`hc<AppType>()` is a `Proxy`. Per-call overhead is sub-microsecond on the client. The server has no awareness of the client — types are erased at runtime; the client just builds standard `fetch` calls.
