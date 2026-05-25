# Crypto pitfalls + secrets leakage

OWASP A02 deep dive.

## Crypto pitfalls

### Weak hashes for passwords

```bash
grep -rnE '(md5|sha1)\(.*pass|hashlib\.(md5|sha1)\(' src/
```

**Wrong:** MD5, SHA1 (broken). SHA256/SHA512 raw (no salt, no work factor).
**Right:** argon2id > bcrypt > scrypt > PBKDF2 (≥600k iter).

### ECB mode

ECB encrypts identical plaintext blocks to identical ciphertext → leaks structure. Don't use.

```bash
grep -rnE "createCipheriv\(\s*['\"](aes-...-)?ecb|MODE_ECB|new IvParameterSpec.*ECB" src/
```

**Right modes:** AES-256-GCM (preferred — authenticated) or AES-256-CBC + HMAC-SHA256 (encrypt-then-MAC).

### IV reuse

GCM with same key + same IV = catastrophic (key recovery).

```bash
# Static IV (huge red flag)
grep -rnE "(iv|nonce)\s*=\s*['\"][A-Za-z0-9+/=]{8,32}['\"]" src/
```

**Right:** generate IV per message: `crypto.randomBytes(12)` (12 bytes for GCM).

### Predictable RNG

```bash
grep -rnE "Math\.random\(\)|random\.random\(\)|random\.randint" src/ | grep -E 'token|secret|password|key|nonce|csrf|reset'
```

**Wrong:** `Math.random()` for security tokens (it's a Mersenne Twister with predictable seed).
**Right:**
- Node: `crypto.randomBytes(32).toString('hex')` or `crypto.randomUUID()`
- Python: `secrets.token_hex(32)` or `secrets.token_urlsafe(32)`
- Browser: `crypto.getRandomValues(new Uint8Array(32))`

### Timing side channels

`===` on secrets / tokens / signatures → attacker measures response time to brute-force byte by byte.

```bash
grep -rnE "if\s*\(\s*(token|signature|hmac|hash)\s*===|==\s*(req\.headers|req\.body)" src/
```

**Right:**
- Node: `crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))` (lengths must match)
- Python: `hmac.compare_digest(a, b)`

### TLS misconfig

Old TLS 1.0/1.1, weak ciphers (RC4, 3DES), missing HSTS.

```bash
# Production server config check via curl
curl -vI https://your.app 2>&1 | grep -iE 'tls|ssl|cipher'
```

**Right:** TLS 1.2 minimum, prefer 1.3. HSTS with `max-age >= 31536000; includeSubDomains; preload`.

### Custom crypto

NEVER. If you find code implementing a hash, cipher, or signature algorithm from scratch → ⚠️ High by default.

## Secrets leakage

### Hardcoded secrets in code

```bash
# AWS keys
grep -rnE 'AKIA[0-9A-Z]{16}' . --exclude-dir=node_modules --exclude-dir=.git

# Stripe / OpenAI / Anthropic
grep -rnE 'sk-[a-zA-Z0-9-_]{20,}|sk-ant-[a-zA-Z0-9-_]{20,}' . --exclude-dir=node_modules

# Google API keys
grep -rnE 'AIza[0-9A-Za-z\-_]{35}' . --exclude-dir=node_modules

# GitHub PAT
grep -rnE 'ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{82}' .

# Slack bot tokens
grep -rnE 'xox[baprs]-[a-zA-Z0-9-]+' .

# Telegram bot tokens (digits:hex)
grep -rnE '[0-9]{6,12}:[A-Za-z0-9_-]{35}' . --exclude-dir=node_modules

# Generic high-entropy hex (often a secret)
grep -rnE '["\047][a-f0-9]{32,}["\047]' . --exclude-dir=node_modules --exclude='*.lock'
```

### Recommended tool: gitleaks

```bash
npx gitleaks detect --redact --report-format json --report-path /tmp/gitleaks.json
```

Covers 100+ secret patterns, including custom rules via `.gitleaks.toml`.

### What to do when secret is found

1. **Rotate IMMEDIATELY** at the provider (don't wait to fix the leak)
2. **Identify when introduced** — `git log -p --all -S "<secret-fragment>"`
3. **Assess blast radius** — what does this credential access?
4. **Audit access logs** of the affected service for window between introduction and rotation
5. **Add to gitleaks rules** or `.env.example` pattern as a future negative test
6. **Rewrite git history?** — only if you control the repo + can force-push (rare, requires coordination)

### .env hygiene

- `.env*` in `.gitignore` always
- `.env.example` with KEY=PLACEHOLDER for documentation
- Never commit production `.env` even to private repos (sysadmin / cloud secret manager)
- Use [direnv](https://direnv.net/) or 1Password CLI for local-dev secret injection

### Secrets in logs

```bash
# Logging the whole request body or headers
grep -rnE 'console\.log\(\s*req|logger\.\w+\(\s*req\.body|req\.headers' src/

# Specifically logging Authorization header
grep -rnE 'log.*authorization|log.*Bearer' src/
```

**Fix:** redact in log middleware. Common patterns: replace `Authorization` header value with `<redacted>` before serializing.

### Secrets in client-side bundles

```bash
# After build, scan dist/ or build/
grep -rnE 'AKIA|sk-|AIza|ghp_' dist/ build/ public/ 2>/dev/null
```

If anything → secret leaked to all users. Rotate immediately.

### Secrets in error responses

```bash
# Error pages that include stack trace / config
grep -rnE 'error.*stack|err\.stack|err\.config|process\.env' src/ -A2 | \
  grep -B2 'res\.send\|res\.json\|return.*error'
```

**Fix:** error handler that returns generic message in prod, full detail in dev only.

### Secrets in source maps

Production source maps reveal source code (and sometimes inline secrets). Either don't ship them, or restrict access (HTTP auth on `.map` files).

## Severity calibration

| Finding | Severity |
|---|---|
| Production API key in committed code | 🔴 Critical |
| Production secret in client bundle (visible to users) | 🔴 Critical |
| Password hashed with MD5/SHA1/plaintext | 🔴 Critical |
| Static IV in AES-GCM with reuse | 🔴 Critical |
| `===` comparing secrets (timing side-channel) | ⚠️ High |
| `Math.random()` for security tokens | ⚠️ High |
| ECB mode encryption | ⚠️ High |
| Test/staging key in committed code | ⚠️ High |
| TLS 1.0/1.1 still accepted on prod | ⚠️ High |
| Authorization header logged | ⚠️ High |
| Missing HSTS in prod | 🟡 Medium |
| Weak cipher in TLS config | 🟡 Medium |
| Stack traces in prod error responses | 🟡 Medium |
| Custom crypto implementation | 🟡 Medium (until reviewed) |
