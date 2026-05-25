# Security

Auth is high-stakes. This file documents Better Auth's defenses and the configuration knobs you must set explicitly in production.

Numeric defaults — see [recommended-defaults.md](recommended-defaults.md). Symptom-indexed diagnoses — see [troubleshooting.md](troubleshooting.md).

## CSRF protection

Better Auth implements layered CSRF defenses (no CSRF token needed in most flows):

1. **Origin header validation** — every state-changing request is checked against `trustedOrigins`. Mismatch → `403 Invalid origin`.
2. **Content-Type gating** — only `application/json` (and a few non-simple types) are accepted, blocking the classic form-POST cross-origin trick.
3. **Fetch Metadata** (`Sec-Fetch-Site`, `Sec-Fetch-Mode`) — modern browsers send these; Better Auth rejects suspicious combinations.
4. **`SameSite=Lax` cookies** — the session cookie is not sent on cross-site top-level navigations except safe GET requests.

`trustedOrigins` config:

```ts
betterAuth({
  trustedOrigins: [
    "https://app.example.com",
    "https://*.example.com",          // single-level wildcard
    "https://**.dev.example.com",     // multi-level wildcard
    "myapp://",                       // custom scheme (mobile deep link)
  ],
});
```

Dynamic origins (per-request):

```ts
trustedOrigins: async (request) => {
  // e.g. allow all verified org domains from DB
  const url = new URL(request.url);
  if (url.hostname.endsWith(".vercel.app")) return [url.origin];
  return [];
},
```

**Never** set `trustedOrigins: ["*"]` — it defeats the entire CSRF layer.

## Cookies

Defaults:

| Attribute | Value |
|---|---|
| `httpOnly` | `true` |
| `secure` | `true` when `baseURL` is HTTPS, `false` otherwise |
| `sameSite` | `lax` |
| `path` | `/` |
| `domain` | unset (host-only) |

Override:

```ts
betterAuth({
  advanced: {
    defaultCookieAttributes: {
      sameSite: "none",   // cross-domain
      secure: true,       // mandatory with sameSite: "none"
      partitioned: true,  // CHIPS — modern browsers require it for third-party cookies
    },
    // Cross-subdomain sessions (a.example.com ↔ b.example.com)
    crossSubDomainCookies: {
      enabled: true,
      domain: ".example.com",
    },
    // Custom cookie names (e.g., to avoid clashes)
    cookiePrefix: "myapp",
  },
});
```

Modern browser rules:
- `SameSite=None` **requires** `Secure=true`.
- Cross-site iframes / third-party contexts **require** `Partitioned=true` (CHIPS) or the cookie will be silently dropped.

## Password hashing

Default: **scrypt** (memory-hard, OWASP-recommended).

- 16384 N / 8 r / 1 p (industry-standard scrypt params)
- Salts per password
- Constant-time verification

Customize for argon2id (see [email-and-password.md](email-and-password.md) §"Password hashing — custom").

Never use:
- `bcrypt` with rounds < 12
- Any SHA-* family without a memory-hard KDF wrapper
- `crypto.pbkdf2` with < 600,000 iterations
- A homemade hash function

## Rate limiting

Default: **100 requests / 60s** per IP, applied to client-initiated requests. Disabled in development by default.

```ts
betterAuth({
  rateLimit: {
    enabled: true,
    window: 60,          // seconds — see recommended-defaults.md
    max: 100,
    storage: "memory",   // | "database" | "secondary-storage"

    customRules: {
      // path → { window, max }
      "/sign-in/email":           { window: 10, max: 3 },
      "/sign-up/email":           { window: 60, max: 5 },
      "/forget-password":         { window: 60, max: 3 },
      "/sign-in/magic-link":      { window: 60, max: 3 },
      "/two-factor/verify-totp":  { window: 60, max: 5 },
      "/email-otp/send-verification-otp": { window: 60, max: 3 },
    },
  },
});
```

Server-side calls via `auth.api.*` bypass rate limits. Front-channel calls from the browser do not.

Production requirements:
- `storage: "secondary-storage"` (Redis) when running >1 instance — memory storage is per-process and lets attackers cycle replicas.
- `storage: "database"` is also valid but less performant under burst.

## IP source header

Behind a reverse proxy (Angie/Nginx, Cloudflare), set the trusted header:

```ts
betterAuth({
  advanced: {
    ipAddress: {
      ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"],  // first match wins
      disableIpTracking: false,
    },
  },
});
```

Only allow headers your proxy sets — never trust `X-Forwarded-For` if it's user-controlled (no proxy in front). The headers are used for rate limits and audit logs (`session.ipAddress`).

## Brute-force protection

The combination of:
- Per-route custom rate limits (3–5 attempts / 60s on sign-in / OTP / reset)
- Email enumeration protection (uniform response shape on `requestPasswordReset` / `sendVerificationOtp`)
- Lockout via `emailOTP.allowedAttempts` (5 wrong codes → invalidate the OTP)
- `revokeSessionsOnPasswordReset: true` (forces re-auth on every device)

…produces a layered defense. Add **Fail2ban / cloud WAF** at the edge for IP-level blocking after repeated 401s.

## Passkeys (`passkey()` plugin)

WebAuthn-based phishing-resistant credentials. Use as a second factor or as the primary auth.

```ts
import { passkey } from "better-auth/plugins";

betterAuth({
  plugins: [
    passkey({
      rpName: "MyApp",
      rpID: "app.example.com",  // must match the origin TLD+1
      origin: "https://app.example.com",
    }),
  ],
});
```

Client:
```ts
import { passkeyClient } from "better-auth/client/plugins";
authClient = createAuthClient({ plugins: [passkeyClient()] });

await authClient.passkey.addPasskey();          // enroll
await authClient.signIn.passkey();              // discoverable credential
await authClient.passkey.listUserPasskeys();
```

## OWASP ASVS mapping (selective)

| ASVS L1 control | Better Auth handling |
|---|---|
| V2.1.1 — Min password length 12 | Configurable via `minPasswordLength` (default 8 — raise) |
| V2.1.5 — No password truncation | Honored (max 128) |
| V2.4.3 — Memory-hard KDF | scrypt default; argon2id pluggable |
| V3.2.1 — Session tokens random ≥64 bits | Cryptographically random opaque tokens, signed |
| V3.3.1 — Session timeout | `expiresIn` 7d, `updateAge` 1d defaults |
| V3.5.2 — Logout invalidates session | `auth.api.signOut` / `revokeSessions` |
| V4.1.1 — Authorization at every request | `auth.api.getSession({ headers })` on every protected route |
| V8.2.1 — Sensitive data in URL | Tokens (verification, reset, magic-link) are bearer query params over HTTPS, single-use, short-TTL |
| V9.2.1 — TLS-only cookies | `secure: true` auto when HTTPS |
| V13.2.1 — CSRF protection | Origin + Fetch-Metadata + SameSite=Lax |

ASVS L2/L3 controls — pair with WAF, anomaly detection, and access logs at the edge.

## Secret rotation

Rotating `BETTER_AUTH_SECRET` invalidates **all** existing sessions. Plan:

1. Generate new secret.
2. Deploy with `BETTER_AUTH_SECRET=<new>` on **every** instance simultaneously (avoid mixed fleet).
3. Notify users that they'll be signed out.
4. Discard the old secret.

For a graceful rotation, fork the codebase to accept both old + new during a deprecation window — but this is rarely worth the complexity vs. forced re-auth.

## Headers you should also set (edge / framework)

These are **outside** Better Auth's surface but complement it:

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY                    # or Content-Security-Policy: frame-ancestors 'none'
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: ...
```

Set in Angie/Nginx, the framework (`next.config.ts` headers, Hono `secureHeaders`), or via [linux-sysadmin](../../linux-sysadmin/SKILL.md).
