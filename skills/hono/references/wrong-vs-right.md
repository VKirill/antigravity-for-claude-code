# Wrong vs Right — hono

Side-by-side pairs of the wrong pattern (compiles, runs, fails in production) and the right one. Per skill-evaluation v3 for `risk: high-stakes` skills.

---

## 1. `c.req.json()` consumed twice

**❌ Wrong — body stream drained by validator, handler re-reads:**
```ts
app.post('/users',
  zValidator('json', schema),
  async (c) => {
    const body = await c.req.json();        // TypeError: Body has already been consumed
    return c.json(body, 201);
  },
);
```

**✅ Right — read validated value via `c.req.valid('json')`:**
```ts
app.post('/users',
  zValidator('json', schema),
  (c) => {
    const body = c.req.valid('json');        // typed AND already parsed
    return c.json(body, 201);
  },
);
```

**Why it matters:** Web Standards `Request.body` is a single-use stream. Once `zValidator` reads it, calling `c.req.json()`/`text()`/`arrayBuffer()` again throws at runtime. `c.req.valid(target)` returns the parser output safely typed — this is the entire point of running a validator.

---

## 2. Bindings & Variables typed via constructor generic

**❌ Wrong — no generic, `c.env` and `c.var` are erased:**
```ts
const app = new Hono();

app.get('/cache/:key', async (c) => {
  const cached = await c.env.KV.get(c.req.param('key'));   // any
  const user = c.get('user');                              // unknown
});
```

**✅ Right — declare `Bindings` and `Variables` types upfront:**
```ts
type Bindings = { KV: KVNamespace; JWT_SECRET: string };
type Variables = { user: { id: string; role: 'user' | 'admin' } };

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.get('/cache/:key', async (c) => {
  const cached = await c.env.KV.get(c.req.param('key'), 'json');  // typed
  const user = c.get('user');                                     // { id, role } | undefined
});
```

**Why it matters:** Without the generic, the entire type-safety story of Hono collapses to `any`. Worker bindings (`KVNamespace`, `D1Database`, `R2Bucket`, `DurableObjectNamespace`) come from `@cloudflare/workers-types`. The constructor generic is the **single switch** that propagates types through every `c.env.X` / `c.set` / `c.get` / RPC client call. Skipping it is the #1 source of "Hono types are broken" complaints.

---

## 3. HMAC verification — edge `crypto.subtle` vs Node `crypto`

**❌ Wrong — Node-only API, throws on Workers:**
```ts
import { createHmac, timingSafeEqual } from 'node:crypto';     // not on Workers

app.post('/webhook', async (c) => {
  const body = await c.req.text();
  const sig = c.req.header('x-signature') ?? '';
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return c.json({ error: 'bad sig' }, 403);
  }
});
```

**✅ Right — WebCrypto, runs on Workers/Vercel Edge/Deno/Bun/Node:**
```ts
async function verifyHmac(body: string, sigB64: string, secret: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['verify'],
  );
  const sigBytes = Uint8Array.from(atob(sigB64), (c) => c.charCodeAt(0));
  return crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(body));
}

app.post('/webhook', async (c) => {
  const body = await c.req.text();
  const sig = c.req.header('content-hmac') ?? '';
  if (!(await verifyHmac(body, sig, c.env.WEBHOOK_SECRET))) {
    return c.json({ error: 'bad sig' }, 403);
  }
});
```

**Why it matters:** Edge runtimes ship only Web Standards. Importing `node:crypto` (or `Buffer`) is a runtime crash on Workers / Vercel Edge / Deno Deploy. `crypto.subtle.verify` is constant-time by spec — no need for a separate `timingSafeEqual`. Same code works on Node 24 (WebCrypto is the official import there too).

---

## 4. CORS — specific origins vs wildcard with credentials

**❌ Wrong — `'*'` with credentials silently breaks browser auth:**
```ts
app.use('/api/*', cors({
  origin: '*',
  credentials: true,                          // ❌ browser DROPS the response
}));
```

**✅ Right — explicit allowlist OR dynamic function:**
```ts
app.use('/api/*', cors({
  origin: ['https://app.example.com', 'https://admin.example.com'],
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Authorization', 'Content-Type'],
  maxAge: 86_400,
}));

// Or dynamic (multi-tenant / preview deploys)
app.use('/api/*', cors({
  origin: (origin) => {
    if (!origin) return null;
    if (origin.endsWith('.preview.example.com')) return origin;
    if (allowedSet.has(origin)) return origin;
    return null;
  },
  credentials: true,
}));
```

**Why it matters:** The CORS spec forbids `Access-Control-Allow-Origin: *` together with `Access-Control-Allow-Credentials: true`. Browsers will receive the response, see the contradiction, and reject it — the network tab shows the request succeeded but the JS `fetch` rejects with a CORS error. Curl tests pass (no credentials enforcement) which hides the bug from CI. Always use explicit origins when cookies / Authorization are in play.

---

## 5. RPC client — generic on `typeof <routes>`, not `any`

**❌ Wrong — handler extracted, type erased, client falls back to `any`:**
```ts
// server.ts
import { handler } from './handlers/posts';
app.get('/posts', handler);                   // app's route info is lossy here
export type AppType = typeof app;             // routes look like `any`

// client.ts
const client = hc<AppType>('https://api.example.com');
const res = await client.posts.$get();        // res.json() returns `any`
```

**✅ Right — keep route chain together, export `typeof <chain>`:**
```ts
// server.ts
const route = app
  .get('/posts', (c) => c.json([{ id: 1, title: 'Hi' }]))
  .post(
    '/posts',
    zValidator('json', z.object({ title: z.string() })),
    (c) => c.json({ id: 2, ...c.req.valid('json') }, 201),
  )
  .get('/posts/:id', (c) => c.json({ id: Number(c.req.param('id')), title: 'Hi' }));
export type AppType = typeof route;

// client.ts
const client = hc<AppType>('https://api.example.com');
const res = await client.posts.$get();
const posts = await res.json();               // typed: { id: number; title: string }[]
```

**Why it matters:** Hono's RPC type-safety is built on TypeScript inference walking the **chained call sequence** — each `.get/.post/.put` adds to the inferred AppType. Once handlers are extracted to external functions or the chain is broken, TS can't reconstruct the route shape and the client degrades to `any`. To preserve types across modules, use `createFactory()` or keep the route table chained at the export point. This is the single most common reason "RPC types don't work" — fix the chain, not the client.
