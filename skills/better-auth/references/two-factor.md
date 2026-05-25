# Two-factor (TOTP + backup codes + OTP fallback)

The `twoFactor()` plugin enables time-based one-time passwords (TOTP), backup codes, and an email/SMS OTP fallback.

## Server

```ts
import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";

export const auth = betterAuth({
  appName: "My App",                   // shown in Authenticator app names
  plugins: [
    twoFactor({
      issuer: "MyApp",                 // alternative to appName
      // totpOptions: { period: 30, digits: 6 },  // defaults — RFC 6238
      // backupCodes: { length: 10 },             // default 10
      otpOptions: {
        async sendOTP({ user, otp }, request) {
          await sendEmail({
            to: user.email,
            subject: "Your sign-in code",
            text: `Code: ${otp}`,
          });
        },
        period: 5 * 60,                // 5 min — see recommended-defaults.md
      },
    }),
  ],
});
```

Database: adds a `twoFactor` row per user with secret (encrypted) and backup codes (hashed).

## Client

```ts
import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [
    twoFactorClient({
      twoFactorPage: "/two-factor",    // your verification page
    }),
  ],
});
```

When `signIn.email` returns a session-pending response with `twoFactorRedirect: true`, the client redirects to `twoFactorPage`.

## Enable / disable flow

```ts
// 1. User clicks "Enable 2FA" in settings → server returns TOTP URI + backup codes
const { data, error } = await authClient.twoFactor.enable({ password: "current-password" });
// data: { totpURI: "otpauth://totp/...", backupCodes: ["abc123", ...] }

// 2. Render the TOTP URI as a QR code (e.g. qrcode.react)
// 3. User scans with Authy/1Password/Google Authenticator
// 4. Confirm by submitting a code
await authClient.twoFactor.verifyTOTP({ code: "123456" });
// → 2FA is now active

// Disable
await authClient.twoFactor.disable({ password: "current-password" });
```

Show the backup codes **once**, immediately after enable. Persist them in a downloadable file or print-friendly view; do not store them in localStorage.

## Sign-in flow

```ts
// Step 1: normal email sign-in
const result = await authClient.signIn.email({ email, password });

if (result.data?.twoFactorRedirect) {
  // User has 2FA enabled → redirect to your verification page
  router.push("/two-factor");
}
```

On `/two-factor`:

```tsx
// TOTP path
async function submitTOTP(code: string) {
  const { data, error } = await authClient.twoFactor.verifyTOTP({
    code,
    trustDevice: true,   // 60-day trusted-device cookie — skip 2FA next time
  });
  if (data) router.push("/dashboard");
}

// Backup-code path (lost authenticator)
async function submitBackupCode(code: string) {
  await authClient.twoFactor.verifyBackupCode({ code });
}

// Email/SMS OTP fallback
async function sendOtp() {
  await authClient.twoFactor.sendOtp();  // triggers otpOptions.sendOTP
}
async function submitOtp(code: string) {
  await authClient.twoFactor.verifyOtp({ code });
}
```

## Trusted device

`trustDevice: true` on a successful TOTP verification sets a long-lived `__Secure-better-auth.trusted-device` cookie scoped to the current `userId`. Future sign-ins on that browser skip the 2FA step.

Revoke from settings:
```ts
await authClient.twoFactor.revokeAllTrustedDevices();
```

Trusted device cookies are user-scoped — signing in as a different user does not inherit the trust.

## Backup codes

- Default count: 10
- Each code is single-use, hashed at rest
- Regenerate after a code is consumed or if leaked:

```ts
const { data } = await authClient.twoFactor.generateBackupCodes({ password });
// data.backupCodes: string[]
```

## Rate limiting 2FA

Sign-in / verify-TOTP / verify-OTP endpoints need strict rate limits to prevent brute force. See [security.md](security.md) §"Rate limiting" and [recommended-defaults.md](recommended-defaults.md).

Recommended pattern:

```ts
betterAuth({
  plugins: [twoFactor({ /* ... */ })],
  rateLimit: {
    customRules: {
      "/two-factor/verify-totp": { window: 60, max: 5 },
      "/two-factor/verify-otp":  { window: 60, max: 5 },
      "/two-factor/verify-backup-code": { window: 60, max: 5 },
    },
  },
});
```

## Anti-patterns

- ❌ Sending TOTP secret over email — defeats the purpose; only the `totpURI` (which contains the secret) goes to the user once, via the authenticated session response
- ❌ Logging the TOTP code on the server — appears in log aggregators
- ❌ Skipping `trustDevice` revocation on password change — a stolen "remember device" cookie outlives the credential rotation
- ❌ Storing backup codes in plain text — they must be hashed (Better Auth does this automatically; don't bypass)
