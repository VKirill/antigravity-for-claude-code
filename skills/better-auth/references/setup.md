# Setup — install, env, handler

End-to-end install, environment, and framework handler mounting. Numeric defaults live in [recommended-defaults.md](recommended-defaults.md).

## Install

```bash
npm install better-auth
# CLI for schema generation / migrations
npm install -D @better-auth/cli
```

Pin matching versions for `better-auth` and `@better-auth/cli` — peer-dep drift silently breaks the generated schema.

## Environment variables

```bash
# .env
BETTER_AUTH_SECRET="<≥32-char-random-string>"   # openssl rand -base64 32
BETTER_AUTH_URL="https://app.example.com"        # public base URL (HTTPS in prod)
DATABASE_URL="postgres://..."                    # adapter-specific
```

- `BETTER_AUTH_SECRET` — signs session tokens. Rotation invalidates all sessions. Must be ≥32 bytes.
- `BETTER_AUTH_URL` — used to build callback URLs and as the default `baseURL` for `createAuthClient`.
- Both are **server-only**. Never expose to client bundle.

## Server instance — `auth.ts` / `lib/auth.ts`

```ts
// lib/auth.ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  // public origin (defaults to BETTER_AUTH_URL)
  baseURL: process.env.BETTER_AUTH_URL,

  // CSRF allow-list — never "*"
  trustedOrigins: [
    "https://app.example.com",
    "https://*.example.com", // single-level wildcard
  ],

  emailAndPassword: { enabled: true },

  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
});
```

`betterAuth()` returns an object with at minimum:

- `handler(request: Request): Promise<Response>` — Web-Standards request handler
- `api` — server-side typed API surface (`auth.api.getSession`, `auth.api.signInEmail`, etc.)
- `$Infer` — type helpers
- `options` — resolved config (useful for plugin authors)

## Client instance — `lib/auth-client.ts`

```ts
// React
import { createAuthClient } from "better-auth/react";
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL, // optional; defaults to current origin
});

// Vanilla
import { createAuthClient as createVanillaClient } from "better-auth/client";
export const authClient2 = createVanillaClient();
```

Framework variants: `better-auth/react`, `better-auth/vue`, `better-auth/svelte`, `better-auth/solid`, `better-auth/client` (vanilla).

## Framework handlers

### Next.js App Router

```ts
// app/api/auth/[...all]/route.ts
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { POST, GET } = toNextJsHandler(auth);
```

Read session in a Server Component:

```ts
// app/dashboard/page.tsx
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  return <div>Hello {session.user.email}</div>;
}
```

### Hono

```ts
import { Hono } from "hono";
import { auth } from "./auth";

const app = new Hono();
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));
```

`c.req.raw` is the underlying `Request`. Works on Workers, Bun, Node (via `@hono/node-server`).

### Fastify (Node)

```ts
import Fastify from "fastify";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth";

const app = Fastify();

// Mount as a generic Node handler under /api/auth/*
app.all("/api/auth/*", async (request, reply) => {
  await toNodeHandler(auth)(request.raw, reply.raw);
  return reply;
});

// IMPORTANT: disable Fastify's body parsing for the auth route —
// Better Auth expects the raw stream
app.addContentTypeParser("*", (_req, _payload, done) => done(null));
```

### Express

```ts
import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth";

const app = express();
// MUST be before any body parser
app.all("/api/auth/*", toNodeHandler(auth));
app.use(express.json()); // safe to add after
```

### Nuxt (Nitro)

```ts
// server/api/auth/[...all].ts
import { auth } from "~/utils/auth";
export default defineEventHandler((event) => auth.handler(toWebRequest(event)));
```

### SvelteKit

```ts
// src/hooks.server.ts
import { svelteKitHandler } from "better-auth/svelte-kit";
import { building } from "$app/environment";
import { auth } from "$lib/auth";

export async function handle({ event, resolve }) {
  return svelteKitHandler({ event, resolve, auth, building });
}
```

### Cloudflare Workers

```ts
import { auth } from "./auth";

export default {
  async fetch(request: Request) {
    if (new URL(request.url).pathname.startsWith("/api/auth")) {
      return auth.handler(request);
    }
    return new Response("Not found", { status: 404 });
  },
};
```

Pair with a driver-adapter Prisma client or D1 (`betterAuth({ database: ... })`) so the bundle does not pull Kysely's Node-only drivers.

## Schema generation / first migration

After defining `betterAuth({...})` (including plugins), run the CLI to generate the SQL / ORM schema:

```bash
# Generate the schema (writes to your ORM's schema file or prints raw SQL)
npx @better-auth/cli generate

# Apply via the chosen ORM's migrator
# Prisma: prisma migrate dev --name better_auth_init
# Drizzle: drizzle-kit push
# Kysely (built-in): npx @better-auth/cli migrate
```

When you add a plugin (e.g. `twoFactor()`, `organization()`) the schema changes — re-run `generate` and migrate.

## Sanity check

```bash
# Health probe (server running)
curl -i "$BETTER_AUTH_URL/api/auth/ok"
# → 200 {"ok": true}
```

## When to use `better-auth/minimal`

Tree-shaken entry — excludes Kysely. Use it when you ship to edge runtimes (Workers) and rely on a custom adapter (Prisma/Drizzle/MongoDB). Does not support direct `Pool` / `Database` instances.

```ts
import { betterAuth } from "better-auth/minimal";
import { prismaAdapter } from "better-auth/adapters/prisma";
// ...
```

## Common setup gotchas

- Fastify / Express — body parsers consume the request stream before Better Auth sees it. Disable for `/api/auth/*` or mount the auth route first.
- Vercel preview deployments — each preview gets a new origin. Use a wildcard in `trustedOrigins` (`https://*.vercel.app`) or skip CSRF in preview only.
- Same-site cookies across `app.example.com` and `api.example.com` need `advanced.crossSubDomainCookies` — see [security.md](security.md).
