# Fastify — Core API & Instance Lifecycle

## Instance creation

```ts
import Fastify, { type FastifyInstance } from 'fastify';

const app: FastifyInstance = Fastify({
  logger: { level: 'info' },
  trustProxy: true,
  bodyLimit: 1_048_576,           // 1 MB (v5 default ~ 1 MB)
  disableRequestLogging: false,    // set true to control logging yourself
  ignoreTrailingSlash: false,
  caseSensitive: true,
  requestIdHeader: 'x-request-id',
  genReqId: (req) => crypto.randomUUID(),
});
```

## Lifecycle

```text
new Fastify(opts)
  └── register(plugin)        (sync; lazy)
  └── decorate('x', value)    (sync)
  └── addHook('onReady', fn)
  └── ready()                 (compiles plugin tree once; throws on dep errors)
  └── listen({ port, host })  (calls ready() if not called)
  └── close()                 (runs onClose hooks; closes server + pino)
```

`await app.ready()` is REQUIRED before `app.inject()` in tests. `listen()` calls it implicitly.

## Hooks — full pipeline

Per-request (ordered):

| # | Hook | When |
|---|---|---|
| 1 | `onRequest` | After router matched; before body parsing |
| 2 | `preParsing` | Before body parsing — can transform raw stream |
| 3 | `preValidation` | After parsing; before schema validation |
| 4 | `preHandler` | After validation; before handler — **auth point** |
| 5 | handler | Your route function |
| 6 | `preSerialization` | Before JSON serialization of payload |
| 7 | `onSend` | After serialization; can mutate payload |
| 8 | `onResponse` | After response sent (logging, metrics) |
| - | `onError` | On any error during the chain |
| - | `onTimeout` | Connection timeout fires |
| - | `onRequestAbort` | Client disconnected |

Instance-scoped:

| Hook | When |
|---|---|
| `onReady` | Plugin tree compiled; before listen |
| `onListen` | After server is listening |
| `onClose` | App is closing — close DB pools here |
| `onRoute` | A route is being added — useful for OpenAPI generation |
| `onRegister` | A plugin is registered |

### Hook style

Async (preferred):

```ts
app.addHook('preHandler', async (req, reply) => {
  // throw or reply.send() short-circuits
  if (!req.headers.authorization) {
    return reply.code(401).send({ error: 'unauthorized' });
  }
});
```

Sync (legacy callback):

```ts
app.addHook('preHandler', (req, reply, done) => {
  // call done() to continue, done(err) to error, reply.send() to short-circuit
  done();
});
```

Do not mix `async` with calling `done()` — pick one.

## Decorators

```ts
app.decorate('db', prismaClient);          // instance: app.db
app.decorateRequest('user', null);          // per-request: request.user
app.decorateReply('apiVersion', '2026-05'); // per-reply: reply.apiVersion
```

For TypeScript, augment the module:

```ts
declare module 'fastify' {
  interface FastifyInstance { db: PrismaClient }
  interface FastifyRequest { user?: AuthenticatedUser }
}
```

Decorating with mutable objects (e.g., `null` placeholder for `user`) is faster than dynamic property assignment because V8 keeps the hidden class stable.

## Logger (Pino built-in)

```ts
Fastify({
  logger: {
    level: 'info',
    transport: process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty' }
      : undefined,
    redact: ['req.headers.authorization', '*.password'],
  },
});
```

In handlers: `req.log.info({ userId }, 'created user')` — `req.log` is a child logger with the request ID bound.

## Graceful shutdown

```ts
async function shutdown(signal: NodeJS.Signals) {
  app.log.info({ signal }, 'shutting down');
  try {
    await app.close();
    process.exit(0);
  } catch (err) {
    app.log.error({ err }, 'shutdown error');
    process.exit(1);
  }
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);

// Deadman timer
setTimeout(() => {
  app.log.error('forced exit after 30s');
  process.exit(1);
}, 30_000).unref();
```

`app.close()` runs `onClose` hooks in reverse plugin order. Register DB-close hooks via `fastify-plugin` to ensure they hoist correctly.

## Common options checklist

| Option | When to set |
|---|---|
| `trustProxy: true` | Behind a reverse proxy (Angie, ALB) — uses `X-Forwarded-For` |
| `bodyLimit: N` | Larger uploads (default ~1 MB in v5) |
| `keepAliveTimeout: 72_000` | Match upstream LB idle timeout + buffer |
| `connectionTimeout: 30_000` | Drop slow TCP connections |
| `disableRequestLogging: true` | Custom request logging only |
| `requestIdLogLabel: 'reqId'` | Pino log field name |
