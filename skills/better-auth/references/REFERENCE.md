# Better Auth — Reference Index

Slim decision map. Open the specific file you need; do not read everything.

## Decision map

| If you need to… | Open |
|---|---|
| Start a new Better Auth install from scratch | [setup.md](setup.md) → [database-adapters.md](database-adapters.md) → [recommended-defaults.md](recommended-defaults.md) |
| Pick / wire a database adapter | [database-adapters.md](database-adapters.md) |
| Mount the handler in Next.js / Hono / Fastify / Express / Nuxt / SvelteKit / Workers | [setup.md](setup.md) §"Framework handlers" |
| Configure sessions (cookies, JWT, server vs client retrieval) | [sessions.md](sessions.md) |
| Add Google / GitHub / Discord / Apple / Microsoft sign-in | [social-providers.md](social-providers.md) |
| Enable email + password sign-up / sign-in | [email-and-password.md](email-and-password.md) |
| Add 2FA (TOTP + backup codes) | [two-factor.md](two-factor.md) |
| Add magic link or email OTP | [magic-link-otp.md](magic-link-otp.md) |
| Add organizations / teams / RBAC | [organizations.md](organizations.md) |
| Harden security (CSRF, cookies, rate limits) | [security.md](security.md) + [wrong-vs-right.md](wrong-vs-right.md) |
| Migrate from NextAuth / Auth.js | [migration-from-nextauth.md](migration-from-nextauth.md) |
| Debug a failing flow (cookie / CORS / callback / schema drift) | [troubleshooting.md](troubleshooting.md) |
| Set production knobs (TTLs, rate limits, password length) | [recommended-defaults.md](recommended-defaults.md) |
| Validate skill routing | [eval-cases.md](eval-cases.md) |

## Capability map

```
betterAuth({ ... })
├── database              → database-adapters.md
├── emailAndPassword      → email-and-password.md
├── socialProviders       → social-providers.md
├── session               → sessions.md
├── trustedOrigins        → security.md
├── advanced              → security.md (cookies), sessions.md (cookieCache)
├── rateLimit             → security.md, recommended-defaults.md
└── plugins
    ├── twoFactor         → two-factor.md
    ├── magicLink         → magic-link-otp.md
    ├── emailOTP          → magic-link-otp.md
    ├── organization      → organizations.md
    ├── jwt               → sessions.md (§JWT plugin)
    ├── passkey           → security.md (§passkeys)
    ├── admin             → organizations.md (§admin)
    └── username          → email-and-password.md (§username)
```

## File size budget

Each file < 500 lines; SKILL.md < 500 lines. If a reference grows past 500, split it.

## Cross-references

- `recommended-defaults.md` is the **single source of truth** for numeric knobs. Other files link there instead of repeating values.
- `troubleshooting.md` is **symptom-indexed** — reactive. `wrong-vs-right.md` is **preventive**. Do not merge them.
