# Fastify — Routing

## Shorthand methods

```ts
app.get('/users/:id', handler);
app.post('/users', handler);
app.put('/users/:id', handler);
app.patch('/users/:id', handler);
app.delete('/users/:id', handler);
app.head('/users/:id', handler);
app.options('/users/:id', handler);
```

## Full route declaration

```ts
app.route({
  method: 'POST',
  url: '/users',
  schema: {
    body: { /* JSON Schema */ },
    response: { 201: { /* schema */ } },
  },
  preHandler: [authenticate],
  config: { rateLimit: { max: 5, timeWindow: '1m' } },
  handler: async (req, reply) => {
    const user = await req.server.db.user.create({ data: req.body });
    return reply.code(201).send(user);
  },
});
```

## URL patterns

| Pattern | Example |
|---|---|
| `:param` | `/users/:id` → `req.params.id` |
| `*` wildcard | `/static/*` → `req.params['*']` |
| `:p1-:p2` | `/users/:userId-:postId` |
| Regex | `'/files/:file(^.*\\.png$)'` |

## req shape

```ts
req.params    // path params
req.query     // querystring (parsed)
req.body      // parsed body (after preParsing)
req.headers   // lowercased
req.cookies   // when @fastify/cookie registered
req.id        // request ID
req.log       // bound Pino child logger
req.ip
req.protocol
req.routeOptions.url    // v5: was req.routerPath in v4
req.server    // FastifyInstance
```

## reply shape

```ts
reply.code(201)
reply.header('x-foo', 'bar')
reply.type('application/json')
reply.serialize(payload)    // use response schema
reply.send(payload)
reply.redirect('/login', 302)
reply.callNotFound()
reply.elapsedTime           // ms since request start
```

`return` from a handler is equivalent to `reply.send()`. Don't both `return` AND call `send()`.

## Route prefix via plugin

```ts
app.register(async (api) => {
  api.get('/users', handler);
  api.get('/posts', handler);
}, { prefix: '/v1' });
// Resolves to /v1/users, /v1/posts
```

## Content-type parsers

Default: `application/json`, `text/plain`. Add custom:

```ts
app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer' }, (req, body, done) => {
  done(null, body);
});
```

For webhooks needing raw body alongside JSON (HMAC verification), use `fastify-raw-body` or a custom parser that stores `req.rawBody` before JSON parsing.

```ts
import fastifyRawBody from 'fastify-raw-body';

await app.register(fastifyRawBody, {
  field: 'rawBody',
  global: false,
  encoding: 'utf8',
  runFirst: true,
});

app.post('/webhook', { config: { rawBody: true }, ... }, async (req) => {
  const isValid = verifyHmac(req.rawBody, req.headers['x-signature']);
  // ...
});
```

## Per-route hooks

```ts
app.get('/admin', {
  preHandler: [requireAuth, requireRole('admin')],
  onResponse: [auditLog],
  handler: async () => ({ ok: true }),
});
```

## Route configuration object

`config` is forwarded to plugins (e.g., `@fastify/rate-limit` reads `config.rateLimit`). Useful for plugin-specific overrides.

## Async vs callback handlers

Always async:

```ts
app.get('/u', async (req, reply) => {
  const data = await fetchData();
  return data;  // serialized via response schema if defined
});
```

Avoid mixing `reply.send()` with `return` — pick one.

## 404 handler

```ts
app.setNotFoundHandler({
  preHandler: app.rateLimit(),
}, (req, reply) => {
  reply.code(404).send({ error: 'not_found', path: req.url });
});
```

## URL constraints (host, version)

```ts
app.route({
  method: 'GET',
  url: '/',
  constraints: { host: 'api.example.com', version: '2.0.0' },
  handler,
});
```

Useful for multi-tenant routing or API versioning via `Accept-Version` header.
