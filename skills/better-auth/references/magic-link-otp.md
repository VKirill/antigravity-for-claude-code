# Magic link + email OTP

Two passwordless flows. Pick one (or both) based on UX:

- **Magic link** — user enters email, clicks a link in their inbox, is signed in.
- **Email OTP** — user enters email, types a 6-digit code from their inbox.

OTP plays better on mobile and across email clients that rewrite URLs (Outlook safelinks). Magic link feels slicker on desktop.

## Magic link

### Server

```ts
import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";

export const auth = betterAuth({
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url, token }, request) => {
        await sendEmail({
          to: email,
          subject: "Sign in to MyApp",
          html: `<p>Click <a href="${url}">here</a> to sign in. Expires in 5 minutes.</p>`,
        });
      },
      expiresIn: 5 * 60,             // 5 min — see recommended-defaults.md
      disableSignUp: false,           // true = only existing users
    }),
  ],
});
```

### Client

```ts
import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [magicLinkClient()],
});

// Trigger
const { data, error } = await authClient.signIn.magicLink({
  email: "jane@example.com",
  callbackURL: "/dashboard",
  newUserCallbackURL: "/welcome",
});
// User receives email → clicks → automatically signed in
```

### Link verification (manual page)

By default the link points to `{BETTER_AUTH_URL}/api/auth/magic-link/verify?token=...&callbackURL=/dashboard` — Better Auth handles it. If you want a custom landing page, point the link there and call:

```ts
await authClient.magicLink.verify({ query: { token } });
```

## Email OTP

### Server

```ts
import { emailOTP } from "better-auth/plugins";

export const auth = betterAuth({
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        const subject = {
          "sign-in":           "Your sign-in code",
          "email-verification": "Verify your email",
          "forget-password":   "Your password reset code",
        }[type];
        await sendEmail({ to: email, subject, text: `Code: ${otp}` });
      },
      expiresIn: 5 * 60,              // 5 min — see recommended-defaults.md
      otpLength: 6,                    // default 6
      allowedAttempts: 5,              // default 5 — lockout after exceed
      disableSignUp: false,
    }),
  ],
});
```

The `type` discriminator lets you reuse the OTP infrastructure for sign-in, email verification, and password reset with one transport.

### Client

```ts
import { emailOTPClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [emailOTPClient()],
});

// Step 1: request code
await authClient.emailOtp.sendVerificationOtp({
  email: "jane@example.com",
  type: "sign-in",   // or "email-verification" / "forget-password"
});

// Step 2: verify code (sign-in)
await authClient.signIn.emailOtp({
  email: "jane@example.com",
  otp: "123456",
});

// Email verification flow
await authClient.emailOtp.verifyEmail({
  email: "jane@example.com",
  otp: "123456",
});

// Password reset via OTP
await authClient.emailOtp.checkVerificationOtp({
  email: "jane@example.com",
  otp: "123456",
  type: "forget-password",
});
// then resetPassword with returned token
```

## Rate-limit hardening (BOTH flows)

These endpoints are abuse vectors — both for spamming the victim's inbox and for credential stuffing. The default global rate limit (`100 / 60s`) is insufficient.

```ts
betterAuth({
  plugins: [magicLink({ /* ... */ }), emailOTP({ /* ... */ })],
  rateLimit: {
    customRules: {
      // outgoing email — strict per-IP
      "/sign-in/magic-link":    { window: 60, max: 3 },
      "/email-otp/send-verification-otp": { window: 60, max: 3 },

      // verification — strict to slow brute force
      "/email-otp/verify-email":     { window: 60, max: 5 },
      "/sign-in/email-otp":          { window: 60, max: 5 },
    },
  },
});
```

Numbers — see [recommended-defaults.md](recommended-defaults.md). Pair with a per-email rate limit at your email provider level (SES, Resend) to prevent reputation damage if attacker rotates IPs.

## Anti-patterns

- ❌ `expiresIn: 24 * 60 * 60` — magic links should live minutes, not hours. Long TTL = wider replay window.
- ❌ Re-using the same link multiple times — Better Auth invalidates on first use; do not change this.
- ❌ Embedding the magic link URL inside an HTML email **without** a plain-text version — corporate spam filters that rewrite links can break the token.
- ❌ Sending magic link / OTP without any rate limit — instant abuse vector.
- ❌ Returning "email not found" from `sendVerificationOtp` — enumeration leak.
