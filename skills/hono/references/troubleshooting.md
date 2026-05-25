# Troubleshooting — hono

Symptom-indexed. Find what the user sees, follow the diagnosis steps, apply the fix. Required for `risk: high-stakes` skills per skill-evaluation v3.

---

## Workers "Service Worker" vs "ES Module" syntax confusion

**Symptoms**
- `addEventListener('fetch', ...)` doesn't fire — handler never runs
- OR `export default app` errors with "Service Worker syntax not enabled"
- `wrangler dev` runs but requests 404 silently

**Diagnose**
```bash
# Inspect wrangler.toml — what does it say about main?
grep -E '^(main|compatibility)' wrangler.toml
```

**Cause**
- Modern Workers (default since 2022) use **ES Module syntax** — `export default { fetch }` or `export default app` (Hono's `app` has a `fetch` property)
- Legacy Service Worker syntax uses `addEventListener('fetch', ...)` and is deprecated

**Fix — use ES Module syntax**
```ts
// ✅ Modern Workers — Hono app exports default
import { Hono } from 'hono';
const app = new Hono();
app.get('/', (c) => c.text('hi'));
export default app;                              // app.fetch is invoked by the runtime

// ❌ Legacy Service Worker — do NOT mix with modern
// addEventListener('fetch', (e) => e.respondWith(app.fetch(e.request)));
```

`wrangler.toml`:
```toml
main = "src/index.ts"
compatibility_date = "2026-05-01"               # recent date = modern defaults
```

---

## "Body has already been consumed" error

**Symptoms**
- Runtime error: `TypeError: Body has already been consumed`
- Validator middleware passes but handler reads the body again

**Diagnose**
```ts
app.post('/x', zValidator('json', schema), async (c) => {
  const body = await c.req.json();          // ❌ ALREADY consumed by zValidator
});
```

**Cause**
- Web Standards `Request.body` is a single-use stream. Once `await c.req.json()` runs (directly or inside a validator), the stream is drained
- Same applies to `c.req.text()`, `c.req.arrayBuffer()`, `c.req.parseBody()`

**Fix — use `c.req.valid()` after a validator OR read once and reuse**
```ts
// ✅ Use the validator's parsed value
app.post('/x', zValidator('json', schema), (c) => {
  const body = c.req.valid('json');         // typed, no re-read
  return c.json(body);
});

// ✅ Read once if no validator
app.post('/y', async (c) => {
  const body = await c.req.json();
  // pass `body` around — do not call c.req.json() again
});
```

---

## Variables / Bindings type inference broken

**Symptoms**
- `c.env.KV` is `any` or errors as `unknown`
- `c.get('user')` returns `unknown` despite middleware setting it
- VS Code shows no autocomplete on `c.env.*`

**Cause**
- Missing generic on `new Hono<>()` — defaults to `{ Bindings: {}, Variables: {} }`

**Fix — declare types and pass as constructor generic**
```ts
type Bindings = { KV: KVNamespace; JWT_SECRET: string };
type Variables = { user: { id: string; role: 'user' | 'admin' } };

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.get('/', (c) => {
  c.env.KV;                                 // ✅ KVNamespace
  c.get('user');                            // ✅ { id, role } | undefined
});
```

For Workers types, install `@cloudflare/workers-types` or run `wrangler types` to codegen `worker-configuration.d.ts`.

---

## CORS preflight not matching (specific origins vs wildcard)

**Symptoms**
- Browser console: "blocked by CORS policy: ... no 'Access-Control-Allow-Origin' header"
- `curl` works; browser doesn't
- Works with `origin: '*'`, fails with allowlist

**Common causes**
- ❌ `origin: '*'` set together with `credentials: true` — browser silently drops the response
- ❌ Allowlist origin string mismatch (trailing slash, http vs https, port)
- ❌ `cors()` registered AFTER the route — middleware order matters
- ❌ Preflight OPTIONS not allowed by upstream proxy / Cloudflare WAF

**Fix**
```ts
app.use('/api/*', cors({
  origin: ['https://app.example.com', 'https://staging.example.com'],  // exact strings
  credentials: true,                          // requires explicit origin list
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Authorization', 'Content-Type'],
  maxAge: 86_400,
}));

app.get('/api/me', handler);                  // routes AFTER cors registration
```

Test the preflight:
```bash
curl -i -X OPTIONS https://api.example.com/api/me \
  -H 'Origin: https://app.example.com' \
  -H 'Access-Control-Request-Method: GET'
```

---

## RPC client type drift between server and consumer

**Symptoms**
- `client.posts.$get()` returns `Response` (untyped) instead of typed result
- Autocomplete shows `any` for the response
- After refactor, types disappear

**Common causes**
- ❌ `export type AppType = typeof app` — should be `typeof <chained-routes>`
- ❌ Route handlers extracted to other modules without preserving the chain
- ❌ TypeScript `tsBuildInfoFile` cached an old shape — restart TS server
- ❌ Frontend and backend on different Hono versions

**Fix — keep the route chain together for `typeof`**
```ts
// ✅ Right
const route = app
  .get('/posts', (c) => c.json([{ id: 1, title: 'Hi' }]))
  .post('/posts', zValidator('json', PostSchema), (c) => c.json({ id: 2 }, 201));
export type AppType = typeof route;

// ❌ Wrong — `app` loses route info if handlers are external
app.get('/posts', externalHandler);
export type AppType = typeof app;             // routes look erased
```

Pin the same Hono version across frontend and backend (monorepo: workspace protocol).

---

## Edge runtime API mismatch (no `Buffer`, no `fs`, no `crypto.timingSafeEqual` directly)

**Symptoms**
- `ReferenceError: Buffer is not defined` on Workers/Edge
- `Cannot find module 'node:crypto'`
- HMAC verification works in Node, fails on Workers

**Cause**
- Workers / Vercel Edge / Deno Deploy ship Web Standards only — no Node APIs
- `crypto.timingSafeEqual` exists in Node but not in WebCrypto

**Fix — use `crypto.subtle` (WebCrypto)**
```ts
// ❌ Node-only — won't run on Workers
import { createHmac, timingSafeEqual } from 'node:crypto';

// ✅ WebCrypto — runs everywhere with global `crypto`
async function verifyHmac(body: string, signature: string, secret: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign', 'verify'],
  );
  const sigBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
  return crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(body));
}
```

For Buffer-like operations: `Uint8Array` + `TextEncoder` / `TextDecoder`. For file I/O: KV/R2/D1 instead of `fs`.

---

## Cookie not setting on Workers (sameSite=Strict + cross-origin)

**Symptoms**
- `setCookie(c, 'session', ...)` succeeds but browser never stores it
- DevTools shows `Set-Cookie` blocked: "SameSiteStrictCrossOrigin"
- Login works on same-origin, fails on subdomain

**Cause**
- `sameSite: 'Strict'` blocks the cookie on cross-site navigation — including subdomain redirects in some browsers
- Login form on `auth.example.com` redirecting to `app.example.com` is cross-site

**Fix — pick `sameSite: 'Lax'` for cross-subdomain flows; `Strict` only for true first-party**
```ts
setCookie(c, 'session', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'Lax',                            // works across subdomain navigation
  domain: '.example.com',                     // share across subdomains
  path: '/',
});
```

`Strict` is correct for high-value flows that never leave the origin (admin panels). `Lax` is the safe default for normal session cookies. See `recommended-defaults.md`.

---

## ETag middleware blocking real responses

**Symptoms**
- API returns 304 Not Modified even when data has changed
- POST/PUT responses lose body
- Workers cache holds stale content

**Cause**
- `etag()` middleware computes the hash of the response body — if you `return c.json(...)` twice (or stream), the hash is computed on the first chunk only
- ETag on POST is rarely desired — middleware applied globally hits write endpoints too

**Fix — scope etag to safe methods / static paths**
```ts
import { etag } from 'hono/etag';

// ✅ Only GET / static
app.use('/static/*', etag({ weak: true }));
app.get('/api/list', etag({ weak: true }), handler);

// ❌ Don't apply globally
// app.use('*', etag());
```

---

## Routing surprise — `/users/:id` vs `/users/me`

**Symptoms**
- `GET /users/me` returns the param handler with `id === 'me'`
- Static route `/users/me` never matches

**Cause**
- Route registration order matters with `RegExpRouter` only when multiple patterns could match — but **specific routes must be declared BEFORE dynamic** in `TrieRouter` and most expectations
- With `RegExpRouter`, all routes are compiled to one regex — specificity wins, but tests are non-obvious

**Fix — declare specific before dynamic, OR use `c.req.param('id') === 'me'` branch**
```ts
// ✅ Right order — specific first
app.get('/users/me', (c) => c.json({ self: true }));
app.get('/users/:id', (c) => c.json({ id: c.req.param('id') }));
```

If the router still routes wrong, switch to `TrieRouter`:
```ts
import { TrieRouter } from 'hono/router/trie-router';
const app = new Hono({ router: new TrieRouter() });
```

---

## `c.json` returns 200 even for errors (forgot status code)

**Symptoms**
- Error responses come back with HTTP 200
- Frontend `if (!res.ok)` branch never triggers
- Tests fail asserting `res.status === 4xx`

**Cause**
- `c.json(body)` defaults to status 200 — there's no implicit error mapping
- `throw new Error('bad')` becomes a generic 500 only if `onError` is wired

**Fix — set status explicitly, or throw `HTTPException`**
```ts
import { HTTPException } from 'hono/http-exception';

// ✅ Explicit status
app.post('/login', async (c) => {
  if (!valid) return c.json({ error: 'invalid_credentials' }, 401);
  return c.json({ token });
});

// ✅ Or throw — `onError` maps to response
app.post('/admin', async (c) => {
  if (!c.get('user')) throw new HTTPException(401, { message: 'unauthorized' });
});

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  return c.json({ error: 'internal_error' }, 500);
});
```

---

## Cold start on Vercel Edge (bundle size matters)

**Symptoms**
- First request after deploy: 200–500 ms
- Subsequent requests: < 50 ms
- Lighthouse / RUM shows TTFB spike

**Common causes**
- Bundle > 1 MB after tree-shake (Vercel Edge limit)
- Pulled in a Node-only dep (`crypto`, `fs`, `path`) — bundler couldn't tree-shake

**Fix**
- Audit bundle: `vercel build --debug` then inspect `.vercel/output/functions/*/index.js` size
- Replace Node-only deps with Web Standards equivalents (`crypto.subtle`, `URLPattern`)
- Switch to `hono/tiny` if you're under 14 kB budget
- For very-frequent endpoints, consider Cloudflare Workers (faster cold start than Vercel Edge)

---

## More symptoms?

If your symptom isn't listed, capture: runtime (Workers/Bun/Node version), Hono version (`hono/package.json`), `wrangler tail` or `console.log` output, and a minimal repro. File an issue with that data; we extend this file when patterns repeat.
