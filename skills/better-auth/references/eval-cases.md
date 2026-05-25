# Eval cases — Better Auth skill routing

v3 eval format. Each case: `prompt → expected behavior`. Used to verify the skill description routes correctly without invoking sibling skills.

## Positive routing — skill SHOULD load

| # | Prompt | Expected |
|---|---|---|
| 1 | "Set up Better Auth in my Next.js App Router project" | Loads `better-auth`. Opens `setup.md` + `database-adapters.md`. |
| 2 | "How do I read the session in a Server Component?" | Loads `better-auth`. Cites `auth.api.getSession({ headers: await headers() })` from `sessions.md`. |
| 3 | "Add Google and GitHub sign-in to my auth.ts" | Loads `better-auth`. Opens `social-providers.md`. |
| 4 | "Enable 2FA with TOTP in Better Auth" | Loads `better-auth`. Opens `two-factor.md`. |
| 5 | "How do I send magic links with Better Auth?" | Loads `better-auth`. Opens `magic-link-otp.md`. |
| 6 | "Add organizations + roles to my SaaS using Better Auth" | Loads `better-auth`. Opens `organizations.md`. |
| 7 | "Migrate from NextAuth v5 to Better Auth" | Loads `better-auth`. Opens `migration-from-nextauth.md`. |
| 8 | "Why is my Better Auth cookie not being set after sign-in?" | Loads `better-auth`. Opens `troubleshooting.md` (§"Session cookie not set"). |
| 9 | "What's a safe rate limit for /sign-in/email?" | Loads `better-auth`. Opens `recommended-defaults.md` + `security.md`. |
| 10 | "Configure trustedOrigins for production" | Loads `better-auth`. Opens `security.md`. |
| 11 | "Use Prisma as the database adapter for Better Auth" | Loads `better-auth` (primary) + `prisma` (related). Opens `database-adapters.md`. |
| 12 | "Mount Better Auth handler on Fastify" | Loads `better-auth`. Opens `setup.md` §Fastify. |
| 13 | "Issue JWTs from Better Auth for our mobile app" | Loads `better-auth`. Opens `sessions.md` §JWT plugin. |
| 14 | "Set up cross-subdomain cookies in Better Auth" | Loads `better-auth`. Opens `security.md` + `troubleshooting.md`. |
| 15 | "redirect_uri_mismatch on Google sign-in" | Loads `better-auth`. Opens `troubleshooting.md` §OAuth callback. |

## Negative routing — skill SHOULD NOT load

| # | Prompt | Expected |
|---|---|---|
| N1 | "How do I use Clerk for sign-in in Next.js?" | Does NOT load `better-auth` (Clerk is a different vendor — SKIP rule). |
| N2 | "Set up Auth.js v5 Credentials provider" | Does NOT load `better-auth` (Auth.js is the legacy stack, not Better Auth — SKIP rule applies). |
| N3 | "Configure Passport.js local strategy" | Does NOT load `better-auth` (legacy Passport — SKIP). |
| N4 | "Build an OAuth provider that issues tokens to third parties" | Does NOT load `better-auth` (Better Auth is a relying party, not an OIDC provider). |
| N5 | "Verify a JWT with `jose` library" | Does NOT load `better-auth` (pure JWT library, unrelated to Better Auth flow). |
| N6 | "Set up Supabase Auth in Next.js" | Does NOT load `better-auth` (Supabase platform — different stack). |
| N7 | "Migrate Lucia auth to v3" | Does NOT load `better-auth` for Lucia-internal questions, but COULD if the user mentions "migrate **to** Better Auth" — disambiguate by intent. |

## Sharp-edge routing (intent disambiguation)

| Prompt | Likely intent → Skill |
|---|---|
| "How do I add session-based auth to my Hono app?" | Better Auth (popular default in 2026 Hono stacks). |
| "Add login to my Express app" | Better Auth — but verify the user is not on a legacy Passport codebase first. |
| "JWT auth in Fastify" | Pure `@fastify/jwt` if no user/session store needed; Better Auth if there's a user model. |
| "OAuth login button in React" | Better Auth client SDK if the backend already has `socialProviders` configured. |

## Cascade behavior

When loaded, `better-auth` should pull in (via `## Related Skills`):
- `prisma` — when the user mentions Prisma adapter
- `postgresql` — when the user mentions schema / migrations on Postgres
- `nextjs` — when on Next.js App Router
- `hono` — when on Hono / Workers / Bun
- `fastify` — when on Fastify-Node
- `redis` — when configuring secondary storage / shared rate limits
- `bullmq` — when queueing verification / magic-link emails

Do NOT pull in unrelated stacks (no `vue` / `astro` cascade) unless the user explicitly mentions them.

## Anti-routing self-check

A prompt like "I'm getting `Invalid origin` 403" should:
1. Route to `better-auth` (high specificity to the library's CSRF surface)
2. Open `troubleshooting.md` first
3. NOT silently load `nextjs` or `hono` unless the framework comes up in follow-up

If the routing pulls in `nodejs` for a plain "set up auth" question — the description has bled into too-generic territory and needs tightening.
