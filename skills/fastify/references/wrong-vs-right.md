# Wrong vs Right — fastify

Side-by-side pairs of the wrong pattern (compiles, runs, fails in production) and the right one. Per skill-evaluation v3 for `risk: high-stakes` skills.

---

## 1. Schema-based serialization

**❌ Wrong — no response schema, full `JSON.stringify`, leaks fields:**
```ts
app.get('/users/:id', async () => {
  const user = await app.db.user.findUnique({ where: { id: '1' } });
  return user;                      // returns password_hash, internal_notes, ...
});
```

**✅ Right — response schema strips unknown fields + 2–4× faster serialization:**
```ts
app.get('/users/:id', {
  schema: {
    response: {
      200: {
        type: 'object',
        properties: { id: { type: 'string' }, email: { type: 'string' } },
        additionalProperties: false,   // strip anything else
      },
    },
  },
}, async () => app.db.user.findUnique({ where: { id: '1' } }));
```

**Why it matters:** without a response schema Fastify falls back to `JSON.stringify` over the whole object — slower AND every internal field that ever ends up on the result leaks to the client. The schema is your **output allowlist** as well as your performance lever.

---

## 2. Raw body for webhook HMAC

**❌ Wrong — body-parser eats the raw stream, HMAC fails silently:**
```ts
app.post('/webhook', async (req, reply) => {
  const sig = req.headers['content-hmac'] as string;
  // req.body is already parsed JSON; original bytes are gone
  if (!verify(sig, JSON.stringify(req.body))) return reply.code(403).send();
  // works in dev (signatures match by accident on simple payloads), fails in prod
});
```

**✅ Right — capture raw body via content-type parser:**
```ts
app.addContentTypeParser(
  'application/json', { parseAs: 'buffer' },
  (req, body, done) => {
    (req as any).rawBody = body;
    try { done(null, JSON.parse(body.toString('utf8'))); }
    catch (err) { (err as any).statusCode = 400; done(err as Error); }
  },
);

app.post('/webhook', async (req, reply) => {
  const sig = req.headers['content-hmac'] as string;
  if (!verify(sig, (req as any).rawBody)) return reply.code(403).send();
});
```

**Why it matters:** HMAC is computed over the bytes the client sent. `JSON.stringify(req.body)` re-orders keys, drops whitespace, and changes number formats — the recomputed digest never matches the sender's once the payload has any complexity.

---

## 3. Plugin encapsulation — `fastify-plugin`

**❌ Wrong — decorator stays scoped, siblings see `undefined`:**
```ts
app.register(async (app) => {
  app.decorate('db', new PrismaClient());
});

app.get('/health', () => app.db.user.count());  // ❌ app.db is undefined
```

**✅ Right — wrap with `fp` to hoist to parent scope:**
```ts
import fp from 'fastify-plugin';

const dbPlugin = fp(async (app) => {
  app.decorate('db', new PrismaClient());
}, { name: 'db' });

await app.register(dbPlugin);
app.get('/health', () => app.db.user.count());  // ✅ visible
```

**Why it matters:** plugin encapsulation is Fastify's core primitive. Without `fastify-plugin`, decorators/hooks stay inside the plugin's subtree. The error is asymmetric: routes registered before the plugin work (they inherit nothing), routes after the plugin "feel like" they should see it but don't. Use `fp` for cross-cutting concerns; skip it for feature plugins that you want isolated.

---

## 4. `trustProxy` behind a reverse proxy

**❌ Wrong — `trustProxy: false`, rate-limit blocks the LB's IP:**
```ts
const app = Fastify({ trustProxy: false });
app.register(rateLimit, { max: 100 });
// req.ip === "10.0.0.5" (the Angie host) for every request
// → rate limiter blocks Angie itself after 100 reqs, all clients 429
```

**✅ Right — trust the proxy chain, `X-Forwarded-For` becomes client IP:**
```ts
const app = Fastify({ trustProxy: true });          // or specific IPs/subnets
app.register(rateLimit, { max: 100 });
// req.ip === real client IP — rate limit per user, as intended
```

**Why it matters:** behind Angie/nginx/ALB every request's TCP peer is the proxy. Without `trustProxy`, `req.ip` is the proxy's IP — rate-limit, audit logs, and IP allowlists all become useless or actively harmful. Conversely, setting `trustProxy: true` when **not** behind a proxy lets clients spoof `X-Forwarded-For` themselves. Set it only when the deployment topology guarantees a known proxy in front.

---

## 5. Logger redact for sensitive fields

**❌ Wrong — Pino logs Authorization headers and request bodies in clear:**
```ts
Fastify({ logger: { level: 'info' } });
// Production logs leak Bearer tokens, JWT payloads, card numbers
```

**✅ Right — redact sensitive paths before they reach the stream:**
```ts
Fastify({
  logger: {
    level: 'info',
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-api-key"]',
        '*.password', '*.token', '*.secret', '*.cardNumber',
      ],
      remove: true,
    },
  },
});
```

**Why it matters:** Pino's `req` serializer dumps the full headers object by default. Once a JWT/cookie/API-key hits the log aggregator it is **forever** in the storage (rotating tokens doesn't erase backups). Redaction is cheap at the Pino layer and must be configured before the first request lands.
