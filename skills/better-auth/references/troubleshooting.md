# Troubleshooting — Better Auth

Symptom-indexed. Find your user-visible failure, follow the diagnose steps, apply the fix.

---

## Session cookie is not set after sign-in (200 OK, but `getSession()` returns null)

**Symptoms**
- `signIn.email` / `signIn.social` returns success
- Network tab shows `Set-Cookie` header in the response
- Next request has no cookie attached
- `auth.api.getSession({ headers })` returns `null`

**Diagnose**
```bash
# 1. Look at the response Set-Cookie attributes in DevTools → Network
#    Expect: __Secure-better-auth.session_token=...; HttpOnly; Secure; SameSite=Lax; Path=/

# 2. Confirm browser is loading over HTTPS in prod (cookie with Secure won't stick on HTTP)
# 3. Confirm BETTER_AUTH_URL matches the public origin exactly (no trailing slash)
echo $BETTER_AUTH_URL
```

**Common causes**
- Frontend on `http://localhost:5173`, API on `https://api.dev.example.com` → cross-site cookie without `sameSite: "none"` + `secure: true` + `partitioned: true`
- Reverse proxy strips `Set-Cookie` (rare; check Angie `proxy_pass_header`)
- `fetch()` from client without `credentials: "include"` (`createAuthClient` does this for you — manual `fetch` won't)
- Body parser ran before `auth.handler` in Express/Fastify, consumed the stream → handler returned 200 with empty body and no cookie

**Fix**
```ts
betterAuth({
  advanced: {
    defaultCookieAttributes: { sameSite: "none", secure: true, partitioned: true },
  },
  trustedOrigins: ["http://localhost:5173", "https://app.example.com"],
});
```

Manual fetch needs:
```ts
fetch("/api/auth/...", { credentials: "include" });
```

---

## `403 Invalid origin` on every state-changing request

**Symptoms**
- `POST /api/auth/sign-in/email` → 403
- Error body: `{ "error": "Invalid origin" }`
- Cookie may already be set but new requests are rejected

**Diagnose**
```bash
# Check the Origin header the browser is sending
curl -i -X POST https://api.example.com/api/auth/sign-in/email \
  -H "Origin: https://app.example.com" \
  -H "Content-Type: application/json" \
  -d '{"email":"x","password":"y"}'
```

**Common causes**
- `trustedOrigins` does not include the current page's origin
- Preview deploy on `*.vercel.app` — origin changes per deploy
- Mobile WebView sending `Origin: null`
- Custom domain configured but `BETTER_AUTH_URL` still points to vercel.app

**Fix**
```ts
betterAuth({
  trustedOrigins: [
    "https://app.example.com",
    "https://*.vercel.app",       // preview deploys
    // For native WebViews, consider a dedicated bearer flow instead of relaxing CSRF
  ],
});
```

Never set `trustedOrigins: ["*"]`.

---

## OAuth callback fails with `redirect_uri_mismatch`

**Symptoms**
- User clicks "Sign in with Google" → bounces to Google → red error page
- "The redirect URI in the request, http://..., does not match the ones authorized for the OAuth client"

**Diagnose**
1. Read the exact URI from Google's error page
2. Compare to what's registered in Google Cloud Console → Credentials → OAuth client

**Common causes**
- Localhost: registered `http://localhost:3000/api/auth/callback/google`, app running on `:3001`
- Preview deploy mismatch (every Vercel preview is a new URL)
- Trailing slash difference
- `BETTER_AUTH_URL` env var set wrong → Better Auth generates the wrong `redirect_uri`

**Fix**
1. Set `BETTER_AUTH_URL` correctly per environment
2. Register **every** environment's callback URI in the provider console
3. For Vercel previews: either pin a single staging URL, or use a wildcard if the provider supports it (Google does not; GitHub does)

---

## "Session not found" after restart / deploy

**Symptoms**
- Users were signed in, deploy happened, now everyone is signed out
- `auth.api.getSession` returns `null` even with a fresh cookie

**Common causes**
- `BETTER_AUTH_SECRET` rotated (intentionally or accidentally — e.g., different env in prod vs preview)
- Secondary storage (Redis) flushed
- Database session table truncated (migration `--reset`)

**Fix**
- Confirm `BETTER_AUTH_SECRET` is identical across **every** running instance (PM2 cluster, K8s replicas)
- Pin the secret in your secrets manager, never re-roll without coordinated rollout

```bash
# On every host:
echo -n "$BETTER_AUTH_SECRET" | sha256sum
# all hosts must show the same hash
```

---

## Schema drift — "column does not exist" / "relation does not exist"

**Symptoms**
- Worked locally, fails on staging/prod
- Error from the DB adapter: `column "twoFactorEnabled" of relation "user" does not exist`
- Started a new plugin (2FA, organization, passkey) and now sign-in fails

**Diagnose**
```bash
# Generate fresh schema based on current betterAuth() config
npx @better-auth/cli generate --print  # or --output
# Diff against your migration history
```

**Common causes**
- Added a plugin to `betterAuth({ plugins: [...] })` without re-running `generate` + migrating
- Drizzle/Prisma migration generated in dev, not pushed to prod
- Two services share a DB but run different Better Auth versions

**Fix**
```bash
# 1. Update betterAuth() config to match production
# 2. Generate the schema
npx @better-auth/cli generate

# Prisma:
npx prisma migrate dev --name add_<plugin>
npx prisma migrate deploy  # in CI

# Drizzle:
npx drizzle-kit generate
npx drizzle-kit migrate

# Built-in Kysely:
npx @better-auth/cli migrate
```

Pin matching `better-auth` versions across all services.

---

## CORS error in the browser console

**Symptoms**
- `Access to fetch at 'https://api.example.com/api/auth/...' from origin 'https://app.example.com' has been blocked by CORS policy`
- The auth handler never even runs

**Common causes**
- Cross-origin frontend ↔ API without CORS middleware
- Better Auth handles **CSRF**, not CORS — CORS headers come from your framework's middleware

**Fix (Hono)**
```ts
import { cors } from "hono/cors";

app.use("/api/auth/*", cors({
  origin: ["https://app.example.com"],
  credentials: true,
  allowMethods: ["POST", "GET", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
}));
```

**Fix (Fastify)** — install `@fastify/cors` with `credentials: true`.

The Origin in CORS allow-list and `trustedOrigins` should match — keep them in one constant.

---

## `requireEmailVerification: true` but user can't sign in even after clicking the link

**Symptoms**
- User signs up, receives verification email, clicks link
- Sign-in still rejected with "Email not verified"

**Diagnose**
```sql
SELECT email, emailVerified FROM "user" WHERE email = 'jane@example.com';
```

**Common causes**
- Verification handler ran on the wrong domain (link points to dev, user clicked from prod)
- Token expired before click (`emailVerification.expiresIn` too short)
- Custom `sendVerificationEmail` callback embedded the wrong `url`

**Fix**
- Use the exact `url` parameter passed to `sendVerificationEmail` — don't reconstruct it
- Set `emailVerification.expiresIn: 60 * 60` (1h) minimum
- Set `autoSignInAfterVerification: true` so the click completes the flow

---

## Rate limit error in dev (`Too many requests`)

**Symptoms**
- Local development hits rate limit unexpectedly
- 429 responses during normal testing

**Common causes**
- HMR / fast refresh fires repeated `useSession()` calls
- Rate limit storage = `"memory"` and survives Vite/Next dev reloads

**Fix**
```ts
betterAuth({
  rateLimit: {
    enabled: process.env.NODE_ENV === "production",
  },
});
```

(Rate limit is **off in dev by default** — but a custom `enabled: true` overrides that.)

---

## Cross-subdomain cookie issues (`app.example.com` ↔ `api.example.com`)

**Symptoms**
- Sign-in works on the API origin
- App on `app.example.com` calls API and `getSession()` returns null
- Cookie visible in DevTools on `api.example.com` but not sent on cross-domain XHR

**Fix**
```ts
betterAuth({
  advanced: {
    crossSubDomainCookies: {
      enabled: true,
      domain: ".example.com",   // leading dot — shared across subdomains
    },
  },
  trustedOrigins: [
    "https://app.example.com",
    "https://api.example.com",
  ],
});
```

Client side: ensure `fetch` uses `credentials: "include"` (the auto-client does).

---

## Prisma adapter — "Cannot find module '@prisma/client'"

**Symptoms**
- Build succeeds locally
- Production / Docker build fails to find `@prisma/client`

**Common causes**
- Prisma v7 places generated client in user-specified directory; import path mismatch
- `npx prisma generate` did not run in CI
- Docker multi-stage: generated client not copied to runner stage

**Fix**
```dockerfile
RUN npx prisma generate
# Copy the generated client output into the runner stage
COPY --from=build /app/generated /app/generated
```

See [prisma](../../prisma/SKILL.md) skill for v7 specifics.

---

## Magic link / OTP emails never arrive

**Symptoms**
- `signIn.magicLink` returns success
- No email in inbox (or spam)

**Diagnose**
- Add console.log inside `sendMagicLink` — is it running?
- Check email provider logs (Resend / SES / Mailgun) for bounces or rate caps

**Common causes**
- `sendMagicLink` callback throws but is swallowed
- Email provider's per-recipient rate limit
- DKIM/SPF misconfigured → bulk providers (Gmail) silently drop
- Token URL got line-broken in email template

**Fix**
- Wrap `sendMagicLink` body in try/catch + log
- Send via a queued worker (BullMQ) so failures are retried + observable
- Use plain-text fallback alongside HTML
