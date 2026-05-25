# Recommended defaults — single source of truth

This file is the canonical home for every numeric knob in Better Auth. Other reference files **link here** instead of repeating values — keeps the skill internally consistent.

## Secrets / env

| Knob | Value | Why |
|---|---|---|
| `BETTER_AUTH_SECRET` length | ≥ 32 bytes (256-bit) | HMAC strength; `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | HTTPS in prod, `http://localhost:3000` in dev | Cookie `secure` auto-derives |

## Sessions

| Knob | Default | Recommended | Why |
|---|---|---|---|
| `session.expiresIn` | `60 * 60 * 24 * 7` (7d) | 7d (consumer), 1d (compliance) | Balance UX with breach window |
| `session.updateAge` | `60 * 60 * 24` (1d) | 1d | Sliding-window refresh cadence |
| `session.cookieCache.enabled` | `false` | `true` in prod | Skip DB read on every request |
| `session.cookieCache.maxAge` | `60 * 5` (5 min) | 5 min | Revocation lag ceiling |
| `session.disableSessionRefresh` | `false` | `true` only if absolute-TTL required | Forces re-auth at `expiresIn` |

## Cookies

| Attribute | Default (HTTPS) | Default (HTTP) |
|---|---|---|
| `httpOnly` | `true` | `true` |
| `secure` | `true` (auto) | `false` |
| `sameSite` | `"lax"` | `"lax"` |
| `path` | `/` | `/` |
| `partitioned` | `false` (set `true` for cross-site contexts) | n/a |

Override only when cross-domain is required:

| Scenario | Required attrs |
|---|---|
| Frontend on `app.example.com`, API on `api.example.com` | `sameSite: "lax"` + `crossSubDomainCookies.enabled: true` + `domain: ".example.com"` |
| Frontend on `app.com`, API on `api.io` | `sameSite: "none"` + `secure: true` + `partitioned: true` |
| Embedded in iframe (Notion-style) | `sameSite: "none"` + `secure: true` + `partitioned: true` |

## Passwords

| Knob | Default | Recommended | Source |
|---|---|---|---|
| `minPasswordLength` | 8 | ≥ 10 (12 for OWASP ASVS L1) | OWASP ASVS V2.1.1 |
| `maxPasswordLength` | 128 | 128 | Memory-hard KDF input bound |
| Hash algorithm | scrypt | scrypt or argon2id | OWASP password-storage cheat sheet |
| `revokeSessionsOnPasswordReset` | `false` | `true` | V3.5.2 |

## Email verification

| Knob | Default | Recommended |
|---|---|---|
| `emailVerification.expiresIn` | `60 * 60` (1h) | 1h |
| `emailVerification.sendOnSignUp` | `false` | `true` |
| `emailVerification.autoSignInAfterVerification` | `false` | `true` |
| `emailAndPassword.requireEmailVerification` | `false` | `true` for password sign-in |

## Magic link / Email OTP

| Knob | Default | Recommended |
|---|---|---|
| `magicLink.expiresIn` | `60 * 5` (5 min) | 5 min |
| `magicLink.disableSignUp` | `false` | `true` if invite-only |
| `emailOTP.expiresIn` | `60 * 5` (5 min) | 5 min |
| `emailOTP.otpLength` | 6 | 6 |
| `emailOTP.allowedAttempts` | 5 | 5 |

## Two-factor

| Knob | Default | Recommended |
|---|---|---|
| TOTP `period` | 30s | 30s (RFC 6238) |
| TOTP `digits` | 6 | 6 |
| `backupCodes.length` | 10 | 10 |
| `otpOptions.period` (2FA email OTP) | `60 * 5` (5 min) | 5 min |
| Trusted-device cookie TTL | 60d | 60d (rotate on password change) |

## Rate limits

Global default applies when `customRules` does not match.

| Path | `window` | `max` | Rationale |
|---|---|---|---|
| (default — all `/api/auth/*`) | 60 | 100 | Burst tolerance for normal flows |
| `/sign-in/email` | 10 | 3 | Brute-force on password |
| `/sign-up/email` | 60 | 5 | Account-creation spam |
| `/forget-password` | 60 | 3 | Email spam, enumeration |
| `/sign-in/magic-link` | 60 | 3 | Email spam |
| `/sign-in/email-otp` | 60 | 5 | OTP guessing |
| `/email-otp/send-verification-otp` | 60 | 3 | Email spam |
| `/email-otp/verify-email` | 60 | 5 | OTP guessing |
| `/two-factor/verify-totp` | 60 | 5 | TOTP brute |
| `/two-factor/verify-otp` | 60 | 5 | OTP brute |
| `/two-factor/verify-backup-code` | 60 | 5 | Backup-code brute |

Storage:
- `"memory"` (default) — single-instance only
- `"database"` — works multi-instance, slower
- `"secondary-storage"` (Redis) — recommended for multi-instance

## JWT plugin

| Knob | Default | Recommended |
|---|---|---|
| Access token TTL | 15 min | 15 min (short; no revocation list) |
| Algorithm | `EdDSA` (Ed25519) | EdDSA or RS256 |
| JWKS rotation cadence | Manual | Rotate every 6–12 months |

## Organization plugin

| Knob | Default | Recommended |
|---|---|---|
| `organizationLimit` | unbounded | 5 (consumer), unbounded (B2B) |
| `invitationExpiresIn` | `60 * 60 * 24 * 2` (2d) | 7d max |
| `allowUserToCreateOrganization` | `true` | gate by plan in SaaS |

## Reverse-proxy headers (production)

Set in Angie / Nginx / Cloudflare in addition to Better Auth:

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
```

## Anti-defaults to avoid

| Setting | Don't | Use instead |
|---|---|---|
| `trustedOrigins: ["*"]` | ❌ | Explicit list or wildcard subdomain |
| `expiresIn: 60 * 60 * 24 * 365` (1y) | ❌ | 7d + sliding refresh |
| `magicLink.expiresIn: 60 * 60 * 24` (1d) | ❌ | 5 min |
| `minPasswordLength: 6` | ❌ | ≥ 10 |
| `rateLimit.enabled: false` in prod | ❌ | Always enabled with custom rules |
| `sameSite: "none"` without `secure: true` + `partitioned: true` | ❌ | Set all three together |

When in doubt, prefer **shorter** TTLs and **fewer** allowed attempts — easier to relax than to tighten under incident.
