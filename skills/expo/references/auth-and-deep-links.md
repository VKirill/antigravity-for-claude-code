# Auth and Deep Links

Two stacks:

- **`expo-linking`** — URL parsing, programmatic open, redirect-URI builder
- **`expo-auth-session`** — OAuth flow with PKCE, opens the system browser, captures the redirect

## Scheme + universal/app links

```ts
// app.config.ts
export default {
  expo: {
    scheme: 'myapp', // myapp://
    ios: {
      bundleIdentifier: 'com.example.myapp',
      associatedDomains: ['applinks:example.com'],
    },
    android: {
      package: 'com.example.myapp',
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [{ scheme: 'https', host: 'example.com', pathPrefix: '/app' }],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
  },
};
```

For universal links to work:

- iOS: host `apple-app-site-association` JSON at `https://example.com/.well-known/apple-app-site-association` (no `.json` extension, served as `application/json`)
- Android: host `https://example.com/.well-known/assetlinks.json`

Without these files, links fall back to opening the browser.

## expo-linking basics

```ts
import * as Linking from 'expo-linking';

// Build a redirect URI matching the platform
const redirectUri = Linking.createURL('/auth/callback');
// dev: exp://192.168.0.5:8081/--/auth/callback
// prod: myapp://auth/callback

// Parse an incoming URL
const { hostname, path, queryParams } = Linking.parse('myapp://posts/42?x=1');

// Get initial URL (cold start)
const initial = await Linking.getInitialURL();

// Listen for warm-resume URLs
const sub = Linking.addEventListener('url', ({ url }) => { /* … */ });
sub.remove();
```

Expo Router handles incoming URLs automatically; manual listeners are only needed for custom routing outside the router.

## expo-auth-session with PKCE

```ts
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';

WebBrowser.maybeCompleteAuthSession(); // required at module scope on web

const discovery = {
  authorizationEndpoint: 'https://auth.example.com/oauth/authorize',
  tokenEndpoint:         'https://auth.example.com/oauth/token',
  revocationEndpoint:    'https://auth.example.com/oauth/revoke',
};

export function useSignIn() {
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'myapp', path: 'auth/callback' });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: process.env.EXPO_PUBLIC_OAUTH_CLIENT_ID!,
      scopes: ['openid', 'profile', 'email'],
      redirectUri,
      usePKCE: true,
      responseType: AuthSession.ResponseType.Code,
    },
    discovery,
  );

  useEffect(() => {
    if (response?.type !== 'success' || !request) return;
    const { code } = response.params;
    AuthSession
      .exchangeCodeAsync(
        {
          clientId: process.env.EXPO_PUBLIC_OAUTH_CLIENT_ID!,
          code,
          redirectUri,
          extraParams: { code_verifier: request.codeVerifier! },
        },
        discovery,
      )
      .then((token) => {
        // store token.accessToken / token.refreshToken securely (SecureStore)
      });
  }, [response, request]);

  return { promptAsync, ready: !!request };
}
```

Trigger the flow:

```tsx
const { promptAsync, ready } = useSignIn();
<Button title="Sign in" onPress={() => promptAsync()} disabled={!ready} />
```

Key knobs:

- `usePKCE: true` — generates a code verifier/challenge, mandatory for public clients
- `redirectUri` — must be registered with the OAuth provider
- `makeRedirectUri` returns the platform-appropriate URI (`exp://…` in Expo Go, `myapp://…` in dev/production builds)

## Provider-specific helpers

`expo-auth-session/providers/{google, apple, facebook}` wrap common flows. Example for Google:

```ts
import * as Google from 'expo-auth-session/providers/google';

const [request, response, promptAsync] = Google.useAuthRequest({
  iosClientId:     process.env.EXPO_PUBLIC_GOOGLE_IOS!,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID!,
  webClientId:     process.env.EXPO_PUBLIC_GOOGLE_WEB!,
});
```

For Sign in with Apple, use the platform-native API:

```bash
npx expo install expo-apple-authentication
```

```ts
import * as AppleAuthentication from 'expo-apple-authentication';

const credential = await AppleAuthentication.signInAsync({
  requestedScopes: [
    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
    AppleAuthentication.AppleAuthenticationScope.EMAIL,
  ],
});
```

Required when offering third-party social login on iOS (App Store guideline 4.8).

## Token storage

Never store access tokens in `AsyncStorage` (unencrypted on Android). Use `expo-secure-store`:

```ts
import * as SecureStore from 'expo-secure-store';
await SecureStore.setItemAsync('access_token', token, {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
});
```

`expo-secure-store` is backed by Keychain on iOS and EncryptedSharedPreferences on Android.

## Integrating with Better Auth

If the backend uses Better Auth, the mobile flow looks like:

1. Open `https://api.example.com/auth/sign-in/social/google` in `WebBrowser.openAuthSessionAsync`
2. Better Auth handles the OAuth dance and returns a session cookie or token
3. The redirect lands on `myapp://auth/callback?session=…`
4. Mobile exchanges/stores the session

See the `better-auth` skill for server config; this skill only covers the Expo side.

## Cold-start vs warm-resume

- **Cold start** (app launched by link): `Linking.getInitialURL()` returns the URL on first frame
- **Warm resume** (app backgrounded): subscribe with `Linking.addEventListener('url', …)`

Expo Router merges both into its navigation state automatically. For non-router screens, handle both explicitly.

Test both:

```bash
# Kill the app, then:
npx uri-scheme open myapp://posts/42 --ios

# With the app backgrounded:
npx uri-scheme open myapp://posts/42 --android
```

## Anti-patterns

- Hard-coding `redirectUri` instead of using `makeRedirectUri` — breaks across Expo Go and dev/prod builds
- Skipping `WebBrowser.maybeCompleteAuthSession()` on web — the flow never completes
- Storing tokens in `AsyncStorage` — plaintext on Android
- Forgetting `apple-app-site-association` / `assetlinks.json` — universal links fall back to browser
- Mixing `usePKCE: false` for public clients — security regression; always enable for mobile
- Forgetting `WebBrowser.dismissAuthSession()` after success on iOS — stale browser modal lingers
- Not handling `response.type === 'dismiss'` — silently leaves UI in loading state
