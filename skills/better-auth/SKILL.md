---
name: better-auth
description: "Better Auth — framework-agnostic TypeScript authentication. Email/password, OAuth/social login, sessions, JWT, 2FA, magic link, email OTP, organizations/teams, RBAC, passkeys. Use when: better-auth, betterAuth, authClient, auth.api, createAuthClient, signUp.email, signIn.email, signIn.social, signIn.magicLink, getSession, useSession, twoFactor, magicLink, emailOTP, organization plugin, trustedOrigins, baseURL, BETTER_AUTH_SECRET, NextAuth alternative, Auth.js migration, Prisma/Drizzle/Kysely auth adapter, cookie sessions, OAuth callback, social provider, sign-in, login, OAuth flow, JWT issuance. SKIP: Auth0/Clerk/Supabase Auth platforms, Lucia (sunset), Passport.js (legacy Express middleware), NextAuth/Auth.js usage (different lib)."
stacks:
  - better-auth
  - typescript
  - nodejs-backend
tags:
  - auth
  - security
  - sessions
  - oauth
  - rbac
  - 2fa
packages:
  - better-auth
  - "@better-auth/cli"
manifests:
  - auth.ts
  - auth.config.ts
  - lib/auth.ts
  - lib/auth-client.ts
source: vechkasov-global-skills
risk: high-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- Better Auth: `1.6.x`
- TypeScript: `6.0.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->


## Usage

Loaded automatically when the description matches the task. Pattern 2 — open only the references you need; do not read every file.

## Use this skill when

- Standing up a fresh Better Auth install — `betterAuth()` config, `BETTER_AUTH_SECRET`, `baseURL`, `trustedOrigins`, mounting the request handler
- Wiring a framework adapter — Next.js App Router (`toNextJsHandler`), Hono (`auth.handler(c.req.raw)`), Fastify, Express (`toNodeHandler`), Nuxt, SvelteKit, Cloudflare Workers
- Choosing or configuring a database adapter — Prisma (`prismaAdapter`), Drizzle (`drizzleAdapter`), built-in Kysely (`new Pool(...)`), MongoDB (`mongodbAdapter`), Redis secondary storage
- Enabling email + password sign-up/sign-in — `emailAndPassword.enabled`, `requireEmailVerification`, `sendVerificationEmail`, password reset (`requestPasswordReset` / `resetPassword`)
- Adding social/OAuth providers — Google, GitHub, Discord, Apple, Microsoft, Twitter — including custom scopes and callback URLs
- Configuring sessions — `expiresIn`, `updateAge`, `cookieCache`, server-side `auth.api.getSession({ headers })`, client `authClient.useSession()`
- Adding plugins — `twoFactor()` (TOTP + backup codes), `magicLink()`, `emailOTP()`, `organization()`, `jwt()`, `admin()`, `username()`, `passkey()`
- Hardening security — `trustedOrigins` wildcards, CSRF Origin checks, rate limiting, IP source headers, secure cookies, cross-subdomain cookies
- Migrating from NextAuth/Auth.js, Auth0, Lucia, or Passport to Better Auth
- Diagnosing common failures — cookie not set, CORS rejection, callback URL mismatch, schema drift, "session not found"

## Do not use this skill when

- Using **Auth0** / **Clerk** / **Supabase Auth** / **Firebase Auth** managed platforms — use vendor-specific skill or general assistant
- Using **NextAuth.js / Auth.js v5** — different library; this skill is for the Better Auth fork-or-replacement migration target
- Using **Lucia** (sunset 2025) — recommend migrating to Better Auth
- Using **Passport.js** strategies with Express — legacy middleware model; this skill is for the new server-component / Web Standards API
- Pure JWT issuance without a session/user store — use `jose` / `jsonwebtoken` directly
- Building an OAuth **provider** (issuing tokens to third parties) — Better Auth is a relying party; use `node-oidc-provider` or similar

## Purpose

Better Auth is a framework-agnostic TypeScript authentication and authorization library positioned as the modern replacement for NextAuth.js / Auth.js, Lucia (sunset), and ad-hoc Passport stacks. It ships a typed server SDK (`betterAuth()`), a typed client SDK (`createAuthClient()`), pluggable database adapters (Prisma, Drizzle, Kysely, MongoDB), and a plugin ecosystem covering 2FA, magic link, email OTP, organizations/teams, JWT, passkeys, admin, and more. The handler uses Web Standards `Request`/`Response` so it mounts cleanly into Next.js App Router, Hono, Fastify (Node-handler bridge), Express, Nuxt, SvelteKit, Cloudflare Workers, and Bun.

This skill covers: setup and environment variables, framework integration, every supported database adapter, session and cookie behavior, social providers, email+password flows, the major plugins (2FA / magic link / OTP / organization), security defaults, and migration from NextAuth. Auth is **high-stakes** — security defaults, troubleshooting, and wrong-vs-right pairs are first-class references.

## Capabilities

Each line summarizes a capability; the linked reference owns the code.

- **Setup & framework handlers** — `betterAuth()` config, `BETTER_AUTH_SECRET`, `baseURL` / `BETTER_AUTH_URL`, `trustedOrigins`, mounting on Next.js App Router, Hono, Fastify, Express, Nuxt, SvelteKit, Cloudflare Workers. → [setup.md](references/setup.md)
- **Database adapters** — Prisma (`prismaAdapter`), Drizzle (`drizzleAdapter`), built-in Kysely (`pg` `Pool` / `better-sqlite3`), MongoDB; schema requirements, CLI migrations (`npx @better-auth/cli generate` / `migrate`). → [database-adapters.md](references/database-adapters.md)
- **Sessions** — DB-backed cookie sessions, `expiresIn`, `updateAge`, `cookieCache`, server `auth.api.getSession({ headers })`, client `authClient.useSession()`, JWT alternative via `jwt()` plugin. → [sessions.md](references/sessions.md)
- **Social providers** — Google, GitHub, Discord, Apple, Microsoft, Twitter and 30+ more; `clientId` / `clientSecret`, `scope`, `disableDefaultScope`, callback URLs, `signIn.social({ provider, callbackURL })`. → [social-providers.md](references/social-providers.md)
- **Email + password** — `emailAndPassword.enabled`, `minPasswordLength`/`maxPasswordLength`, `autoSignIn`, `requireEmailVerification`, `sendVerificationEmail`, password reset (`requestPasswordReset`/`resetPassword`), `revokeSessionsOnPasswordReset`. → [email-and-password.md](references/email-and-password.md)
- **Two-factor (TOTP + backup codes)** — `twoFactor()` plugin, `authClient.twoFactor.enable`, `verifyTOTP`, `verifyOtp`, `trustDevice`, backup codes. → [two-factor.md](references/two-factor.md)
- **Magic link & email OTP** — `magicLink()` (`sendMagicLink`, `expiresIn`), `emailOTP()` (`sendVerificationOTP` for sign-in / verification / password reset), rate-limit hardening. → [magic-link-otp.md](references/magic-link-otp.md)
- **Organizations / teams / RBAC** — `organization()` plugin, create/invite/list members, `setActive`, `allowUserToCreateOrganization`, custom roles via access controller (`ac`). → [organizations.md](references/organizations.md)
- **Security** — CSRF via Origin + Fetch Metadata, `trustedOrigins` (wildcards), `SameSite=Lax` cookies (secure when HTTPS), scrypt password hashing, rate limiting, IP header trust, brute-force protection, OWASP ASVS mapping. → [security.md](references/security.md)
- **Migration from NextAuth/Auth.js** — schema mapping (`User` → `user`, `Account` → `account`, etc.), handler relocation, callback rewrites, session-shape differences, env-var rename. → [migration-from-nextauth.md](references/migration-from-nextauth.md)
- **Recommended defaults** — single source of truth for session expiry, cookie attributes, password length, rate-limit windows, JWT TTLs, magic-link TTL. → [recommended-defaults.md](references/recommended-defaults.md)
- **Troubleshooting** — symptom-indexed: cookie not set, CORS rejected, "Invalid origin", callback URL mismatch, schema drift, `session not found`, secret rotation, cross-subdomain failures. → [troubleshooting.md](references/troubleshooting.md)
- **Wrong vs right** — five paste-runnable security pairs: client-side trust vs server `getSession`, exposing JWT to JS vs httpOnly cookies, plaintext passwords vs scrypt+verifyEmail, missing `trustedOrigins` vs explicit, weak rate limits vs hardened sign-in. → [wrong-vs-right.md](references/wrong-vs-right.md)
- **Eval cases** — routing prompts and expected behavior to validate the skill loads correctly. → [eval-cases.md](references/eval-cases.md)

## Behavioral Traits

- Always reads the session **server-side** with `auth.api.getSession({ headers })` for authorization decisions — never trusts a client-decoded cookie or JWT claim
- Always defines `trustedOrigins` explicitly in production — never leaves it empty or relies on a wildcard `*`
- Always sets `BETTER_AUTH_SECRET` to ≥32 random bytes (e.g., `openssl rand -base64 32`) — never a guessable string, never committed
- Uses the **same** Better Auth version across server, client, and CLI — peer-dep mismatch silently breaks the schema
- Generates DB schema via `npx @better-auth/cli generate` and applies via the chosen ORM's migration tool — never hand-edits the auth tables
- Stores cookies `httpOnly: true`, `sameSite: "lax"` (or `"none"` + `secure` + `partitioned` for cross-domain), `secure: true` in production
- Enables `cookieCache` (5 min) for hot session reads, but treats it as a cache — invalidates on sign-out / password change via `revokeSessions`
- Prefers `auth.api.getSession({ headers })` over hand-rolled cookie parsing in middleware
- Awaits `sendMagicLink` / `sendVerificationEmail` callbacks responsibly — uses queue/`bullmq` to avoid timing-attack signal and request-handler latency
- Validates social-provider callback URLs against an allow-list — open-redirect prevention
- Tags rate-limit-sensitive endpoints (sign-in, forget-password, OTP send) with stricter custom rules than the default `100/min`
- Uses `organization` plugin for multi-tenant RBAC instead of ad-hoc `role` columns

## Important Constraints

- NEVER trust client-decoded JWT claims for authorization — always call `auth.api.getSession({ headers })` server-side
- NEVER expose `BETTER_AUTH_SECRET` to the client bundle — server-only env var
- NEVER set `trustedOrigins` to `["*"]` — it defeats CSRF protection and enables open redirects
- NEVER store the session token in `localStorage` or a JS-readable cookie — keep it `httpOnly`
- NEVER hand-edit Better Auth's database tables — schema drift breaks adapters silently; regenerate via CLI
- NEVER set `sameSite: "none"` without `secure: true` AND `partitioned: true` — modern browsers reject it
- NEVER skip email verification for password-reset flows — enables account takeover via typo'd email
- NEVER use the default rate-limit window (`100 req / 60s`) for sign-in / OTP / forget-password — these need 3–5 / 10s
- NEVER store passwords with anything weaker than scrypt (default) or argon2id — `bcrypt` rounds < 12 and SHA-* are out
- ALWAYS pin matching versions for `better-auth` (server), `better-auth/client` (auto-imported), and `@better-auth/cli`
- ALWAYS run the CLI migration after enabling a new plugin (2FA, organization, passkey add new tables/columns)
- ALWAYS configure `sendVerificationEmail` / `sendResetPassword` / `sendMagicLink` callbacks before enabling those flows — otherwise users get silently dropped

## Related Skills

### Runtime & language
- ✓ `nodejs` — Node 24 LTS host
- ✓ `typescript` — TS 6.0 (Better Auth is TS-first)

### Database & ORM
- ✓ `prisma` — most common adapter target
- ✓ `postgresql` — most common backing DB

### Web frameworks
- ✓ `nextjs` — `toNextJsHandler(auth)` for App Router
- ✓ `hono` — `auth.handler(c.req.raw)` on Workers / Bun / Node
- ✓ `fastify` — bridge via `toNodeHandler(auth)`

### Cache / queue (for outbound emails)
- ✓ `redis` — secondary storage for sessions/rate-limits
- ✓ `bullmq` — queue magic-link / verification / reset emails

### Validation
- ✓ `zod` — validate inputs feeding `auth.api.*` calls

### Code discipline
- ✓ `karpathy-guidelines` — surgical changes around auth surface

## API Reference

Domain-specific references (Pattern 2) — load only what's relevant:

| Topic | File |
|---|---|
| Setup, env vars, framework handlers (Next.js / Hono / Fastify / Express / Nuxt / SvelteKit / Workers) | [references/setup.md](references/setup.md) |
| Database adapters — Prisma, Drizzle, Kysely, MongoDB, schema generation, CLI migrations | [references/database-adapters.md](references/database-adapters.md) |
| Sessions — cookie sessions, JWT, `expiresIn`, `cookieCache`, server vs client retrieval | [references/sessions.md](references/sessions.md) |
| Social providers — Google, GitHub, Discord, Apple, Microsoft; scopes, callbacks | [references/social-providers.md](references/social-providers.md) |
| Email + password — sign-up, sign-in, verification, password reset, autoSignIn | [references/email-and-password.md](references/email-and-password.md) |
| Two-factor — TOTP, backup codes, trustDevice, OTP fallback | [references/two-factor.md](references/two-factor.md) |
| Magic link + email OTP — `magicLink()`, `emailOTP()`, rate-limit hardening | [references/magic-link-otp.md](references/magic-link-otp.md) |
| Organizations / teams / RBAC — create, invite, members, custom roles | [references/organizations.md](references/organizations.md) |
| **Security** — CSRF, `trustedOrigins`, cookies, hashing, rate limiting, OWASP ASVS mapping | [references/security.md](references/security.md) |
| Migration from NextAuth / Auth.js — schema, handler, env, callbacks | [references/migration-from-nextauth.md](references/migration-from-nextauth.md) |
| **Recommended defaults** — session expiry, cookie attrs, password length, rate limits, TTLs | [references/recommended-defaults.md](references/recommended-defaults.md) |
| **Troubleshooting** — cookie / CORS / callback / schema-drift / session-not-found symptoms | [references/troubleshooting.md](references/troubleshooting.md) |
| **Wrong vs Right** — 5 paste-runnable auth security pairs | [references/wrong-vs-right.md](references/wrong-vs-right.md) |
| Eval cases — routing prompt suite | [references/eval-cases.md](references/eval-cases.md) |
| REFERENCE — decision map / when to open which doc | [references/REFERENCE.md](references/REFERENCE.md) |

**How to use**: new install → `setup.md` + `database-adapters.md` + `recommended-defaults.md`. Hardening → `security.md` + `wrong-vs-right.md` + `troubleshooting.md`. Adding a feature (2FA / orgs / magic link) → the plugin-specific reference. Migrating off NextAuth → `migration-from-nextauth.md`.
