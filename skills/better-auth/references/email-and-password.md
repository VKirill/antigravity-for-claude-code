# Email + password

Built-in credential flow: sign-up, sign-in, email verification, password reset. Disabled by default.

Numeric defaults (password length, TTLs) — see [recommended-defaults.md](recommended-defaults.md).

## Enable

```ts
betterAuth({
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,         // default 8 — see recommended-defaults.md
    maxPasswordLength: 128,       // default 128
    autoSignIn: true,             // default true — sign in immediately after sign-up
    requireEmailVerification: true, // block sign-in until verified

    sendResetPassword: async ({ user, url, token }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your password",
        html: `<p>Click <a href="${url}">here</a> to reset your password.</p>`,
      });
    },

    revokeSessionsOnPasswordReset: true,
  },

  emailVerification: {
    sendVerificationEmail: async ({ user, url, token }) => {
      await sendEmail({
        to: user.email,
        subject: "Verify your email",
        html: `<p>Verify: <a href="${url}">${url}</a></p>`,
      });
    },
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60,            // 1h — see recommended-defaults.md
  },
});
```

**Do not `await` your email provider directly inside the callback** if it has variable latency — it leaks timing signal to attackers probing email enumeration. Enqueue via [bullmq](../../bullmq/SKILL.md) or fire-and-forget.

## Client API

```ts
import { authClient } from "@/lib/auth-client";

// Sign up
const { data, error } = await authClient.signUp.email({
  email: "jane@example.com",
  password: "S3cure!P4ss",
  name: "Jane",
  image: "https://example.com/avatar.png",
  callbackURL: "/dashboard",
});

// Sign in
await authClient.signIn.email({
  email: "jane@example.com",
  password: "S3cure!P4ss",
  rememberMe: true,                 // false = session-only cookie
  callbackURL: "/dashboard",
});

// Request password reset
await authClient.requestPasswordReset({
  email: "jane@example.com",
  redirectTo: "/reset-password",    // the page that will read ?token=
});

// Reset password (on /reset-password page)
const token = new URLSearchParams(location.search).get("token")!;
await authClient.resetPassword({
  newPassword: "N3w!Secret",
  token,
});

// Verify email (link click → /verify-email?token=)
await authClient.verifyEmail({ query: { token } });

// Re-send verification
await authClient.sendVerificationEmail({
  email: "jane@example.com",
  callbackURL: "/dashboard",
});

// Change password (signed-in user)
await authClient.changePassword({
  currentPassword: "S3cure!P4ss",
  newPassword: "Even!Stronger1",
  revokeOtherSessions: true,
});
```

## Server API equivalents

```ts
await auth.api.signUpEmail({ body: { email, password, name }, headers });
await auth.api.signInEmail({ body: { email, password }, headers });
await auth.api.requestPasswordReset({ body: { email, redirectTo } });
await auth.api.resetPassword({ body: { newPassword, token } });
await auth.api.sendVerificationEmail({ body: { email, callbackURL } });
```

## Email enumeration protection

By default, `requestPasswordReset` returns `200 OK` whether the email exists or not. Do not log a distinguishing error to the client. Apply the same on sign-up: never expose "email already registered" beyond the registration form's own response.

If you must reveal registration state (legitimate UX), gate it behind a CAPTCHA + per-IP rate limit.

## Password hashing — custom

Defaults are **scrypt** (memory-hard, OWASP-blessed). Override only when migrating from another system:

```ts
import { argon2id } from "@node-rs/argon2";

betterAuth({
  emailAndPassword: {
    enabled: true,
    password: {
      hash: async (password) => argon2id.hash(password),
      verify: async ({ password, hash }) => argon2id.verify(hash, password),
    },
  },
});
```

If migrating from `bcrypt`, keep the bcrypt `verify` path so existing users can sign in, and **rehash on successful sign-in** to migrate gradually:

```ts
verify: async ({ password, hash }) => {
  if (hash.startsWith("$2a$") || hash.startsWith("$2b$")) {
    return bcrypt.compare(password, hash); // legacy
  }
  return scryptVerify(password, hash);
},
```

(Implement re-hash in an `onSuccess` callback — Better Auth exposes hooks for this.)

## `username` plugin (optional)

When you want a username **in addition** to email — useful for display handles.

```ts
import { username } from "better-auth/plugins";
betterAuth({ plugins: [username()] });
```

Adds `username` column on `user` (unique, case-insensitive). Sign-in still uses email by default; `authClient.signIn.username({ username, password })` is added.

Do **not** use this to replace email — Better Auth's flows (verification, reset) require an email anchor.

## Anti-patterns

- ❌ Skipping `requireEmailVerification` for a flow that mints sessions purely from the email field — enables account takeover via typo'd registration
- ❌ Returning detailed errors from `signInEmail` ("password incorrect" vs "user not found") — enumeration
- ❌ `minPasswordLength: 6` — below OWASP ASVS L1; default is 8, prefer 10+
- ❌ Re-using `BETTER_AUTH_SECRET` across environments — leaking dev secret breaks prod
