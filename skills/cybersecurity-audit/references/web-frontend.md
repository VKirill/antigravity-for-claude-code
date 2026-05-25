# Web frontend — XSS / CSRF / CORS / CSP / clickjacking / open redirect

## XSS (Cross-Site Scripting)

### DOM XSS

```bash
grep -rnE 'innerHTML\s*=|outerHTML\s*=|document\.write\(' src/ --include='*.ts' --include='*.tsx' --include='*.js'
```

```js
// ❌
el.innerHTML = req.body.name;

// ✅
el.textContent = req.body.name;
// or
el.innerHTML = DOMPurify.sanitize(req.body.name);
```

### React-specific

```bash
grep -rnE 'dangerouslySetInnerHTML' src/ --include='*.tsx' --include='*.jsx'
```

`dangerouslySetInnerHTML` is named that way for a reason. Use it only with `DOMPurify.sanitize()` output, document why.

### Vue-specific

```bash
grep -rnE 'v-html=' src/ --include='*.vue'
```

Same risk as innerHTML.

### Stored XSS

User submits HTML/JS, it's stored in DB, rendered to other users.

**Fix:** sanitize at render time (defense in depth) AND don't HTML-render markdown without sanitizing (use a library: `marked` + `DOMPurify`, or `markdown-it` + `markdown-it-sanitizer`).

### Reflected XSS

URL query param echoed into page.

```bash
grep -rnE "innerHTML.*req\.query|window\.location\.search" src/
```

## CSRF

Cookie-based auth + state-changing endpoint + no CSRF protection → attacker's site can submit forms on victim's behalf.

### Required protections (pick one)

| Pattern | How |
|---|---|
| **SameSite cookie** | `Set-Cookie: ...; SameSite=Lax` (or Strict). Lax allows top-level GET nav, blocks cross-site POST. Default in modern browsers. |
| **CSRF token (double-submit)** | Server sets cookie `csrfToken=X` (not HttpOnly so JS reads); client sends X in request header; server compares cookie vs header. |
| **Origin/Referer check** | `req.headers.origin === EXPECTED_ORIGIN` (less robust, browsers don't always send) |

### When SameSite isn't enough

- Older browsers (<2020) — relevant if you support enterprise IE/Edge legacy
- API used by mobile / non-browser clients with cookies (rare; usually they use tokens, not cookies)

### Anti-pattern

Custom CSRF token derived from `Date.now()` → predictable.

## CORS

```bash
grep -rnE "Access-Control-Allow-Origin.*\*|cors\(\s*\{" src/
```

### Misconfig: `*` with credentials

```ts
// ❌ ENORMOUS leak
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Credentials', 'true');

// Browser actually rejects this combo, BUT some libs let `Origin: <attacker>` echo
// back as ACAO header, achieving the same.
```

### Fix

```ts
const ALLOWED = ['https://app.example.com', 'https://admin.example.com'];
function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;
  if (ALLOWED.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');  // prevent cache poisoning
  }
  next();
}
```

### Common bugs

- Allowlist via `endsWith('.example.com')` → attacker uses `https://example.com.evil.com`
- Regex allowlist with unescaped `.` → matches `.evil-example.com`

## CSP (Content Security Policy)

```bash
# Check what CSP your prod returns
curl -sI https://your.app | grep -i content-security
```

### Required minimum

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{RANDOM}';
  style-src 'self' 'unsafe-inline';   /* CSS is harder to lock down; nonce-style is better */
  img-src 'self' data: https:;
  font-src 'self' data:;
  connect-src 'self' https://api.example.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests;
```

### Anti-patterns

- `script-src 'unsafe-inline' 'unsafe-eval'` — defeats XSS protection
- `script-src *` — same
- No CSP at all — defense layer missing

### CSP reporting

```
Content-Security-Policy-Report-Only: ...; report-uri /csp-violations
```

Use Report-Only mode first to see what would break before enforcing.

## Clickjacking

Attacker iframes your site, overlays UI, tricks user into clicking sensitive button.

**Fix:**

```
X-Frame-Options: DENY
```

OR (preferred — replaces XFO):

```
Content-Security-Policy: frame-ancestors 'none';
```

If you legitimately allow embed:
```
Content-Security-Policy: frame-ancestors 'self' https://trusted-embed.example.com;
```

## Open redirect

```bash
grep -rnE 'res\.redirect\(\s*req\.|window\.location\s*=\s*req\.|location\.href\s*=\s*req\.' src/
```

```ts
// ❌
app.get('/redirect', (req, res) => res.redirect(req.query.url));
// Attacker: /redirect?url=https://phish.com → user thinks it's safe (your-site.com), gets phished

// ✅ — allowlist
const SAFE_REDIRECTS = ['/dashboard', '/profile', '/settings'];
app.get('/redirect', (req, res) => {
  if (!SAFE_REDIRECTS.includes(req.query.url)) return res.redirect('/');
  res.redirect(req.query.url);
});
```

Or for OAuth-style next-URL: validate it's a relative path on your own domain.

## File upload pitfalls

- **MIME-type spoofing** — `Content-Type: image/jpeg` but actual bytes are HTML/PHP. Check magic bytes server-side, not MIME header.
- **Path traversal in filename** — `../../etc/passwd`. Use `path.basename()` + generate UUID filename server-side.
- **Stored XSS via SVG** — SVG can contain `<script>`. Either sanitize via `DOMPurify` (svg profile) or serve from CDN with `Content-Type: image/svg+xml` + CSP.
- **Storage path injection** — `../../bucket-name/etc` if S3 key concatenates user input.
- **Polyglot files** — file that's valid JPEG AND valid HTML. Mitigation: serve user uploads from separate domain (cookie isolation).

## Security headers all-in-one

```ts
// helmet (Express/Fastify)
import helmet from 'helmet';
app.use(helmet({
  contentSecurityPolicy: { directives: { /* see above */ } },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  noSniff: true,
  xFrameOptions: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
```

## Severity calibration

| Finding | Severity |
|---|---|
| DOM XSS reachable from user-controlled input | 🔴 Critical |
| Stored XSS in comments / messages | 🔴 Critical |
| CORS `*` + credentials (or equivalent reflection bug) | 🔴 Critical |
| Open redirect on auth/OAuth callback flow | 🔴 Critical |
| File upload accepts arbitrary type + serves on main domain | 🔴 Critical |
| CSP missing entirely on production | ⚠️ High |
| `unsafe-inline` / `unsafe-eval` in CSP script-src | ⚠️ High |
| Missing X-Frame-Options + missing frame-ancestors | ⚠️ High |
| HSTS missing on production | ⚠️ High |
| Missing SameSite on session cookie | ⚠️ High |
| Open redirect on benign route (not in auth flow) | 🟡 Medium |
| Reflected XSS in admin-only path | 🟡 Medium |
| Missing X-Content-Type-Options | 🟡 Medium |
| Missing Referrer-Policy | 🟢 Low |
