# Node.js Security Hardening Checklist

Coverage: HTTP security headers, CORS, rate limiting, authentication, password storage, secrets management, SQL injection, input validation, Node Permission Model.

For each item: check it exists, verify it's configured correctly (not just present).

---

## HTTP Security Headers (Helmet)

- [ ] `helmet()` registered as first middleware (before routes)
- [ ] `contentSecurityPolicy` enabled in production — not disabled globally
- [ ] `hsts` configured: `max-age >= 31536000`, `includeSubDomains: true`
- [ ] `X-Frame-Options` set to `DENY` or `SAMEORIGIN`
- [ ] `Referrer-Policy` set to `strict-origin-when-cross-origin` or stricter
- [ ] `Permissions-Policy` restricts unneeded browser APIs

```ts
// Correct — production-hardened
await app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],  // narrow this further if possible
      imgSrc:     ["'self'", 'data:', 'https:'],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
})
```

---

## CORS

- [ ] CORS origin is an explicit allowlist, not `'*'` in production
- [ ] `credentials: true` is NOT set with `origin: '*'` (browsers block this)
- [ ] Allowed methods list is minimal — remove `PUT`/`DELETE` if not needed
- [ ] Preflight cache (`Access-Control-Max-Age`) set to reduce OPTIONS requests

```ts
// Correct
await app.register(cors, {
  origin: ['https://app.example.com', 'https://admin.example.com'],
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  credentials: true,
})
```

---

## Rate Limiting

- [ ] Rate limit applied globally as a plugin (not per-route only)
- [ ] Stricter limits on auth endpoints (`/auth/login`, `/auth/register`, `/auth/reset-password`)
- [ ] Rate limit errors return `429` with `Retry-After` header
- [ ] Redis-backed rate limiting for multi-instance deployments (not in-memory)

```ts
// Auth endpoint — stricter limit
app.post('/auth/login', {
  config: { rateLimit: { max: 10, timeWindow: '5 minutes' } },
}, loginHandler)
```

---

## Authentication & JWT

- [ ] JWT validated on EVERY protected route — signature, expiry, issuer, audience
- [ ] JWT secret is min 32 bytes, from env var, never hardcoded
- [ ] Refresh token rotation implemented — old token invalidated on use
- [ ] JWT `kid` header used when rotating signing keys
- [ ] Access token TTL ≤ 15 minutes; refresh token TTL ≤ 7 days
- [ ] Token revocation list (Redis set) checked on sensitive operations
- [ ] `timingSafeEqual` used for any constant-time token/HMAC comparison

```ts
import { timingSafeEqual } from 'node:crypto'

// Correct comparison
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false  // length check is safe here (padding attack doesn't apply to length)
  return timingSafeEqual(bufA, bufB)
}
```

---

## Password Storage

- [ ] argon2id used (not bcrypt, not MD5, not SHA-256 raw)
- [ ] argon2id params: `memoryCost: 65536` (64MB), `timeCost: 3`, `parallelism: 4`
- [ ] Password hashing happens in a worker thread or async (never blocks event loop)
- [ ] Password comparison uses `argon2.verify()` — not manual hash comparison

```ts
import argon2 from 'argon2'

// Hash
const hash = await argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
})

// Verify
const isValid = await argon2.verify(hash, password)
```

---

## Secrets Management

- [ ] ALL secrets in environment variables — no hardcoded values, no config files with secrets
- [ ] `.env` and `.env.*` are in `.gitignore`
- [ ] `EnvSchema` (Zod) validates and parses env at startup — app exits if invalid
- [ ] Secret rotation handled by env var change + rolling restart (not code deploy)
- [ ] CI/CD uses secret injection (GitHub Actions secrets, Vault) — not .env files
- [ ] Logs redact secret fields (`pino redact: [...]`)

---

## SQL Injection Prevention

- [ ] All queries use parameterized statements — never string interpolation
- [ ] ORMs (Prisma, Drizzle) used correctly — `where: { email }` not `where: { email: rawInput }`
- [ ] Raw queries (if any) use `$1/$2` placeholders

```ts
// CORRECT — parameterized
const user = await pool.query('SELECT * FROM users WHERE email = $1', [email])

// WRONG — never do this
const user = await pool.query(`SELECT * FROM users WHERE email = '${email}'`)
```

---

## Input Validation

- [ ] Every HTTP request body, query param, and path param validated at route entry
- [ ] Zod (or TypeBox) schema defined for all inputs
- [ ] Validation errors return 400 with field-level details
- [ ] File uploads: MIME type validated, size capped, stored outside webroot
- [ ] Path traversal: never use user-supplied path segments in `fs` calls

---

## Node.js Permission Model (`--permission`)

Node 24 ships a stable Permission Model. For high-security services:

- [ ] `--allow-fs-read=./src,./dist,./node_modules` restricts readable paths
- [ ] `--allow-fs-write=/tmp/{{app_name}}` restricts writable paths
- [ ] `--allow-env` only if env access is needed (default: env readable without flag)
- [ ] `--allow-net=api.stripe.com,db.internal` restricts outbound network (advanced)
- [ ] Tested that permission violations throw `ERR_ACCESS_DENIED` (not silently pass)

```bash
# Example production start with permissions
node --permission \
  --allow-fs-read=./dist,./node_modules \
  --allow-fs-write=/tmp/myapp-uploads \
  --allow-env=NODE_ENV,PORT,DATABASE_URL \
  dist/app/index.js
```

---

## Dependency Security

- [ ] `npm audit --omit=dev` runs in CI — fails on HIGH/CRITICAL
- [ ] Dependabot or Renovate configured for automated PR creation on CVEs
- [ ] `package-lock.json` committed and integrity-checked in CI
- [ ] No unused dependencies (`npm prune` or `depcheck`)
- [ ] Supply chain: only packages from npmjs.com or known scoped registries

---

## Final Verification

Run this sequence to confirm hardening is active:

```bash
# 1. Confirm Helmet headers present
curl -I https://{{your_app}}/health | grep -E "content-security-policy|strict-transport-security|x-frame-options"

# 2. Confirm CORS rejects unknown origin
curl -H "Origin: https://evil.com" -I https://{{your_app}}/api/users | grep "access-control"

# 3. Confirm rate limit fires
for i in $(seq 1 15); do curl -s -o /dev/null -w "%{http_code}\n" https://{{your_app}}/auth/login; done
# Expect 429 after configured threshold

# 4. Confirm secrets not in response headers or error bodies
curl https://{{your_app}}/nonexistent | grep -i "secret\|password\|token\|DATABASE_URL"
# Expect: no output
```
