# Sessions

Better Auth ships **DB-backed cookie sessions** by default. Optional JWT plugin issues short-lived bearer tokens on top.

Numeric defaults (expiry, cookie cache) — see [recommended-defaults.md](recommended-defaults.md). This file covers shape and patterns.

## Session shape

```ts
type Session = {
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
    token: string;        // opaque, signed with BETTER_AUTH_SECRET
    ipAddress: string | null;
    userAgent: string | null;
    // + activeOrganizationId if organization plugin enabled
  };
  user: {
    id: string;
    email: string;
    emailVerified: boolean;
    name: string;
    image: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
};
```

## Reading session — server

Always pass `headers`. The handler reads the cookie from there.

```ts
import { auth } from "@/lib/auth";

// Next.js (App Router) — Server Component / Server Action / Route Handler
import { headers } from "next/headers";
const session = await auth.api.getSession({ headers: await headers() });
if (!session) throw new Error("Unauthorized");
session.user.id;

// Hono
app.get("/me", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  return c.json(session);
});

// Fastify
app.get("/me", async (req, reply) => {
  const session = await auth.api.getSession({
    headers: new Headers(req.headers as Record<string, string>),
  });
  return session ?? reply.code(401).send();
});
```

`auth.api.getSession()` returns `null` when no valid session exists. **Do not** assume an exception — handle both shapes.

Server-side calls via `auth.api.*` bypass rate limits.

## Reading session — client

```ts
// React
import { authClient } from "@/lib/auth-client";

function Header() {
  const { data: session, isPending, error } = authClient.useSession();
  if (isPending) return <Skeleton />;
  if (!session) return <SignInButton />;
  return <span>{session.user.email}</span>;
}

// One-shot (no reactive subscription)
const { data, error } = await authClient.getSession();
```

`useSession()` keeps internal state in sync via `BroadcastChannel` and a window-focus refetch.

## Session config

```ts
betterAuth({
  session: {
    modelName: "sessions",            // table name override
    fields: { userId: "user_id" },    // column override

    expiresIn: 60 * 60 * 24 * 7,      // absolute TTL — see recommended-defaults.md
    updateAge: 60 * 60 * 24,          // refresh-after window — see recommended-defaults.md
    disableSessionRefresh: false,     // true = never refresh

    cookieCache: {
      enabled: true,                  // 5-min cookie cache to skip DB read
      maxAge: 60 * 5,                 // see recommended-defaults.md
    },

    // Secondary storage tuning (when Redis is wired)
    storeSessionInDatabase: true,
    preserveSessionInDatabase: false,

    additionalFields: {
      tenantId: { type: "string", input: false },
    },
  },
});
```

### `cookieCache` semantics

When enabled, the session payload is signed and stored inside the same cookie. `getSession` returns from the cookie if `cookieCache.maxAge` has not elapsed — no DB hit.

Trade-off: revocation lag up to `maxAge`. Mitigations:
- Call `auth.api.revokeSession`/`revokeSessions` on sign-out, password change, role change — this rotates the cookie.
- Keep `maxAge` short (5 min default).

Never enable `cookieCache` and then read the database directly to assert revocation — the cookie still validates until expiry.

### `updateAge` semantics

A session is sliding-window refreshed when the **time since last refresh ≥ `updateAge`** AND the session is used. Default `expiresIn` 7 days, `updateAge` 1 day → an active user's session can survive indefinitely; an idle session expires after 7 days.

Set `disableSessionRefresh: true` for strict absolute-TTL behavior (compliance scenarios).

## Server-side mutations

```ts
// Sign out current session
await auth.api.signOut({ headers });

// Revoke a specific session by id
await auth.api.revokeSession({
  body: { token: session.session.token },
  headers,
});

// Revoke all sessions for current user (after password change, suspicious activity)
await auth.api.revokeSessions({ headers });

// List sessions
const sessions = await auth.api.listSessions({ headers });
```

## JWT plugin

Use when you need a bearer token for cross-service / mobile / third-party API access. The plugin issues short-lived JWTs alongside the cookie session.

```ts
import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins";

export const auth = betterAuth({
  plugins: [jwt()],
});
```

Adds:
- `GET /api/auth/token` — returns a signed JWT for the current session
- `GET /api/auth/jwks` — JWKS endpoint for downstream verification

Client:
```ts
const { data } = await authClient.getSession({ fetchOptions: { onSuccess: (ctx) => {
  // ctx.response.headers.get("set-auth-jwt")  // when configured
}}});
// or just call the token endpoint
const { token } = await fetch("/api/auth/token", { credentials: "include" }).then(r => r.json());
```

Verification on another service:
```ts
import { createRemoteJWKSet, jwtVerify } from "jose";

const JWKS = createRemoteJWKSet(new URL("https://auth.example.com/api/auth/jwks"));
const { payload } = await jwtVerify(token, JWKS);
```

JWT TTL — see [recommended-defaults.md](recommended-defaults.md). Do not raise without a refresh strategy; long-lived JWTs cannot be revoked.

## Bearer-only flows (mobile, server-to-server)

The `bearer()` plugin allows clients without cookies (native iOS/Android) to send `Authorization: Bearer <token>` and have it treated as a session.

```ts
import { bearer } from "better-auth/plugins";

export const auth = betterAuth({
  plugins: [bearer()],
});
```

Client (no cookies):
```ts
import { createAuthClient } from "better-auth/client";

export const authClient = createAuthClient({
  baseURL: "https://api.example.com",
  fetchOptions: {
    auth: { type: "Bearer", token: () => localStorage.getItem("auth-token") ?? "" },
  },
});
```

Store the token in secure native storage (Keychain / Keystore), not `localStorage`, when you can.

## Authorization patterns

Pull session once per request, then derive permissions:

```ts
const session = await auth.api.getSession({ headers });
if (!session) throw unauthorized();

// Org-scoped check (organization plugin)
const orgId = session.session.activeOrganizationId;
if (!orgId) throw new Error("No active org");

const members = await auth.api.listMembers({ query: { organizationId: orgId }, headers });
const me = members.find(m => m.userId === session.user.id);
if (me?.role !== "owner") throw forbidden();
```

Never make an authorization decision based on a client-supplied id or role.
