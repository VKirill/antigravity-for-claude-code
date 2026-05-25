# Migration — NextAuth / Auth.js → Better Auth

Common request: "we're on NextAuth v4 / Auth.js v5 and want to migrate." This file maps the surface differences and gives a phased migration plan.

## Why migrate

- TypeScript-first vs Auth.js's looser typing
- Framework-agnostic handler (`Request`/`Response`) — same code on Next.js, Hono, Workers
- First-class plugin model (2FA, organizations, passkey, magic-link) without re-wiring callbacks
- Explicit DB schema (you own the migration), not magic adapters
- Simpler session model (cookie sessions by default, JWT optional)

## High-level shape diff

| Concept | NextAuth / Auth.js | Better Auth |
|---|---|---|
| Server entry | `NextAuth({ ... })` returns `{ handlers, auth, signIn, signOut }` | `betterAuth({ ... })` returns `{ handler, api, $Infer }` |
| Handler mount | `app/api/auth/[...nextauth]/route.ts` re-exports `handlers` | `app/api/auth/[...all]/route.ts` uses `toNextJsHandler(auth)` |
| Server session | `await auth()` (Auth.js v5) | `await auth.api.getSession({ headers: await headers() })` |
| Client session | `useSession()` from `next-auth/react` | `authClient.useSession()` from `better-auth/react` |
| Credentials | `CredentialsProvider({ authorize })` | `emailAndPassword: { enabled: true }` (built-in) |
| OAuth | `providers: [Google({...})]` | `socialProviders: { google: {...} }` |
| Magic link | `EmailProvider({...})` | `magicLink()` plugin |
| 2FA | external / hand-rolled | `twoFactor()` plugin |
| Organizations | external / hand-rolled | `organization()` plugin |
| Adapter | `@auth/prisma-adapter` etc. | `prismaAdapter(prisma, { provider })` |
| JWT-only session | `session: { strategy: "jwt" }` | `jwt()` plugin (DB sessions stay default) |
| Env secret | `AUTH_SECRET` / `NEXTAUTH_SECRET` | `BETTER_AUTH_SECRET` |
| Base URL | `AUTH_URL` / `NEXTAUTH_URL` | `BETTER_AUTH_URL` |

## Schema mapping

NextAuth / Auth.js adapter schema → Better Auth schema:

| NextAuth model | Better Auth model | Notes |
|---|---|---|
| `User` | `user` | Same fields (id, email, emailVerified, name, image). Casing convention: lowercase model name. |
| `Account` | `account` | NextAuth stores provider tokens here; Better Auth same idea but adds `password` column for credentials. |
| `Session` | `session` | NextAuth's DB session has same shape; JWT-strategy users have no `Session` rows. |
| `VerificationToken` | `verification` | Tokens for email-verify, magic-link, reset, OTP — all in one table. |

If your users have **JWT-strategy** sessions in NextAuth, you'll need a one-shot migration script to:
1. Issue a Better Auth session row for every active user on first sign-in
2. Or just force re-auth — cleanest path

## Phased migration

### Phase 0 — Inventory

- List your providers, plugins, custom callbacks (`session`, `signIn`, `jwt`)
- Note any custom DB columns added to NextAuth tables
- Document custom middleware (`auth()` checks in `middleware.ts`)

### Phase 1 — Side-by-side install

Install Better Auth alongside NextAuth. Mount on a different route prefix:

```ts
// Keep NextAuth at /api/auth/*
// Mount Better Auth at /api/auth2/* during migration

// app/api/auth2/[...all]/route.ts
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
export const { POST, GET } = toNextJsHandler(auth);
```

Generate the new schema as **separate tables** (e.g., `user2`, `session2`) so production data is untouched. Use Better Auth's `modelName` override:

```ts
betterAuth({
  user: { modelName: "user_betterauth" },
  session: { modelName: "session_betterauth" },
  account: { modelName: "account_betterauth" },
  verification: { modelName: "verification_betterauth" },
});
```

Generate + apply migration via your ORM. NextAuth keeps running unchanged.

### Phase 2 — Backfill users

One-shot script: copy `User` rows into `user_betterauth`, preserving IDs:

```ts
// scripts/migrate-users.ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const users = await prisma.user.findMany();
for (const u of users) {
  await prisma.user_betterauth.upsert({
    where: { id: u.id },
    update: {},
    create: {
      id: u.id,
      email: u.email!,
      emailVerified: u.emailVerified !== null,
      name: u.name ?? u.email!.split("@")[0],
      image: u.image,
      createdAt: u.createdAt ?? new Date(),
      updatedAt: u.updatedAt ?? new Date(),
    },
  });
}
```

For `Account` rows (OAuth links), copy with provider-name normalization (Better Auth uses lowercase provider IDs: `google`, `github`, etc.).

**Passwords**: NextAuth Credentials providers typically stored passwords in your own table. Migrate hashes into `account_betterauth.password` for `providerId: "credential"`. If the hash algorithm differs (e.g., bcrypt vs scrypt), implement a custom `password.verify` that handles both during the transition (see [email-and-password.md](email-and-password.md) §"Password hashing — custom").

### Phase 3 — Cut over routes

Switch frontend code over to `better-auth/react`'s `authClient`:

```diff
- import { useSession, signIn, signOut } from "next-auth/react";
+ import { authClient } from "@/lib/auth-client";
+ const { useSession } = authClient;

  function Header() {
-   const { data: session } = useSession();
+   const { data: session } = authClient.useSession();
    // ...
  }
```

Server reads:

```diff
- import { auth } from "@/auth";
- const session = await auth();
+ import { auth } from "@/lib/auth";
+ import { headers } from "next/headers";
+ const session = await auth.api.getSession({ headers: await headers() });
```

Mount Better Auth at the canonical `/api/auth/*` prefix (and remove NextAuth's handler).

### Phase 4 — Drop NextAuth

Once traffic confirms parity for 1–2 weeks:

```bash
npm uninstall next-auth @auth/prisma-adapter
# Drop old tables in a final migration
# prisma migrate dev --name drop_nextauth_tables
```

## Callback mapping

| NextAuth callback | Better Auth equivalent |
|---|---|
| `callbacks.signIn({ user, account })` | `auth.api` hook — coming via `databaseHooks` / `hooks` config |
| `callbacks.session({ session, user })` | Use `additionalFields` on session config, or shape on the client |
| `callbacks.jwt({ token, user })` | `jwt()` plugin handles JWT shape; payload via plugin options |
| `events.signIn` / `signOut` | `databaseHooks.user.create.after`, custom plugin hooks |

The mental shift: NextAuth invites callbacks for every transition; Better Auth prefers explicit plugins and `auth.api` calls.

## Env vars

```diff
- NEXTAUTH_SECRET=...
- NEXTAUTH_URL=https://app.example.com
+ BETTER_AUTH_SECRET=...
+ BETTER_AUTH_URL=https://app.example.com
```

`BETTER_AUTH_SECRET` should be a **fresh** value (≥32 random bytes), not a copy of `NEXTAUTH_SECRET` — keep secrets domain-isolated.

## Common pitfalls

- ❌ Trying to share session cookies between NextAuth and Better Auth — they use different signing schemes
- ❌ Migrating bcrypt-hashed passwords by re-hashing eagerly — let `password.verify` handle both during a transition, re-hash lazily on next sign-in
- ❌ Skipping a re-auth window — users may need to sign in once during cutover; communicate it
- ❌ Removing NextAuth tables on the same deploy that mounts Better Auth — keep them until traffic is fully migrated

## When NOT to migrate

- You're happy with Auth.js v5 and use no extra plugins (2FA / orgs)
- You're on Edge-only stack with no DB sessions and JWT-only flows
- You have heavy custom callback logic that would be more work to port than to maintain
