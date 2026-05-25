# MAX Bridge vs VK Bridge — Side-by-Side

For teams supporting both VK Mini Apps and MAX mini-apps (a common RU-market combo). Cross-link: see the [`vk-bridge`](../../vk-bridge/SKILL.md) skill for VK platform deep-dive.

## High-level model differences

| Aspect | MAX Bridge | VK Bridge |
|---|---|---|
| Library distribution | CDN-only (`https://st.max.ru/js/max-web-app.js`) | npm `@vkontakte/vk-bridge` (also CDN) |
| Global namespace | `window.WebApp.*` (object surface) | `bridge.send(method, params)` (event-bus) |
| Method-call shape | Direct method invocation returning `Promise` | String method names sent through `send()` |
| Initialization | None at top level (`BiometricManager` and `NfcManager` require `init()`) | `bridge.send('VKWebAppInit')` recommended |
| Init-data location | `window.WebApp.initData` (already extracted) | URL query string (parse via `parseURLSearchParamsForGetLaunchParams`) |
| Signature constant | `"WebAppData"` | `vk_app_id`-based; sign over query params |
| Signature input encoding | URL-decoded `key=value` joined by `\n` | URL params joined by `&`, alphabetical |
| Where the bot/app secret lives | Bot token | App «защищённый ключ» (Service Token / Secret) |
| Native button surface | `BackButton` only | `BackButton` (on iOS context only), no MainButton equivalent |
| Storage | `DeviceStorage` (k/v) + `SecureStorage` (10 keys, encrypted) | `VKWebAppStorageGet`/`Set`/`GetKeys` (server-stored, multi-device) |
| Biometry | `BiometricManager` (iOS/Android) | None (use SaaS biometric provider) |
| NFC | `NfcManager.emulateNfcTag` (Android only) | None |
| Native share | `shareContent` (iOS/Android) + `shareMaxContent` (inside MAX) | `VKWebAppShare` (link only) + `VKWebAppShowStoryBox` |
| Payments | NOT documented as of fetch date | `VKWebAppOpenPayForm` with `action`: `pay-to-user`, `pay-to-service`, `pay-to-group`, `transfer` |
| Theme params / dark mode | NOT documented | `bridge.send('VKWebAppGetConfig')` → `appearance`, `scheme`, header colours |
| Viewport / safe-area events | NOT documented | `VKWebAppResizeWindow`, `viewport_changed` event |

> «NOT documented» = not present in upstream MAX docs as of 2026-05-16. Do not assume parity.

## Method mapping table (best-effort equivalents)

| Need | MAX | VK Bridge |
|---|---|---|
| Get init data (raw) | `window.WebApp.initData` | `Object.fromEntries(new URLSearchParams(location.search))` |
| Get init data (object, UNSAFE) | `window.WebApp.initDataUnsafe` | Same — parse `location.search` (unsafe without `sign` check) |
| Get user profile | (from validated `initData.user`) | `bridge.send('VKWebAppGetUserInfo')` |
| Get auth token | (none — bot token signs every initData) | `bridge.send('VKWebAppGetAuthToken', { app_id, scope })` |
| Request phone | `requestContact()` | `bridge.send('VKWebAppGetPhoneNumber')` |
| Request email | (none) | `bridge.send('VKWebAppGetEmail')` |
| Geolocation | (none) | `bridge.send('VKWebAppGetGeodata')` |
| Open external link | `openLink(url)` | `bridge.send('VKWebAppOpenWallPostBox')` (limited) — or `window.open` |
| Open in-app deep link | `openMaxLink('https://max.ru/...')` | `bridge.send('VKWebAppOpenApp', { app_id, ... })` |
| Native share | `shareContent({ text, link })` | `bridge.send('VKWebAppShare', { link })` |
| Share into a chat | `shareMaxContent({ mid, chatType })` | `bridge.send('VKWebAppShowWallPostBox', ...)` or attachment box |
| Story share | (none) | `bridge.send('VKWebAppShowStoryBox', ...)` |
| Open QR scanner | `openCodeReader(fileSelect)` | `bridge.send('VKWebAppOpenCodeReader')` |
| K/V storage on device | `DeviceStorage.setItem/getItem` | `bridge.send('VKWebAppStorageSet', { key, value })` (server-stored) |
| Secure encrypted storage | `SecureStorage.*` (10 keys) | None — use server-side encryption |
| Biometry init | `BiometricManager.init()` | None |
| Biometry authenticate | `BiometricManager.authenticate(reason)` | None |
| NFC tag emulation | `NfcManager.emulateNfcTag(data)` | None |
| Back button visibility | `BackButton.show/hide` | iOS-only via `VKWebAppSetSwipeSettings` (limited) |
| Back button click hook | `BackButton.onClick(cb)` | Listen to `VKWebAppViewHide` / browser `popstate` |
| Haptic — impact | `HapticFeedback.impactOccurred('light')` | `bridge.send('VKWebAppTapticImpactOccurred', { style: 'light' })` |
| Haptic — notification | `HapticFeedback.notificationOccurred('success')` | `bridge.send('VKWebAppTapticNotificationOccurred', { type })` |
| Haptic — selection | `HapticFeedback.selectionChanged()` | `bridge.send('VKWebAppTapticSelectionChanged')` |
| Brightness control | `requestScreenMaxBrightness()` | None |
| Screen capture toggle | `ScreenCapture.enableScreenCapture()` | None directly |
| Closing confirmation | `enableClosingConfirmation()` | `bridge.send('VKWebAppSetCloseConfirmation', { value: true })` |
| Payments | NOT documented | `bridge.send('VKWebAppOpenPayForm', { action, amount, ... })` |
| Theme | NOT documented | `bridge.send('VKWebAppGetConfig')` → `appearance`, `scheme` |

## Launch-params signature algorithm — side-by-side

### MAX (verified 2026-05-16)

```
secret_key = HMAC-SHA256(key="WebAppData", message=BOT_TOKEN)
launch_params = sort_by_key(decode_url(params \ {hash})).join("\n")
signature = hex(HMAC-SHA256(secret_key, launch_params))
ok = signature == params.hash
```

- **Key derivation:** key="WebAppData", message=bot_token.
- **Separator:** `\n` (LF).
- **Pair excluded:** `hash`.
- **Sort:** ASCII codepoint, ascending.
- **TTL field:** `auth_date` (Unix seconds).

### VK Bridge

```
sign_input = filter(params, k.startsWith("vk_"))
              .sort_by_key()
              .map(k => `${k}=${v}`)
              .join("&")
signature = base64url(HMAC-SHA256(SERVICE_TOKEN, sign_input))
ok = signature == params.sign
```

- **Key derivation:** the service token IS the key (no inner HMAC).
- **Separator:** `&`.
- **Pair excluded:** `sign`.
- **Sort:** ASCII codepoint, ascending.
- **Filter:** only keys starting with `vk_` participate.
- **Encoding:** base64url, NOT hex.
- **TTL field:** none built-in — use `vk_ts` (Unix seconds) as a TTL gate if present in your launch params.

Key takeaways:

- MAX uses **two HMAC layers** (derive secret, then sign); VK uses **one**.
- MAX outputs **hex**; VK outputs **base64url**.
- MAX joins with **`\n`**; VK joins with **`&`**.
- MAX has a **built-in `auth_date`**; with VK you must check `vk_ts` (or accept that launch params have no enforced TTL).

> If you maintain a shared `validateLaunchParams()` helper for both platforms, do not try to share the inner HMAC code — the constants and join separators differ. Two small, focused functions are clearer than one parameterized one.

## Architectural recommendations for multi-platform apps

1. **Abstract identity at the route layer, not the bridge layer.** Use a `requireUser()` middleware that knows how to dispatch to the right validator based on the request origin (header or path prefix).
2. **Different bot/app tokens.** MAX requires a bot in MAX для партнёров; VK requires a VK Mini App with its own service token. Store both under namespaced env vars (`MAX_BOT_TOKEN`, `VK_SERVICE_TOKEN`).
3. **One canonical user model.** Map both `MaxInitData.user` and VK's `VKUserInfo` into your domain's `User` aggregate at the validation boundary — do not let bridge-specific shapes leak into the rest of your code.
4. **Feature flags by platform.** Biometry, NFC, brightness control, and screen-capture toggle are MAX-only. Payments, theme params, stories are VK-only. Gate UI by platform — never assume parity.

## When to choose which

- **Audience is VK-native** (community page, VK ads → app): VK Mini App is the safe default.
- **Audience is MAX-native** (RU messenger users without VK habit, B2B in MAX-using orgs): MAX mini-app is the better fit.
- **Both audiences**: ship both. The cost is small (~600 LOC of bridge adapter); the UX win is large.

(verified 2026-05-16 against dev.max.ru and dev.vk.com — may change)
