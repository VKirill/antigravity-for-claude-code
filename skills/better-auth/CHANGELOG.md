# better-auth — CHANGELOG

## 1.0.0

Initial release of the `better-auth` skill.

### Added

- `SKILL.md` — Pattern 2 navigator with frontmatter (`risk: high-stakes`), full audit-checklist sections, trigger-heavy description, related-skills cross-links, and complete API Reference table.
- `references/REFERENCE.md` — slim index + decision map + capability tree.
- `references/setup.md` — install, env vars, server/client instance, framework handlers (Next.js / Hono / Fastify / Express / Nuxt / SvelteKit / Cloudflare Workers), schema generation, sanity check, `better-auth/minimal` guidance.
- `references/database-adapters.md` — Prisma, Drizzle, built-in Kysely, MongoDB; Redis secondary storage; core + plugin schema tables; selection rules.
- `references/sessions.md` — session shape, server/client retrieval, `session` config, `cookieCache` and `updateAge` semantics, JWT plugin, bearer plugin, authorization patterns.
- `references/social-providers.md` — Google, GitHub, Discord, Apple, Microsoft; default callback URLs, scopes, account linking, `genericOAuth`, common errors.
- `references/email-and-password.md` — sign-up/sign-in, email verification, password reset, custom hashing, `username` plugin, enumeration protection.
- `references/two-factor.md` — `twoFactor()` plugin, TOTP, backup codes, trusted device, OTP fallback, rate-limit hardening.
- `references/magic-link-otp.md` — `magicLink()` + `emailOTP()` plugins, server + client, strict rate-limit recommendations.
- `references/organizations.md` — orgs / members / invitations, custom roles via access controller, teams, per-org SSO, `admin()` plugin.
- `references/security.md` — CSRF (Origin + Fetch Metadata + SameSite), cookies (defaults + cross-subdomain + CHIPS), scrypt hashing, rate limiting, IP source headers, brute-force defense, passkeys, OWASP ASVS L1 mapping, secret rotation, edge headers.
- `references/recommended-defaults.md` — single source of truth for every numeric knob: secrets, sessions, cookies, passwords, email verification, magic-link/OTP, 2FA, rate limits, JWT, org plugin, anti-defaults.
- `references/troubleshooting.md` — symptom-indexed: cookie not set, 403 Invalid origin, `redirect_uri_mismatch`, session-not-found, schema drift, CORS, email-verification, dev rate-limit, cross-subdomain cookies, Prisma adapter missing client, magic-link emails not arriving.
- `references/wrong-vs-right.md` — five paste-runnable pairs: client-trust vs server `getSession`, JS-readable token vs httpOnly cookie, weak hash vs scrypt/argon2id, wildcard vs explicit `trustedOrigins`, default vs hardened rate limits.
- `references/migration-from-nextauth.md` — schema mapping, phased plan, callback mapping, env-var rename, common pitfalls.
- `references/eval-cases.md` — 15 positive + 7 negative routing prompts, cascade behavior, anti-routing self-check.

### Notes

- Skill is registered as `risk: high-stakes` per skill-evaluation v3 rules → ships `troubleshooting.md`, `recommended-defaults.md`, and `wrong-vs-right.md`.
- Version block (`<!-- versions:start -->`) is **not** present in this commit. The main agent runs `~/.claude/scripts/sync_skill_versions.py` after registering `better-auth` in `SKILL_STACKS`; that script injects the block.
- All references < 500 lines; SKILL.md < 500 lines.
- No hardcoded version numbers in body prose — versions belong in the sync-managed block.
