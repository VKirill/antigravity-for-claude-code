# OWASP Top 10 2025

The 10 most common web vulnerability classes, refreshed by OWASP from real-world breach data. Use this taxonomy to classify every finding.

Source: <https://owasp.org/Top10/>

## A01: Broken Access Control

**What it is:** Users access data/actions they shouldn't. Includes IDOR (Insecure Direct Object Reference), missing authorization on endpoints, privilege escalation, JWT subject mismatch.

**Grep heuristics:**
```bash
# Endpoints that take user-id from URL but don't verify ownership
grep -rnE 'req\.params\.(userId|user_id|id)' src/ | \
  grep -vE 'verify|check|assert|owner|auth'
```

**Fix patterns:**
- Every endpoint that touches a per-user resource → verify `requestedId === session.userId` OR `requestedUser.tenantId === session.tenantId`
- Use middleware-based authz (`requireAuth`, `requireOwnership`) consistently
- Default-deny: missing role → 403, not 200

→ Deep dive: [auth-access-control.md](auth-access-control.md)

## A02: Cryptographic Failures

**What it is:** Weak/missing encryption of sensitive data at rest/in transit. MD5/SHA1 for passwords, ECB mode, predictable IVs, `Math.random()` for tokens, hardcoded keys, plaintext over HTTP.

**Grep heuristics:**
```bash
grep -rnE 'md5|sha1\(|Math\.random|crypto\.createCipher\(' src/ \
  --include='*.ts' --include='*.js' --include='*.py'
# Note: crypto.createCipher (no IV) is deprecated — use createCipheriv
```

**Fix patterns:**
- Passwords → `argon2id` (preferred) or `bcrypt` (cost ≥ 12)
- Random tokens → `crypto.randomBytes(32).toString('hex')` (Node) / `secrets.token_hex(32)` (Python)
- Symmetric encryption → AES-256-GCM with random 96-bit IV per message
- TLS minimum 1.2; prefer 1.3
- HSTS header on all production hosts

→ Deep dive: [crypto-secrets.md](crypto-secrets.md)

## A03: Injection

**What it is:** Untrusted input interpreted as code/query. SQL, NoSQL ($where), OS command, LDAP, XPath, header, template (SSTI).

**Grep heuristics:**
```bash
# String concatenation building SQL
grep -rnE "query\s*=.*\+|\+\s*\`[^\`]*\$\{|f\"SELECT.*\{" src/
# Shell with user input
grep -rnE "exec\s*\(|spawn\s*\(.*shell:\s*true" src/
```

**Fix patterns:**
- SQL → parameterized queries / prepared statements / ORM
- NoSQL → reject `$where` and operators in user input
- Shell → `execFile`/`spawn` without `shell:true`, args as array
- Templates → never `eval`/`render(user_input as template)`

→ Deep dive: [injection-patterns.md](injection-patterns.md)

## A04: Insecure Design

**What it is:** Missing security controls at design level. No threat model, no rate limit on critical endpoints, business logic that allows fraud (e.g., refund > original payment), missing abuse-case handling.

**Audit questions:**
- Is there rate limiting on auth, password-reset, payment endpoints?
- Can a user request the same idempotent action 100×/sec?
- Are sensitive ops behind multi-factor / step-up auth?
- What's the threat model? (If "we didn't make one" — finding.)

## A05: Security Misconfiguration

**What it is:** Default credentials, verbose error pages, exposed admin endpoints, permissive CORS, missing security headers, unnecessary features enabled (X-Powered-By, server banners).

**Quick scan:**
```bash
# Check for default creds in config
grep -rnE 'password.*(admin|root|test|123|changeme)' config/ docs/
# Check security headers (curl your prod URL)
curl -sI https://your.app | grep -iE 'strict-transport|x-frame|x-content|csp|referrer-policy'
```

**Required headers:**
| Header | Value |
|---|---|
| Strict-Transport-Security | `max-age=31536000; includeSubDomains; preload` |
| X-Content-Type-Options | `nosniff` |
| X-Frame-Options | `DENY` (or use CSP `frame-ancestors`) |
| Referrer-Policy | `strict-origin-when-cross-origin` |
| Content-Security-Policy | Project-specific; avoid `unsafe-inline`/`unsafe-eval` |
| Permissions-Policy | Disable APIs you don't use (camera/microphone/geo) |

## A06: Vulnerable and Outdated Components

**What it is:** Using libraries with known CVEs.

**Run:**
```bash
bash scripts/run-osv-scan.sh         # cross-ecosystem via OSV.dev
npm audit                            # cross-check
pip-audit                            # cross-check
```

→ Deep dive: [supply-chain-osv.md](supply-chain-osv.md)

## A07: Identification and Authentication Failures

**What it is:** Weak passwords accepted, no rate limit on login, no MFA option, session fixation, predictable session IDs, missing `httpOnly`/`secure`/`SameSite` on cookies, JWT misuse.

**Checks:**
- Password policy enforced (length ≥ 12, no common dictionaries)?
- Rate-limit on `/login`, `/password-reset`?
- Session cookies have `httpOnly; Secure; SameSite=Lax` (or Strict)?
- JWT `alg` pinned (no `none`); secret > 256 bits?
- Logout actually invalidates server-side state?

→ Deep dive: [auth-access-control.md](auth-access-control.md)

## A08: Software and Data Integrity Failures

**What it is:** Deserializing untrusted data, accepting auto-update from non-verified sources, CI/CD that pulls from compromised registries without checksums.

**Patterns to flag:**
```bash
# Python pickle / yaml.load unsafe
grep -rnE 'pickle\.loads|yaml\.load\(' src/ --include='*.py' | \
  grep -vE 'SafeLoader|Unpickler.*safe'
# Node eval-equivalent
grep -rnE 'new Function\(|eval\(|setTimeout\(.+,\s*0\s*,' src/
```

**Fix:** never deserialize untrusted; verify signatures on packages (subresource integrity for CDN scripts).

→ Deep dive: [ssrf-deserialization.md](ssrf-deserialization.md)

## A09: Security Logging and Monitoring Failures

**What it is:** Logging missing or noisy; can't detect/respond to attacks.

**Audit:**
- Auth failures logged with IP + user?
- Failed logins trigger anomaly alert > N/min?
- Logs retained ≥ 90 days?
- PII / passwords / tokens NOT in logs (check `console.log(req.body)`)?
- Errors include enough context to triage without including secrets?

## A10: Server-Side Request Forgery (SSRF)

**What it is:** Server fetches URL provided by user → can hit internal services, cloud metadata (`169.254.169.254`), file:// , gopher://.

**Grep:**
```bash
grep -rnE 'fetch\(|axios\.|requests\.get\(|httpx\.get\(|http\.get\(' src/ | \
  grep -E 'req\.|request\.|input|body\.|query\.|params\.'
```

**Fix:** allowlist outbound domains; resolve DNS server-side and check IP not in private ranges; disable HTTP redirects in fetch when target is user-controlled; block `metadata.google.internal` / `169.254.169.254` / `[::1]` / RFC1918.

→ Deep dive: [ssrf-deserialization.md](ssrf-deserialization.md)

## Walking the Top 10 — practical sequence

When asked "проверь весь проект", walk in this order:

1. **A06 (deps)** first — cheapest signal, gives baseline
2. **A02 (crypto/secrets)** — grep + gitleaks
3. **A03 (injection)** — grep patterns above
4. **A01 (broken access)** — read auth middleware, sample endpoints
5. **A10 (SSRF)** if there's any URL-fetching code
6. **A07 (auth)** — review login/session/JWT
7. **A05 (config)** — curl prod URL, check headers
8. **A08 (deserialization)** — usually rare, but high-impact
9. **A04 (design)** — read SPEC if available; ask user about threat model
10. **A09 (logging)** — sample log output, check what's emitted

This order maximizes signal/effort.
