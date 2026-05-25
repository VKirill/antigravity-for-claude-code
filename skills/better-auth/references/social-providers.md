# Social providers

OAuth 2.0 / OIDC providers configured on the server, triggered by `authClient.signIn.social({ provider })` on the client.

## Supported providers

Built-in: `google`, `github`, `discord`, `apple`, `microsoft`, `twitter`, `facebook`, `linkedin`, `spotify`, `twitch`, `tiktok`, `dropbox`, `gitlab`, `reddit`, `roblox`, `vk`, `kakao`, `kick`, `zoom`, and more (30+). Use the `genericOAuth()` plugin for any other OIDC provider.

## Server config

```ts
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // optional
      scope: ["email", "profile"],
      disableDefaultScope: false,           // true = use only `scope` above
      prompt: "select_account",             // OIDC prompt param
      accessType: "offline",                // Google: include refresh_token
      redirectURI: "https://example.com/api/auth/callback/google", // override (rare)
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      scope: ["user:email", "read:user"],
    },
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      scope: ["identify", "email"],
    },
    apple: {
      clientId: process.env.APPLE_CLIENT_ID!,        // service ID (com.example.web)
      clientSecret: process.env.APPLE_CLIENT_SECRET!, // pre-generated client secret JWT
      // Apple posts to redirect URI via form_post — must allow POST on /api/auth/callback/apple
    },
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      tenantId: "common",                  // "common" | "organizations" | "<tenant-uuid>"
      scope: ["openid", "profile", "email"],
    },
  },
});
```

## Default callback URL

```
{BETTER_AUTH_URL}/api/auth/callback/{provider}
```

Register **exactly** this URL in every OAuth provider's console. Mismatches surface as opaque "redirect_uri_mismatch" errors.

Common URLs per environment:
- Local: `http://localhost:3000/api/auth/callback/google`
- Preview (Vercel): `https://<preview>.vercel.app/api/auth/callback/google` — register a wildcard / multi-URI if the provider allows
- Production: `https://app.example.com/api/auth/callback/google`

## Client trigger

```ts
import { authClient } from "@/lib/auth-client";

await authClient.signIn.social({
  provider: "github",
  callbackURL: "/dashboard",
  errorCallbackURL: "/sign-in?error=oauth",
  newUserCallbackURL: "/welcome",  // first-time user only
  disableRedirect: false,           // true → returns { url } instead of redirecting
});
```

`callbackURL` is **relative** to `baseURL`. Better Auth validates it against `trustedOrigins` — open-redirect protection.

## Provider-specific notes

### Google
- Use the **OAuth Web client** type, not Android/iOS.
- For refresh tokens: `accessType: "offline"` + `prompt: "consent"`.
- Default scopes: `openid email profile`.

### GitHub
- Set the "Authorization callback URL" to `{BETTER_AUTH_URL}/api/auth/callback/github`.
- To get email when user has private email: scope `user:email`.

### Apple
- Apple uses `form_post` response mode — the callback is **POST**, not GET. Make sure your reverse proxy / framework allows POST to the callback URL.
- Client secret is a JWT signed with the AuthKey `.p8` file, valid for ≤ 6 months. Regenerate before expiry.

### Microsoft
- `tenantId: "common"` for both personal + work accounts; `"organizations"` for work only; specific UUID for single tenant.

### Discord
- Discord scopes `identify` and `email` are minimum. Add `guilds` for membership.

## Account linking

When a user signs in with email/password and later signs in with GitHub using the same email:

```ts
betterAuth({
  account: {
    accountLinking: {
      enabled: true,                          // default false
      trustedProviders: ["google", "github"], // only auto-link if email is verified by these
    },
  },
});
```

Without explicit `trustedProviders`, linking is rejected to prevent account-takeover via unverified email.

## Custom OIDC provider (`genericOAuth`)

```ts
import { genericOAuth } from "better-auth/plugins";

betterAuth({
  plugins: [
    genericOAuth({
      config: [
        {
          providerId: "auth0",
          discoveryUrl: "https://example.auth0.com/.well-known/openid-configuration",
          clientId: process.env.AUTH0_CLIENT_ID!,
          clientSecret: process.env.AUTH0_CLIENT_SECRET!,
          scopes: ["openid", "profile", "email"],
          // mapProfileToUser?: (profile) => ({ email, name, image })
        },
      ],
    }),
  ],
});
```

Client:
```ts
await authClient.signIn.oauth2({
  providerId: "auth0",
  callbackURL: "/dashboard",
});
```

## Errors users will hit

| Error | Likely cause |
|---|---|
| `redirect_uri_mismatch` | Callback URL in provider console ≠ `{BETTER_AUTH_URL}/api/auth/callback/{provider}` |
| `invalid_client` | `clientId` / `clientSecret` mismatch, or wrong env (dev vs prod app) |
| `access_denied` | User clicked "Cancel" on the provider's consent screen |
| `invalid_state` | Cookie blocked (Safari ITP, third-party cookie), or trip across domains without `sameSite: "none"` |
| `Invalid origin` | `callbackURL` not in `trustedOrigins` (open-redirect guard) |

See [troubleshooting.md](troubleshooting.md) for symptom-indexed diagnoses.
