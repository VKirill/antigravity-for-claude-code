# Hono — Core API

## Instance

```ts
import { Hono } from 'hono';

type Bindings = { KV: KVNamespace; DB: D1Database };
type Variables = { user?: { id: string; role: 'user' | 'admin' } };

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
```

`Bindings` — what the runtime injects (Workers env vars, KV/D1 bindings).
`Variables` — what middleware stores via `c.set(key, val)` for the handler to `c.get(key)`.

## Context (`c`)

```ts
app.get('/users/:id', (c) => {
  const id = c.req.param('id');               // path param
  const q  = c.req.query('limit');             // string | undefined
  const all = c.req.queries('tag');            // string[]
  const body = await c.req.json();             // parsed JSON
  const text = await c.req.text();
  const buf = await c.req.arrayBuffer();
  const form = await c.req.parseBody();         // FormData → BodyData
  const headers = c.req.header();               // record
  const url = c.req.url;                        // string
  const method = c.req.method;                  // 'GET' | ...
  const path = c.req.path;                      // '/users/123'

  const kv = c.env.KV;                          // typed via Bindings
  const user = c.get('user');                   // typed via Variables

  c.executionCtx.waitUntil(somePromise);        // Workers only

  // responses
  return c.json({ id }, 200);
  // return c.text('hi', 200);
  // return c.html('<p>hi</p>');
  // return c.redirect('/login', 302);
  // return c.notFound();
  // return c.body(stream, 200, { 'content-type': 'application/octet-stream' });
});
```

## Routers

| Router | Pick when |
|---|---|
| `RegExpRouter` (default) | Most apps. Compiles to a single RegExp. O(1) match. |
| `TrieRouter` | Apps with very many static routes. |
| `LinearRouter` | One-route Lambdas — smallest bundle. |
| `SmartRouter` | Auto-picks RegExp + Trie at runtime. |

```ts
import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
const app = new Hono({ router: new RegExpRouter() });
```

`hono/tiny` is a smaller build for size-sensitive Lambdas.

## App lifecycle

1. Construct `new Hono()`.
2. Register routes & middleware (synchronously, in code order).
3. Export `app` (Workers/Deno/Bun) or pass `app.fetch` to a host adapter (Node, Lambda, Vercel).
4. Runtime calls `app.fetch(request, env, executionCtx)`.

## Error handling

```ts
app.onError((err, c) => {
  console.error(err);
  if (err instanceof HTTPException) return err.getResponse();
  return c.json({ error: 'internal_error' }, 500);
});

app.notFound((c) => c.json({ error: 'not_found', path: c.req.path }, 404));
```

`HTTPException` from `hono/http-exception`:

```ts
import { HTTPException } from 'hono/http-exception';
throw new HTTPException(401, { message: 'unauthorized' });
```

## Composition

```ts
const api = new Hono();
api.get('/users', handler);
api.get('/posts', handler);

const app = new Hono();
app.route('/api/v1', api);
// or
app.basePath('/api/v1').get('/health', () => c.json({ ok: true }));
```

## Streaming responses

```ts
import { stream, streamText, streamSSE } from 'hono/streaming';

app.get('/sse', (c) => {
  return streamSSE(c, async (s) => {
    for (let i = 0; i < 10; i++) {
      await s.writeSSE({ data: String(i), event: 'tick' });
      await s.sleep(1000);
    }
  });
});
```

## Constants & exports

- `app.fetch` — the standard fetch handler signature `(req, env, ctx) => Promise<Response>`
- `app.request(url, init)` — in-memory test invocation
- `app.routes` — readable list of registered routes (useful for introspection)
