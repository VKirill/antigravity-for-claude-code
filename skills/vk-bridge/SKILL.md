---
name: vk-bridge
description: "[RU: интеграция VK Mini Apps через VK Bridge — auth, VK Pay, sign launch params] VK Bridge SDK для VK Mini Apps — bridge.send/subscribe/supports, VKWebAppInit, VKWebAppGetAuthToken, VKWebAppGetUserInfo, VKWebAppOpenPayForm (pay-to-user/service/group/transfer), VKWebAppShare, VKWebAppShowStoryBox, VKWebAppStorageSet/Get, VKWebAppAllowNotifications, parseURLSearchParamsForGetLaunchParams. Use when: vk-bridge, @vkontakte/vk-bridge, VK Mini Apps, мини-приложение VK, ВКонтакте, VKWebApp, vk_user_id, vk_app_id, launch params, sign HMAC validation, VK Pay, VK ID, community app, group_id, vk_viewer_group_role. SKIP: Telegram Mini App (→telegram-bot), MAX webapps (→max-bridge cascade), generic OAuth (→nodejs)."
stacks:
  - vk-bridge
  - vk-mini-apps
  - typescript
packages:
  - "@vkontakte/vk-bridge"
  - "@vkontakte/vk-bridge-react"
tags:
  - vk
  - mini-apps
  - russia
  - social
  - payments
  - vk-id
manifests:
  - package.json
source: vechkasov-global-skills
risk: high-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- VK Bridge: `3.0.x (@vkontakte/vk-bridge)`
- TypeScript: `6.0.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->

## Usage

Loaded automatically when its description matches the active task. Read only the section you need, then follow the link to the relevant reference file for full detail.

## Use this skill when

- Building a VK Mini App (personal or community) — embedding `@vkontakte/vk-bridge`, initializing with `bridge.send('VKWebAppInit')`
- Detecting feature availability across platforms (web iframe, mobile WebView iOS/Android, desktop) — `bridge.supports()` / `bridge.supportsAsync()`
- Parsing and validating launch parameters server-side: `vk_user_id`, `vk_app_id`, `vk_is_app_user`, `vk_viewer_group_role`, `vk_platform`, `vk_ts`, `sign`
- Implementing server-side HMAC-SHA256 sign verification using the app's secret (защищённый ключ) — the ONLY way to trust user identity
- Requesting user identity: `VKWebAppGetUserInfo`, `VKWebAppGetEmail`, `VKWebAppGetPhoneNumber`, OAuth via `VKWebAppGetAuthToken` (scopes: `friends`, `photos`, `wall`, `messages`, etc.)
- Calling VK API directly through the bridge with `VKWebAppCallAPIMethod` (uses obtained access_token; bypasses CORS)
- Integrating VK Pay via `VKWebAppOpenPayForm` — actions: `pay-to-user`, `pay-to-service`, `pay-to-group`, `transfer-to-user`, `transfer-to-group`
- Social sharing: `VKWebAppShare` (link), `VKWebAppShowWallPostBox` (wall post), `VKWebAppShowStoryBox` (story sticker), `VKWebAppShowInviteBox`
- Persisting per-user app state via `VKWebAppStorageSet` / `VKWebAppStorageGet` / `VKWebAppStorageGetKeys` (key-value, quota-bounded)
- Subscribing to notifications: `VKWebAppAllowNotifications` + server-side `messages.send` with `intent="non_promo_newsletter"`
- Customizing chrome: `VKWebAppSetViewSettings` (status bar style, background), `VKWebAppDisableSwipeBack`, scroll lock
- Subscribing to `VKWebAppUpdateConfig` for theme (`appearance: light|dark`), `insets`, viewport changes; using `useAppearance` from `@vkontakte/vk-bridge-react`
- Distinguishing community-context (group_id, viewer is admin) from personal app flows

## Do not use this skill when

- Task is Telegram Mini App / Telegram WebApp / initData — use `telegram-bot` (different platform, different validation)
- Task is OK.ru / MAX / RuStore Mini App without VK bridge surface — use the respective platform skill (cascade marker)
- Task is generic OAuth 2.0 against VK ID outside of a Mini App context — use `nodejs` for raw HTTP + oauth library
- Task is the VK external API only (server-to-server, no embedded app) — use `nodejs` with `axios` and a service token
- Task is VK Ads / VK Reklama campaign management — different API surface (cascade marker)
- Task is pure UI design of the Mini App with no bridge integration — use `react` + `ui-ux-pro-max`

## Purpose

VK Bridge is the official SDK that connects a VK Mini App (HTML5 web app embedded in the VK client) to the native client surface — user identity, payments via VK Pay, notifications, storage, sharing, story camera, theme. It is the equivalent of Telegram's WebApp SDK for the VK ecosystem (vk.com + iOS/Android VK app + desktop). The SDK is platform-agnostic on the call side: `bridge.send('VKWebAppXxx', params)` is uniformly a Promise-returning method, while the underlying transport switches between `postMessage` (iframe on web), `webkit.messageHandlers` (iOS), and `window.AndroidBridge` (Android).

This skill covers the **production integration path** for a Mini App built with React/TypeScript and a Node.js backend: bridge initialization and feature detection, launch-param parsing AND server-side HMAC-SHA256 sign validation (the critical security boundary — client-supplied `vk_user_id` is forgeable without sign), auth and identity flows, VK Pay integration (with the security caveats around `transaction_id` idempotency), UI/theme subscription, social/sharing primitives, the per-user storage surface, community-app context, and the cross-platform quirks that bite (iframe sandboxing on web, supports() lying on some methods, desktop runtime differences).

What this skill does NOT do: the React UI library (`@vkontakte/vkui` is its own concern — surface this skill alongside `react`), VK external API design beyond what's reachable via `VKWebAppCallAPIMethod`, payment fiscalization in Russia (→ `cloudpayments` or `yookassa` for 54-ФЗ — VK Pay receipts are issued by VK as MoR for `pay-to-service`).

## Capabilities

### Setup and initialization

Install `@vkontakte/vk-bridge` (3.0.x), import `bridge` as the default export, call `await bridge.send('VKWebAppInit')` BEFORE any other call. `VKWebAppInit` is the handshake — without it the client may not register the app as active and subsequent calls can hang. `bridge.isEmbedded()` returns `true` when running inside the VK client; `false` in standalone/dev contexts. Plain `<script>` browser usage available via `dist/browser.min.js` (exports `vkBridge` global).

> Full reference: [references/setup.md](references/setup.md)

### Launch params and server-side sign validation

Launch params are passed as URL query string when the VK client opens the Mini App iframe/WebView. Parse client-side with `parseURLSearchParamsForGetLaunchParams(window.location.search)` — typed `Partial<LaunchParams>` with coerced numerics. Send the **raw query string** (or all `vk_*` params + `sign`) to your server. Server verifies: collect every key starting with `vk_`, sort ASCII-ascending, URL-encode the values, join as `k=v&k=v`, compute HMAC-SHA256 with the app's secret (защищённый ключ, NOT service token), encode result as base64url no-padding, compare with `sign` using `timingSafeEqual`. Reject on mismatch. Verify `vk_ts` is not stale (replay protection — recommended 1-hour window).

> Full reference: [references/launch-params.md](references/launch-params.md)

### Auth and identity

`VKWebAppGetUserInfo` returns the current user's profile (first/last name, photo_200, sex, city). `VKWebAppGetEmail` and `VKWebAppGetPhoneNumber` prompt the user — they're consent-gated. `VKWebAppGetAuthToken({ app_id, scope })` requests OAuth access_token with explicit scopes (comma-separated: `friends,photos,wall,messages,notify,...`). With the token, call `VKWebAppCallAPIMethod({ method, params: { access_token, v: '5.131', ... } })` from the client OR pass the token to your server for server-side API calls (preferred — keeps secret-bound logic off the client).

> Full reference: [references/auth-and-identity.md](references/auth-and-identity.md)

### UI events, theme, viewport

`bridge.subscribe(handler)` receives all client→app events. Key ones: `VKWebAppUpdateConfig` (theme `appearance: 'light'|'dark'`, `insets`, `viewport_height`, scheme), `VKWebAppLocationChanged` (hash routing), `VKWebAppViewHide` / `VKWebAppViewRestore`. Use `VKWebAppSetViewSettings({ status_bar_style, action_bar_color })` for chrome. `VKWebAppDisableSwipeBack` / `VKWebAppEnableSwipeBack` for iOS-edge-swipe control. React helper: `useAppearance()` from `@vkontakte/vk-bridge-react` returns `'light' | 'dark' | null`.

> Full reference: [references/ui-events.md](references/ui-events.md)

### Sharing and social

`VKWebAppShare({ link })` — native share sheet. `VKWebAppShowWallPostBox({ message, attachments })` — wall post composer with prefilled content. `VKWebAppShowStoryBox({ background_type, url, attachment })` — open VK Stories editor with stickers/links. `VKWebAppShowInviteBox()` — friend invitation modal. `VKWebAppShowCommunityWidgetPreviewBox({ group_id, type, code })` — propose a widget to community admin.

> Full reference: [references/sharing-and-social.md](references/sharing-and-social.md)

### Payments (VK Pay)

`VKWebAppOpenPayForm({ app_id, action, params })`. Actions: `pay-to-service` (merchant — money to your VK Pay merchant account; `merchant_id`, `amount`, `description`, `data`, `order_id`, `sign` required), `pay-to-user` / `pay-to-group` (peer-to-peer or to a community), `transfer-to-user` / `transfer-to-group` (transfer flow without fixed amount). On success returns `{ status: 'success', transaction_id, amount, extra }`. **`transaction_id` is your idempotency key** — store it with the order BEFORE granting access. Server independently verifies via VK Pay API or webhook; never trust client-supplied `status`.

> Full reference: [references/payments.md](references/payments.md)

### Storage

`VKWebAppStorageSet({ key, value })` writes a string value (must JSON.stringify objects). `VKWebAppStorageGet({ keys: [...] })` reads up to ~10 keys per call. `VKWebAppStorageGetKeys({ count, offset })` enumerates. Quotas: ~1000 keys per user per app, value length up to ~4096 chars (verify in your specific app context — quotas have shifted across platform versions). Per-user, per-app scope. Use for UI state, last-seen markers — NOT for sensitive data (the user can in principle dump it).

> Full reference: [references/storage.md](references/storage.md)

### Notifications

`VKWebAppAllowNotifications()` requests permission. Once granted, send via VK API (server-side, with service token + user_id): `messages.send` with `intent="non_promo_newsletter"` (or `confirmed_notification` for transactional). Notification permission can be revoked by the user; check `vk_are_notifications_enabled` in launch params and re-prompt if `0`.

> Full reference: [references/notifications.md](references/notifications.md)

### Community apps and admin context

A Mini App can be embedded in a VK community page. Launch params expose `vk_group_id` and `vk_viewer_group_role` (`'admin' | 'editor' | 'moder' | 'member' | 'none'`). Gate admin features on `vk_viewer_group_role === 'admin'` — but only AFTER server-side sign validation, because the client-side value is forgeable. Personal-app context omits both fields.

> Full reference: [references/community-apps.md](references/community-apps.md)

## Behavioral Traits

- Calls `await bridge.send('VKWebAppInit')` before any other bridge call — never skips the handshake
- Validates `sign` server-side with HMAC-SHA256 of sorted `vk_*` params using the app's secret (защищённый ключ), base64url no-padding, `crypto.timingSafeEqual` comparison
- Never trusts client-supplied `vk_user_id`, `vk_viewer_group_role`, or any launch param without server-side sign validation
- Calls `bridge.supports('VKWebAppX')` BEFORE calling X — degrades gracefully on platforms that don't implement it
- Stores `transaction_id` from `VKWebAppOpenPayForm` result as the idempotency key with the order in a single transaction before granting access
- Verifies payment server-side via VK API or webhook — never trusts client-reported `status: 'success'`
- Subscribes to `VKWebAppUpdateConfig` for theme/insets changes; uses `useAppearance()` in React apps
- Uses `parseURLSearchParamsForGetLaunchParams(window.location.search)` instead of hand-rolled `URLSearchParams` parsing — handles type coercion
- JSON.stringifies values before `VKWebAppStorageSet`; JSON.parses on read; handles parse failure as missing key
- Treats `vk_ts` as the sign timestamp; rejects sign validation if `vk_ts` is older than the configured replay window
- Uses `@vkontakte/vk-bridge-react` hooks (`useAppearance`, `useInsets`) instead of subscribing manually inside React components
- Wraps `bridge.send` in a typed wrapper with discriminated-union return types per method

## Important Constraints

- NEVER trust `vk_user_id` (or any `vk_*` param) without server-side HMAC-SHA256 `sign` verification — the URL is forgeable
- NEVER expose the app's secret (защищённый ключ) to the client — sign validation MUST be server-side
- NEVER skip `VKWebAppInit` — without it the host client doesn't register your app as active
- NEVER call a bridge method without `bridge.supports(method)` (or supportsAsync) check first — different platforms expose different surfaces
- NEVER grant access in the `VKWebAppOpenPayForm` success callback alone — independently verify the transaction via VK Pay API/webhook
- NEVER reuse a `transaction_id` — it's the idempotency key; deduplicate at insert time with a unique constraint
- NEVER store sensitive data (tokens, secrets, PII) in `VKWebAppStorageSet` — the user can read their own storage
- NEVER pass the user's access_token from `VKWebAppGetAuthToken` to a third party — scope is bound to your app
- NEVER use base64 standard for `sign` — VK uses **base64url no-padding** (replace `+` → `-`, `/` → `_`, strip `=`)
- ALWAYS verify `vk_ts` freshness on the server (e.g., reject if older than 1 hour) to prevent replay
- ALWAYS list `bridge.supports()` checks for every optional capability in your feature-detect layer
- ALWAYS handle the user denying a permission (`VKWebAppAllowNotifications`, `VKWebAppGetEmail`) gracefully — they may decline

## Related Skills

90%-filter applied — mainstream 2026 choices used in production VK Mini Apps.

### Runtime
- ✓ `nodejs` — Node 24 LTS (server-side sign verification, VK API calls)
- ✓ `typescript` — TS 6.0 (typed bridge wrappers, launch-param schemas)

### UI framework
- ✓ `react` — React 19 (most VK Mini Apps are React + @vkontakte/vkui)

### Server-side validation
- ✓ `zod` — Zod 4 (validate launch param shape after parsing)

### Web frameworks (webhook receivers for VK Pay)
- ✓ `fastify` — Fastify 5 (sign-validation middleware, raw body for HMAC)
- ✓ `hono` — Hono 4 (edge runtime for sign validation)

### Persistence
- ✓ `postgresql` — user/order persistence, `transaction_id` unique constraint
- ✓ `redis` — Redis 8 (sign-validation cache, `vk_ts` replay protection bitmap)

### Adjacent platform skills
- ✓ `telegram-bot` — Telegram Mini Apps (different SDK, similar validation pattern)
- ✓ `cloudpayments` — alternative payment provider for non-VK-Pay flows
- ✓ `yookassa` — alternative Russian payment provider

### Code discipline
- ✓ `karpathy-guidelines`

### Meta
- ✓ `skill-evaluation`

## API Reference

Domain-specific references (Pattern 2) — load only what's relevant:

| Topic | File |
|---|---|
| Index, capability map, decision flow per task | [references/REFERENCE.md](references/REFERENCE.md) |
| Setup — install, init, runtime detection (iframe vs WebView vs desktop), supports/supportsAsync | [references/setup.md](references/setup.md) |
| Launch params — vk_* keys, parseURLSearchParamsForGetLaunchParams, **sign HMAC validation with Node.js example** | [references/launch-params.md](references/launch-params.md) |
| Auth — VKWebAppGetAuthToken scopes, VKWebAppGetUserInfo/Email/PhoneNumber, server-side API calls with the user token | [references/auth-and-identity.md](references/auth-and-identity.md) |
| UI events — VKWebAppUpdateConfig (theme, insets, viewport), VKWebAppSetViewSettings, swipeBack, useAppearance | [references/ui-events.md](references/ui-events.md) |
| Sharing — VKWebAppShare, VKWebAppShowWallPostBox, VKWebAppShowStoryBox, VKWebAppShowInviteBox | [references/sharing-and-social.md](references/sharing-and-social.md) |
| Payments — VKWebAppOpenPayForm (pay-to-service/user/group, transfer-*), result handling, idempotency | [references/payments.md](references/payments.md) |
| Storage — VKWebAppStorageSet/Get/GetKeys, quotas, scoping, vs server-side | [references/storage.md](references/storage.md) |
| Notifications — VKWebAppAllowNotifications, messages.send intent=non_promo_newsletter, revocation handling | [references/notifications.md](references/notifications.md) |
| Community apps — vk_group_id, vk_viewer_group_role, admin gating, personal vs community context | [references/community-apps.md](references/community-apps.md) |
| **Troubleshooting** — symptom-indexed: events not firing, supports lies, sign mismatch, iframe sandbox, desktop quirks | [references/troubleshooting.md](references/troubleshooting.md) |
| **Recommended defaults** — sign TTL, retry policy, storage key prefixes, theme fallback | [references/recommended-defaults.md](references/recommended-defaults.md) |
| **Wrong vs right** — trusting vk_user_id without sign, missing idempotency, skipping supports check | [references/wrong-vs-right.md](references/wrong-vs-right.md) |
| Eval cases — positive/negative/edge routing tests | [references/eval-cases.md](references/eval-cases.md) |

**How to use**: open only the topic file relevant to the current task. New integration → `setup.md` + `launch-params.md`. Identity work → `auth-and-identity.md` + `wrong-vs-right.md` (pair on sign trust). Payments → `payments.md` + `recommended-defaults.md` (idempotency). Cross-platform bugs → `troubleshooting.md`.
