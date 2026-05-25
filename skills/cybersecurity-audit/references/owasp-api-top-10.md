# OWASP API Top 10 (2023, still current in 2026)

API-specific vulnerability classes. Different from web Top 10 because APIs lack browser-side protections (no CSRF tokens, no SOP) and expose granular data.

Source: <https://owasp.org/API-Security/>

## API1: Broken Object Level Authorization (BOLA)

The #1 API vulnerability. Same as IDOR but at scale — APIs return objects by ID without checking ownership.

**Pattern:**
```ts
// ❌ BOLA
app.get('/api/orders/:id', async (req, res) => {
  const order = await db.order.findUnique({ where: { id: req.params.id } });
  res.json(order);  // returns ANY user's order
});

// ✅ Fixed
app.get('/api/orders/:id', requireAuth, async (req, res) => {
  const order = await db.order.findFirst({
    where: { id: req.params.id, userId: req.user.id }   // scoped
  });
  if (!order) return res.status(404).end();
  res.json(order);
});
```

**Audit:** for every `GET/PATCH/DELETE /api/<resource>/:id` route — check ownership/tenant filter.

## API2: Broken Authentication

Weak token validation, missing rate-limit on `/login`, predictable refresh tokens, OAuth state-param missing.

**Checks:**
- JWT verified with the right `alg` (pinned, not from token header)
- Refresh tokens single-use + rotated
- `/login` rate-limited per IP and per username
- Password reset link is single-use + expires < 30 min

## API3: Broken Object Property Level Authorization

Mass-assignment + excessive data exposure.

```ts
// ❌ Mass assignment
app.patch('/api/users/me', async (req, res) => {
  await db.user.update({ where: { id: req.user.id }, data: req.body });
  // user can set isAdmin: true via PATCH body
});

// ✅ Allowlist fields
const schema = z.object({ name: z.string().max(60), bio: z.string().max(500) });
app.patch('/api/users/me', async (req, res) => {
  const data = schema.parse(req.body);
  await db.user.update({ where: { id: req.user.id }, data });
});
```

**Excessive exposure** — endpoint returns more than UI needs:
```ts
// ❌ returns password_hash, internal_notes, etc.
res.json(user);
// ✅ explicit shape
res.json({ id: user.id, name: user.name, email: user.email });
```

## API4: Unrestricted Resource Consumption

No rate-limit, no max body size, no pagination cap, no query complexity cap (GraphQL).

**Fix:**
- Global rate-limit middleware
- `bodyParser.json({ limit: '100kb' })`
- Pagination `limit` capped at e.g. 100; reject `limit=10000`
- GraphQL: depth-limit + cost-analysis plugin

## API5: Broken Function Level Authorization

Admin endpoints accessible to non-admins.

```ts
// ❌ relies on URL secrecy ("nobody knows about /admin/users")
app.get('/admin/users', async (req, res) => {
  res.json(await db.user.findMany());
});

// ✅
app.get('/admin/users', requireAuth, requireRole('admin'), async (req, res) => {
  res.json(await db.user.findMany());
});
```

## API6: Unrestricted Access to Sensitive Business Flows

Bot can buy out a flash sale, hammer signup, exhaust a free-tier quota.

**Fix:**
- Rate-limit on registration, password-reset, "send code", "purchase"
- CAPTCHA / Turnstile / hCaptcha on high-fraud flows
- Anomaly detection on signup velocity
- For payments: idempotency keys + per-user cooldown

## API7: SSRF

See [ssrf-deserialization.md](ssrf-deserialization.md).

## API8: Security Misconfiguration

Same as OWASP Web A05 but API-flavored:
- Verbose error responses leak stack traces
- CORS `*` with credentials
- HTTP allowed alongside HTTPS
- Outdated TLS

## API9: Improper Inventory Management

Old API versions still exposed, undocumented endpoints, staging APIs reachable from prod.

**Audit:**
```bash
# Find all route definitions
grep -rnE 'app\.(get|post|put|patch|delete|use)|@app\.route|@(router\.)?(get|post)' src/
```

Compare to public docs. Anything in code but not docs = "shadow API" → either document or remove.

## API10: Unsafe Consumption of APIs

Your API calls 3rd-party APIs and trusts their response blindly.

**Patterns:**
- Webhook from 3rd party → must verify signature (HMAC)
- 3rd-party API returns a URL → don't fetch without allowlist check
- 3rd-party API returns HTML → escape before rendering

## API-specific quick checks

```bash
# Find endpoints without authz middleware
grep -rnE "router\.(get|post|put|patch|delete)\(" src/ | \
  grep -vE 'requireAuth|protect|guard|authenticate|middleware'

# Find endpoints accepting JSON without validation
grep -rnE "req\.body" src/ -B2 -A5 | grep -B2 'req.body' | grep -vE 'parse\(|validate|schema'
```

## Severity calibration

| Finding | Severity |
|---|---|
| BOLA on `/api/<resource>/:id` returning user data | 🔴 Critical |
| Mass assignment allowing `isAdmin` set | 🔴 Critical |
| Missing rate-limit on `/login` | ⚠️ High |
| GraphQL introspection enabled in prod | ⚠️ High |
| Excessive data exposure (returns `password_hash`) | ⚠️ High |
| Old `/v1/` API still routable when `/v2/` is current | 🟡 Medium |
| Verbose error responses with stack trace | 🟡 Medium |
| Missing `X-Frame-Options` on JSON API | 🟢 Low (browsers don't render JSON in frame) |
