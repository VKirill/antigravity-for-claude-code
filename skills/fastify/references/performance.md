# Fastify — Performance

Fastify's per-request overhead is ~3–5× lower than Express; squeezing throughput further comes from schema serialization, hook discipline, and Pino async transport.

## Response schemas — biggest single win

Every hot route MUST have a `schema.response`:

```ts
app.get('/users', {
  schema: {
    response: {
      200: {
        type: 'array',
        items: {
          type: 'object',
          properties: { id: { type: 'string' }, email: { type: 'string' } },
        },
      },
    },
  },
}, async () => app.db.user.findMany());
```

This activates `fast-json-stringify` instead of `JSON.stringify`. Benchmarks: 2–3× faster serialization, plus the schema strips unknown fields (security + size win).

## Plugin tree compiled once

`app.register(plugin)` is queued; the tree compiles when you call `ready()` / `listen()`. NEVER register inside a route handler — it bypasses the compilation phase and degrades to per-request cost.

```ts
// ❌ catastrophic
app.get('/x', async (req, reply) => {
  app.register(somePlugin);
});
```

## Logger transport

Pino built-in. For dev only:

```ts
Fastify({
  logger: {
    transport: process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty' }
      : undefined,  // raw NDJSON in prod — pipe to a log shipper
  },
});
```

Never use `pino-pretty` in production. It's a sync transport and serializes on the request hot path.

## Logging discipline

`req.log.info('msg')` is cheap. `req.log.info({ huge }, 'msg')` where `huge` is megabytes of data — expensive. Pass small, structured fields.

For really hot paths:

```ts
Fastify({
  disableRequestLogging: true,
  logger: { level: 'info' },
});
// then add a manual onResponse hook that logs only what you need
```

## Keep-alive tuning

Behind a load balancer:

```ts
Fastify({
  keepAliveTimeout: 72_000,   // ms — longer than upstream LB idle (typically 60s)
  connectionTimeout: 30_000,
});
```

Mismatch → TCP RST races → 502s under load.

## Hook overhead

Every `addHook` adds work to every request. Prefer **per-route hooks** (`{ preHandler: ... }`) over global hooks for narrow concerns.

## `fast-querystring` parser

```ts
import qs from 'fast-querystring';
Fastify({ querystringParser: (str) => qs.parse(str) });
```

Negligible win vs default unless you have heavy query strings.

## Avoid sync I/O in handlers

```ts
// ❌ blocks event loop
const data = fs.readFileSync('config.json');

// ✅
const data = await fs.promises.readFile('config.json', 'utf8');
```

## HTTP/2

```ts
import { readFileSync } from 'node:fs';
const app = Fastify({
  http2: true,
  https: { key: readFileSync('key.pem'), cert: readFileSync('cert.pem') },
});
```

Use HTTP/2 only when terminating TLS in Node. Behind nginx/Angie, keep HTTP/1.1 to the upstream — multiplexing happens at the edge.

## Schema caching with `addSchema`

```ts
app.addSchema({ $id: 'user', /* ... */ });
app.get('/u', { schema: { response: { 200: { $ref: 'user#' } } } }, handler);
```

Ajv compiles the schema **once** and caches the validator/serializer.

## Benchmarking locally

```bash
npx autocannon -c 100 -d 10 http://localhost:3000/users
```

`autocannon` is built by the Fastify team; it's the closest to upstream-aligned numbers.

For flamegraphs:

```bash
npx clinic flame -- node --experimental-strip-types src/server.ts
```

## Common throughput killers

| Killer | Fix |
|---|---|
| No response schema | Add one — 2× win |
| `pino-pretty` in prod | Remove transport |
| Sync I/O in handler | Use async APIs |
| Hooks doing DB calls per request | Cache result on `request` |
| Global `preHandler` on all routes | Move to per-route |
| `JSON.stringify` of huge payloads | Stream the response instead |
| `keepAliveTimeout < LB idle` | Raise it |
| Logging full request body | Redact or omit |
