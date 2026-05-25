# Hono — Routing & Context

## Methods

```ts
app.get('/path', handler);
app.post('/path', handler);
app.put('/path', handler);
app.patch('/path', handler);
app.delete('/path', handler);
app.options('/path', handler);
app.on('PURGE', '/cache/:key', handler);  // custom method
app.on(['GET', 'HEAD'], '/static/*', handler);
app.all('/wildcard/*', handler);
```

## Patterns

| Pattern | Match |
|---|---|
| `/users/:id` | path param → `c.req.param('id')` |
| `/users/:id{[0-9]+}` | param with regex |
| `/static/*` | wildcard → `c.req.param('*')` |
| `/posts/:date{[0-9]{4}-[0-9]{2}-[0-9]{2}}/:slug` | composed |
| `/files/:path{.+\\.png$}` | regex with file ext |

## Sub-apps & basePath

```ts
const users = new Hono()
  .get('/', listUsers)
  .post('/', createUser)
  .get('/:id', getUser);

const app = new Hono()
  .route('/users', users)
  .route('/posts', posts);
```

OR via `basePath`:

```ts
const app = new Hono().basePath('/api/v1');
app.get('/users', handler);          // GET /api/v1/users
```

## Factory (createHandlers / createFactory)

Hono 4 adds `createFactory()` for composing typed middleware chains:

```ts
import { createFactory } from 'hono/factory';
const factory = createFactory<{ Variables: { userId: string } }>();

const handlers = factory.createHandlers(
  async (c, next) => { c.set('userId', '1'); await next(); },
  (c) => c.json({ uid: c.get('userId') }),
);

app.get('/me', ...handlers);
```

Use it to encapsulate auth + handler logic with shared types.

## Chaining for RPC inference

For `hc<AppType>()` to infer routes, chain them:

```ts
const routes = app
  .get('/posts', (c) => c.json([{ id: 1 }]))
  .post('/posts', zValidator('json', PostSchema), (c) => c.json(c.req.valid('json'), 201))
  .get('/posts/:id', (c) => c.json({ id: c.req.param('id') }));

export type AppType = typeof routes;
```

**The chain is what types the RPC client** — DO NOT register routes via separate `app.get(...)` calls without chaining if you want RPC types.

## Variables (typed per-request state)

```ts
type Variables = { user: User; reqId: string };
const app = new Hono<{ Variables: Variables }>();

app.use('*', async (c, next) => {
  c.set('reqId', crypto.randomUUID());
  await next();
});

app.get('/me', (c) => {
  const id = c.get('reqId');  // typed string
  return c.json({ id });
});
```

## Bindings (env)

Cloudflare Workers:

```ts
type Bindings = {
  KV: KVNamespace;
  DB: D1Database;
  AI: Ai;
  R2: R2Bucket;
  SECRET: string;
};
const app = new Hono<{ Bindings: Bindings }>();

app.get('/cached', async (c) => {
  const v = await c.env.KV.get('key');
  return c.json({ v });
});
```

Node:

```ts
type Bindings = { DATABASE_URL: string };
const app = new Hono<{ Bindings: Bindings }>();
// c.env will be populated via the adapter (see runtimes.md)
```

## Headers, cookies, query

```ts
const auth = c.req.header('Authorization');                 // string | undefined
const allHeaders = c.req.header();                          // record<string,string>
const limit = c.req.query('limit');                         // string | undefined
const tags = c.req.queries('tag');                          // string[]

import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
const sid = getCookie(c, 'sid');
setCookie(c, 'sid', 'abc', { httpOnly: true, secure: true, sameSite: 'Lax' });
deleteCookie(c, 'sid');
```

## File uploads

```ts
app.post('/upload', async (c) => {
  const body = await c.req.parseBody();
  const file = body.file as File;  // standard File
  const buf = await file.arrayBuffer();
  // store buf in R2/S3/etc.
  return c.json({ size: file.size, name: file.name });
});
```

Use `parseBody({ all: true })` for multiple files under the same key.

## Custom 404 / error per scope

```ts
const api = new Hono();
api.notFound((c) => c.json({ error: 'api_not_found' }, 404));
api.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'api_error' }, 500);
});

const app = new Hono().route('/api', api);
```
