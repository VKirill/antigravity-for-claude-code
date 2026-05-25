# Troubleshooting — fastify

Symptom-indexed. Find what the user sees, follow the diagnosis steps, apply the fix. Required for `risk: high-stakes` skills per skill-evaluation v3.

---

## "schema validation failed" with cryptic AJV error path

**Symptoms**
- Client sees `400 { statusCode: 400, code: 'FST_ERR_VALIDATION', message: "body/items/2/email must match format \"email\"" }`
- The instance path (`body/items/2/email`) is technical-noise to the API consumer
- Default Fastify response leaks AJV internals

**Diagnose**
```ts
// Inspect raw err.validation array in setErrorHandler
app.setErrorHandler((err, req, reply) => {
  if (err.validation) {
    req.log.warn({ validation: err.validation }, 'validation failed');
    // err.validation = [{ instancePath, schemaPath, keyword, params, message }, ...]
  }
});
```

**Common causes**
- Default error path passed straight through to the client
- Mixed validation styles (TypeBox + plain JSON Schema + Zod adapter) → AJV instance differs

**Fix**
```ts
app.setErrorHandler((err, req, reply) => {
  if (err.validation) {
    return reply.code(400).send({
      error: 'validation_failed',
      details: err.validation.map((v) => ({
        path: v.instancePath || v.schemaPath,
        message: v.message,
      })),
    });
  }
  // ... fall through to generic 5xx mapper
});
```

---

## Raw body lost for webhooks (CloudPayments / YooKassa / Stripe HMAC fails)

**Symptoms**
- `Content-HMAC` / `Stripe-Signature` headers never verify
- Re-computed digest is stable across local tests but mismatches in prod
- Manual `JSON.stringify(req.body)` reorders keys / loses whitespace

**Diagnose**
```ts
// Log the bytes you're verifying vs what the client sent
app.post('/webhook', async (req) => {
  console.log('raw bytes:', (req as any).rawBody?.toString('utf8'));
  console.log('parsed:',    JSON.stringify(req.body));   // DIFFERENT
});
```

**Common causes**
- ❌ Default `application/json` parser invoked → original bytes garbage-collected before handler runs
- ❌ `JSON.stringify(req.body)` for HMAC — JSON key order is non-deterministic; whitespace and number formatting differ from sender

**Fix — capture raw body via content-type parser**
```ts
app.addContentTypeParser(
  'application/json',
  { parseAs: 'buffer' },
  (req, body, done) => {
    (req as any).rawBody = body;
    try { done(null, JSON.parse(body.toString('utf8'))); }
    catch (err) { (err as any).statusCode = 400; done(err as Error); }
  },
);

app.post('/webhook', async (req, reply) => {
  const sig = req.headers['content-hmac'] as string;
  const expected = crypto.createHmac('sha256', secret).update((req as any).rawBody).digest('base64');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return reply.code(403).send({ error: 'bad signature' });
  }
});
```

Or use `fastify-raw-body` (community plugin). See `examples/webhook-with-hmac.md`.

---

## Plugin encapsulation surprise (route doesn't see decorator)

**Symptoms**
- `app.db` works inside the plugin that creates it but `undefined` in sibling plugins
- Some routes see `req.user`, others see `undefined` for the same auth hook
- "decorator not found" thrown at `app.ready()`

**Diagnose**
```ts
app.register(async (app) => {
  app.decorate('db', prismaClient);          // ❌ only visible in this plugin
}, { prefix: '/users' });

app.get('/health', () => app.db.user.count()); // ❌ undefined
```

**Cause**
- Decorator created inside a regular plugin stays scoped to that plugin's children — not the parent or siblings

**Fix — wrap with `fastify-plugin`**
```ts
import fp from 'fastify-plugin';

const dbPlugin = fp(
  async (app) => { app.decorate('db', prismaClient); },
  { name: 'db' },
);
await app.register(dbPlugin);                 // ✅ hoisted to parent scope
```

See `references/plugins-ecosystem.md` for the `fp`-vs-no-`fp` matrix.

---

## `FST_ERR_*` error code matrix

| Code | Meaning | Fix |
|---|---|---|
| `FST_ERR_VALIDATION` | Schema rejected input | Inspect `err.validation` |
| `FST_ERR_NOT_FOUND` | No route matched | Set `setNotFoundHandler` |
| `FST_ERR_CTP_INVALID_TYPE` | No content-type parser for `Content-Type` | `addContentTypeParser` |
| `FST_ERR_CTP_BODY_TOO_LARGE` | Payload exceeds `bodyLimit` | Raise `bodyLimit` per-route, not globally |
| `FST_ERR_INSTANCE_ALREADY_LISTENING` | `listen()` called twice | Guard with `app.server.listening` |
| `FST_ERR_PLUGIN_TIMEOUT` | A plugin took > `pluginTimeout` | Raise `pluginTimeout` or fix slow init |
| `FST_ERR_DEC_ALREADY_PRESENT` | Decorator name collision | Rename or check `app.hasDecorator(name)` |
| `FST_ERR_REQ_INVALID_VALIDATION_INVOCATION` | Manual `req.validateInput()` misused | Use schema declaration |

---

## Logger silently dropped (no logs in production)

**Symptoms**
- `app.log.info(...)` produces output locally but nothing in prod
- Pino transport configured but no file written / no stdout

**Common causes**
- ❌ `transport: { target: 'pino-pretty' }` enabled in prod — pino-pretty is **dev only** and may throw on missing binding
- ❌ `level: 'silent'` set by env var
- ❌ Process stdout redirected by PM2/Docker to a file the user isn't tailing
- ❌ `disableRequestLogging: true` AND no custom `onResponse` hook

**Fix**
```ts
Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
    transport: process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty' }
      : undefined,                                      // ndjson to stdout in prod
  },
});
```
Then ship stdout via PM2 / journald / Loki — don't fight Pino. See `recommended-defaults.md`.

---

## 502 / 504 from upstream proxy (Fastify behind nginx/Angie)

**Symptoms**
- Sporadic 502 "upstream prematurely closed connection"
- Steady-state requests succeed; bursts fail
- Happens after a few seconds of idle

**Cause**
- Fastify's `keepAliveTimeout` (default `null` ≈ 5s in Node) **expires before** the LB's keepalive
- LB sends request on a socket Fastify just closed → 502

**Fix**
```ts
// Fastify side
Fastify({ keepAliveTimeout: 5_000 });

// Angie / nginx — must exceed Fastify's keepalive
upstream backend { keepalive 32; }
proxy_http_version 1.1;
proxy_set_header Connection "";
keepalive_timeout 65s;                                  // > Fastify's 5s
```

Rule: **LB keepalive > Fastify keepAliveTimeout**. See `recommended-defaults.md`.

---

## Memory leak from plugin lifecycle (closure over request)

**Symptoms**
- RSS grows steadily over hours/days
- Heap snapshot shows many `FastifyRequest` retained
- No leak in load test (short-lived process)

**Cause**
- Plugin or hook closed over a request/reply object that should have been GC'd
- Common: caching `req.log` or `request.user` in a module-scope `Map` without bound size

**Fix**
- Do not capture `request` / `reply` in module-scope state
- Use `app.decorateRequest('user', null)` placeholder + assign per-request — V8 keeps hidden class stable
- For per-request caches, use `request.requestContext` or `request.diagnosticsChannel`

---

## TypeBox vs Zod type provider conflict

**Symptoms**
- `withTypeProvider<TypeBoxTypeProvider>()` chained — but Zod schemas reject at runtime
- `req.body` typed `any` despite schema present

**Cause**
- Type provider must match the schema authoring tool
- `validatorCompiler` / `serializerCompiler` not set when using Zod

**Fix — single provider per instance**
```ts
// Zod path
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
const app = Fastify().withTypeProvider<ZodTypeProvider>();
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

// TypeBox path — no compiler setters needed (AJV native)
const app2 = Fastify().withTypeProvider<TypeBoxTypeProvider>();
```

Pick one. Mixing is supported but rarely worth the boilerplate. See `recommended-defaults.md` — Type providers table.

---

## WebSocket connection drops

**Symptoms**
- `@fastify/websocket` upgrades succeed then disconnect after ~5s
- Browser console: "WebSocket connection closed: 1006"

**Common causes**
- ❌ `keepAliveTimeout` too low — the upgrade socket inherits server keepalive
- ❌ Reverse proxy (Angie/nginx) without `proxy_read_timeout` raised for WS
- ❌ Forgot `upgrade` / `connection` headers in proxy config

**Fix**
```nginx
location /ws {
  proxy_pass http://backend;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_read_timeout 3600s;                             # long-lived WS
}
```

Also: set Fastify `keepAliveTimeout: 60_000` for WS-heavy services.

---

## Graceful shutdown drops in-flight requests

**Symptoms**
- On SIGTERM, in-flight requests get TCP RST instead of finishing
- Clients see "connection reset by peer"
- Deploy → spike of 502s for ~30s

**Cause**
- `app.close()` not awaited, OR process exits before close completes
- PM2 / k8s sends SIGKILL before `close()` finishes

**Fix**
```ts
async function shutdown(signal: NodeJS.Signals) {
  app.log.info({ signal }, 'shutting down');
  await app.close();                                    // MUST await
  process.exit(0);
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
setTimeout(() => process.exit(1), 30_000).unref();      // deadman
```

PM2: `kill_timeout: 30000`. k8s: `terminationGracePeriodSeconds: 35`. See `recommended-defaults.md`.

---

## Schema serialization rejects valid response (`additionalProperties: false` silently strips)

**Symptoms**
- Test asserts `res.body.user.email` — comes back `undefined`
- Field is present in handler return value
- Logs show no error; response just lacks the field

**Cause**
- Response schema doesn't list the field
- `additionalProperties: false` (default for response schemas with `fast-json-stringify`) silently strips it

**Fix — list every field in the response schema**
```ts
schema: {
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        email: { type: 'string' },                      // ← was missing
      },
    },
  },
}
```

This is by design — response schemas are an output allowlist (prevents secret leakage). The cost: you must explicitly list every field. Use TypeBox / Zod to derive the schema from the type so it can't drift.

---

## More symptoms?

If your symptom isn't listed, capture: full error stack with `err.code`, the relevant route's `schema`, the registered plugin tree (`app.printPlugins()`), and the reverse-proxy config. File an issue with that data; we extend this file when patterns repeat.
