# Auth, sessions, JWT, IDOR, missing authz

Covers OWASP A01 (Broken Access Control) and A07 (Auth Failures).

## IDOR (Insecure Direct Object Reference)

The classic bug: endpoint takes ID from URL and returns the resource without checking ownership.

### Grep

```bash
# Find every route that takes :id from URL
grep -rnE 'req\.params\.(id|userId|user_id|orderId|.*Id)' src/ -B3 -A8

# Cross-check: does the surrounding code verify ownership?
# Look for: where: { id, userId: session.user.id }, scope filter, or middleware
```

### Fix pattern (Prisma / Node)

```ts
// ❌ IDOR
const order = await prisma.order.findUnique({ where: { id: req.params.id } });

// ✅ scoped
const order = await prisma.order.findFirst({
  where: { id: req.params.id, userId: req.user.id }
});
if (!order) return res.status(404).end();  // 404 not 403, no enumeration
```

### Multi-tenant SaaS

Always filter by `tenantId` AND `userId` where relevant. Use middleware:

```ts
function scopeToTenant(req, res, next) {
  req.queryScope = { tenantId: req.session.tenantId };
  next();
}
```

Then enforce: `prisma.x.findMany({ where: { ...req.queryScope, ...userFilter } })`.

## Missing authz middleware

### Grep

```bash
# Find route definitions without auth middleware
grep -rnE 'router\.(get|post|put|patch|delete)\(' src/ | \
  grep -vE 'requireAuth|protect|guard|authenticate|isAuthenticated|verifyToken'
```

Manually check each — some endpoints are intentionally public (health, public docs).

### Pattern: default-deny

```ts
// app.ts
app.use(requireAuth);                     // default-deny
app.use('/public', publicRouter);         // explicit public carve-out
app.use('/api', requireAuth, apiRouter);  // double-protected, redundancy OK
```

## JWT pitfalls

### `alg: none`

Some old JWT libraries trust the `alg` field in the token header. Attacker sends `{"alg":"none"}` → no signature required.

**Fix:** pin alg in verify:
```ts
jwt.verify(token, secret, { algorithms: ['HS256'] });  // explicit allowlist
```

Modern libs (jose, jsonwebtoken ≥ 9) reject `none` by default. Verify your version.

### HS256 + asymmetric key confusion

App is configured to verify with RS256 (asymmetric). Attacker forges token with `alg: HS256` and uses the public key (which is, well, public) as HMAC secret.

**Fix:** never pass arbitrary keys to verify; pin the verifying key + algorithm together:

```ts
jwt.verify(token, RSA_PUBLIC_KEY, { algorithms: ['RS256'] });  // not ['RS256', 'HS256']
```

### Weak HS256 secret

`HS256` secret < 32 bytes (256 bits) → brute-forceable.

**Fix:** secret from `crypto.randomBytes(32).toString('hex')`, stored in env var.

### Missing `exp`

JWT without expiration = forever valid → stolen token = forever account compromise.

**Fix:** always set `exp` on issue, verify on consume.

### Missing `aud` / `iss`

Token issued for service A used against service B (token confusion).

**Fix:** `jwt.sign(payload, secret, { audience: 'api.example.com', issuer: 'auth.example.com' })`; verify both on consume.

### JWT in localStorage

XSS → token stolen.

**Fix:** httpOnly cookie. Use sessionStorage / memory only as last resort.

## Session cookies

### Required flags

```http
Set-Cookie: session=...; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600
```

| Flag | Why |
|---|---|
| `HttpOnly` | Inaccessible to JS → XSS can't steal |
| `Secure` | Sent only over HTTPS |
| `SameSite=Lax` (or `Strict`) | CSRF protection |
| `Path=/` | Sent on all routes (or scope tighter) |
| `Max-Age` / `Expires` | Bounded lifetime |

### Session fixation

Attacker sets victim's session ID via XSS or URL parameter; after victim logs in, attacker uses the same ID.

**Fix:** rotate session ID on login, on privilege change, on logout.

```ts
// better-auth, NextAuth, etc. handle this. For custom: regenerate session ID.
req.session.regenerate(() => {
  req.session.userId = user.id;
  req.session.save();
});
```

## OAuth / OpenID Connect

### State parameter (CSRF for OAuth)

```ts
// Before redirect
const state = crypto.randomBytes(16).toString('hex');
session.oauth_state = state;
res.redirect(`${provider}/authorize?state=${state}&...`);

// On callback
if (req.query.state !== session.oauth_state) return res.status(400).end();
```

### PKCE for public clients (mobile/SPA)

Code verifier + challenge prevents auth code interception.

### Redirect URI allowlist

`redirect_uri` MUST be exact-match (with port + path), not prefix-match. Otherwise: open redirect → token leak.

## Password hashing

| Algorithm | Use? | Notes |
|---|---|---|
| **argon2id** | ✅ Preferred | OWASP recommendation 2025; memory-hard |
| **bcrypt** | ✅ OK | cost ≥ 12; battle-tested |
| **scrypt** | ✅ OK | Similar to argon2 |
| **PBKDF2** | 🟡 OK if forced (FIPS) | 600k+ iterations |
| **SHA256/SHA512 raw** | ❌ Never | No salt, no iteration count |
| **MD5/SHA1** | ❌ Never | Broken |

Node: `argon2` npm package. Python: `argon2-cffi`.

## Rate limiting (auth endpoints)

```ts
// At minimum:
rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 min
  max: 5,                    // 5 attempts
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts'
})
```

Apply to: `/login`, `/register`, `/password-reset`, `/forgot-password`, `/verify-2fa`.

## Webhook signature verification

For any incoming webhook (payments, GitHub, Slack, telegram, vk, max):

```ts
const expected = crypto.createHmac('sha256', SECRET)
  .update(req.rawBody)
  .digest('hex');
if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(req.headers['x-signature']))) {
  return res.status(401).end();
}
```

**Use `timingSafeEqual`** — `===` is timing-side-channel vulnerable.

## Severity calibration

| Finding | Severity |
|---|---|
| IDOR returning user data | 🔴 Critical |
| Missing auth on data-mutation endpoint | 🔴 Critical |
| JWT `alg: none` accepted | 🔴 Critical |
| Webhook without HMAC verify (payments) | 🔴 Critical |
| HS256 + RS256 confusion possible | 🔴 Critical |
| Password stored as MD5/SHA1/plaintext | 🔴 Critical |
| Session cookie missing HttpOnly | ⚠️ High |
| Session cookie missing Secure (in prod) | ⚠️ High |
| No rate-limit on `/login` | ⚠️ High |
| JWT secret < 32 bytes | ⚠️ High |
| OAuth missing state parameter | ⚠️ High |
| Webhook signature compared with `===` (timing) | 🟡 Medium |
| JWT missing `exp` | 🟡 Medium |
| Password policy < 12 chars | 🟡 Medium |
