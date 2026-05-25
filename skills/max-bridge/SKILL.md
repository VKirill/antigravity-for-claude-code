---
name: max-bridge
description: "[RU: интеграция MAX мессенджера (VK Tech) — Mini Apps Bridge, валидация initData, HMAC] MAX Bridge SDK для мини-приложений мессенджера МАХ (VK Tech, RU-альтернатива Telegram). window.WebApp API, initData/initDataUnsafe, серверная HMAC-SHA256 валидация WebAppData с двойным HMAC через bot token, DeviceStorage/SecureStorage, BiometricManager, HapticFeedback, NfcManager, BackButton, shareMaxContent, openCodeReader. Use when: MAX мессенджер, MAX Mini App, MAX webapp, MAX Bridge, dev.max.ru, max-web-app.js, window.WebApp, WebAppData, мини-приложение МАХ, MAX bot, VK Tech messenger, validation, launch data, initData HMAC, RU Telegram alternative. SKIP: Telegram Mini App (→telegram-bot), VK Mini App (→vk-bridge), generic OAuth flow (→nodejs/better-auth)."
stacks:
  - MAX Bridge
  - TypeScript
tags:
  - max
  - mini-apps
  - russia
  - vk-tech
packages: []
manifests: []
source: regenerated-zero-baseline
risk: high-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- MAX Bridge: `docs-only (no public npm pkg; dev.max.ru/docs/webapps/bridge)`
- TypeScript: `6.0.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->


<!-- versions block intentionally omitted — MAX Bridge has no public npm package and is on a docs-only pin per STACK_VERSIONS.md. Re-add a versions block here only if MAX publishes a stable SDK with semantic versioning. -->

## Usage

Loaded automatically when the user mentions MAX messenger mini-apps, the MAX Bridge, dev.max.ru, or asks about validating MAX launch data. Read only the reference file relevant to the current task — do not load every reference up front.

## Use this skill when

- Building a mini-app for the **RU market** that targets the MAX messenger (VK Tech's messenger product, positioned as an alternative to Telegram)
- Implementing identity / authorization for a MAX mini-app — validating `window.WebApp.initData` server-side with HMAC-SHA256 against the bot token
- Wiring the CDN script `https://st.max.ru/js/max-web-app.js` and typing `window.WebApp` for TypeScript
- Using bridge capabilities: `DeviceStorage`, `SecureStorage`, `BiometricManager`, `HapticFeedback`, `NfcManager`, `BackButton`, `ScreenCapture`, `requestContact`, `openCodeReader`, `shareMaxContent`, `openMaxLink`
- Choosing how to ship in the **RU market alongside or instead of Telegram / VK Bridge**, or migrating from VK Mini Apps (the VK ecosystem alternative)
- Debugging `signature mismatch`, missing `hash`, `auth_date` TTL expiration, CSP / iframe issues, or platform-specific quirks (web/desktop/iOS/Android)
- Building a server-side validator for `WebAppData` in Node.js (Fastify, Hono, Next.js) following the upstream 10-step algorithm
- Auditing identity safety: ensuring `initDataUnsafe` is not trusted, TTL is enforced, bot token isn't shipped to the client

## Do not use this skill when

- Task is a **Telegram** Mini App or Telegram Bot — hand off to `telegram-bot`
- Task is a **VK** Mini App / VKWebApp / VK Pay — hand off to `vk-bridge`
- Task is a generic OAuth / SSO / JWT-only auth flow with no MAX surface — use `better-auth` or `nodejs`
- Task is messaging on WhatsApp, Discord, Matrix, Slack, or any non-MAX platform
- Task is the MAX **Bot API** for chat bots (server-only flow with no mini-app surface) — that is a different surface; this skill covers the mini-app bridge only
- Task is pure Mini App UI/UX styling without bridge integration — use `ui-ux-pro-max` / `tailwind` / `shadcn`

## Purpose

MAX is VK Tech's messenger platform, positioned as a Russian-market alternative to Telegram with first-party mini-app support. Its `WebApp` bridge follows the same conceptual model as Telegram Mini Apps and VK Mini Apps — a CDN-injected `window.WebApp` object that exposes platform capabilities (storage, biometry, haptic, share, NFC) and a signed `initData` string that is the only safe handle on user identity. The signing scheme uses a two-layer HMAC-SHA256 keyed by the bot token (with the literal string `"WebAppData"` as the inner key) and outputs a hex hash — distinct from VK Bridge's single-layer base64url sign and from Telegram's similarly named but constant-different scheme.

This skill encodes the upstream documentation at https://dev.max.ru/docs/webapps/bridge and https://dev.max.ru/docs/webapps/validation as of 2026-05-16, plus consolidated guidance for production use: a Node.js reference validator, a side-by-side VK Bridge comparison for teams supporting both, troubleshooting indexed by user-visible failure, recommended defaults (TTL, retry, cache, CSP), and five wrong-vs-right pairs covering the highest-stakes identity mistakes. The platform is young — capabilities published upstream are tracked verbatim under `references/upstream/` so future drift is auditable via re-sync.

## Capabilities

### Bridge surface mapping

Every documented method, event, and type is captured in `bridge-api.md` (our consolidated index) and `upstream/bridge.md` (verbatim). The bridge exposes the `window.WebApp` namespace with sub-objects `ScreenCapture`, `BackButton`, `DeviceStorage`, `SecureStorage`, `BiometricManager`, `HapticFeedback`, `NfcManager` — each with explicit platform support gates («Не поддерживается веб-клиентом» means the Promise will reject on `platform === 'web'`).

### Server-side launch-data validation

The 10-step HMAC-SHA256 algorithm from `https://dev.max.ru/docs/webapps/validation` is the only safe path to trusting any user-attributed data. `references/launch-data-validation.md` ships a production Node.js validator (timing-safe compare, configurable TTL, structured errors) plus an Edge-runtime variant using Web Crypto for Cloudflare Workers / Vercel Edge. Common pitfalls — wrong sort, wrong separator, decoding the wrong field, treating `auth_date` as ms — are called out inline.

### VK Bridge side-by-side comparison

`references/comparison-vk-bridge.md` is the key differentiator: a method-by-method mapping table for teams that need to support both VK Mini Apps and MAX, with a side-by-side breakdown of the sign-validation algorithms (different constants, different join separators, different output encodings). Architectural guidance covers how to abstract identity at the route layer without leaking platform-specific shapes into domain code.

### Identity-mistake prevention

`references/wrong-vs-right.md` collects the five most expensive mistakes: trusting `initDataUnsafe`, skipping TTL, shipping bot token to client, leaving `hash` in `launch_params`, treating native methods as guaranteed-available. Each pair has a one-liner explaining why it matters, paired with the correct pattern.

### Troubleshooting

`references/troubleshooting.md` is symptom-indexed: `window.WebApp` undefined, signature always fails, `initData` is empty, biometry openSettings closes the app, `openLink` does nothing without a user gesture, CSP/iframe breaks the bridge, server clock drift causes false expiry. Each entry: Symptoms → Diagnose commands → Common causes → Fix.

### Recommended defaults

`references/recommended-defaults.md` is the single source of truth for tunable knobs: `maxAgeSeconds=3600` (matches upstream guidance of 1 hour), retry policy on 5xx only, caching by `sha256(initData)` with bounded TTL, CSP `script-src`/`frame-ancestors`, header naming (`X-Max-InitData`), and 401 response shapes.

## Behavioral Traits

- Treats `window.WebApp.initData` as the **only** trustable identity handle; uses `initDataUnsafe` exclusively for UI prefill (display name, avatar)
- Validates `WebAppData` server-side on every authenticated request via HMAC-SHA256 with `"WebAppData"` as the inner key and the bot token as the message
- Enforces an `auth_date` TTL of 1 hour by default (matches upstream «Рекомендуемый интервал составляет 1 час»); tightens to 10 minutes for payment / profile-mutation endpoints
- Uses `timingSafeEqual` (or constant-time XOR on Edge) when comparing the computed hash against the original — never `===` on strings
- Excludes `hash` from `launch_params` before signing — signing input never contains its own would-be signature
- Sorts `launch_params` keys by ASCII codepoint, not `localeCompare()`, matching the upstream TypeScript reference
- Capability-checks `platform !== 'web'` before calling `DeviceStorage`, `SecureStorage`, `BiometricManager`, `HapticFeedback`, `NfcManager` — those reject on web
- Calls bridge navigation methods (`openLink`, `downloadFile`, `shareMaxContent`) synchronously from user-gesture handlers — the bridge refuses without a recent click
- Stores the MAX bot token in env (`MAX_BOT_TOKEN`), never in client bundles, never in git
- For multi-platform projects supporting both MAX and VK: keeps validators as two focused functions (not one parameterized helper) because constants, separators, and output encodings differ
- Cross-checks every claimed method name against `references/upstream/bridge.md` before writing code — MAX is a young platform and analogies from VK Bridge / Telegram WebApp do not transfer reliably

## Important Constraints

- NEVER trust `initDataUnsafe` for authorization — it is mutable in the client iframe; always validate the raw `initData` server-side
- NEVER ship the bot token to the browser — it is the validation key and equivalent to a master password
- NEVER skip the `auth_date` TTL check after a successful HMAC verification — without it, signed payloads are permanent credentials
- NEVER include `hash` in `launch_params` before signing — the signature input must be the payload minus its own signature
- NEVER use `localeCompare()` to sort `launch_params` keys — use raw `<` / `>` ASCII comparison to match the upstream reference
- NEVER cache «validated» flags by `user.id` — cache by `sha256(initData)` with bounded TTL, never longer than the credential's remaining lifetime
- NEVER call `DeviceStorage` / `SecureStorage` / `BiometricManager` / `HapticFeedback` / `NfcManager` without a prior `platform` capability check — they reject on unsupported platforms
- NEVER assume MAX has feature parity with Telegram WebApp or VK Bridge — payments, theme params, viewport events, main button, and cloud storage are NOT documented as of the upstream fetch date
- ALWAYS validate against the upstream-mirrored reference (`references/upstream/`) before quoting a method signature — analogies from sibling platforms are unreliable
- ALWAYS call `BiometricManager.init()` and `NfcManager.init()` once per app session before using their other methods

## Related Skills

### Runtime
- ✓ `nodejs` — Node 24 LTS, AsyncLocalStorage, graceful shutdown for the validator host process
- ✓ `typescript` — TS 6.0 for typing `window.WebApp` and the validator surface

### Sibling Mini App platforms
- ✓ `vk-bridge` — VK Mini Apps SDK (multi-platform RU teams typically ship both)
- ✓ `telegram-bot` — Telegram WebApp Mini Apps + initData HMAC (same concept, different constants)

### Web frameworks for the validator
- ✓ `fastify` — production webhook / API host with `preHandler` validation hook
- ✓ `hono` — edge-compatible validation via Web Crypto

### Frontend frameworks
- ✓ `react` — React 19 for the mini-app UI
- ✓ `vue` — Vue 3.5 alternative
- ✓ `nuxt` — Nuxt 4 with SSR / file routes
- ✓ `nextjs` — Next.js 16 with App Router

### Data persistence
- ✓ `postgresql` — PostgreSQL 18 for user / order tables keyed by validated `user.id`
- ✓ `redis` — Redis 8 for validated-initData cache backend
- ✓ `prisma` — Prisma 7 for type-safe access

### Validation
- ✓ `zod` — schema validation for request bodies after identity is established

### Payments (no native MAX payments — use a separate provider)
- ✓ `cloudpayments` — CloudPayments RU gateway
- ✓ `yookassa` — YooKassa RU gateway

### Code discipline
- ✓ `karpathy-guidelines` — surgical changes, simplicity-first

### Meta
- ✓ `skill-evaluation` — skill authoring standards (this skill is v1.0.0)

## API Reference

| Topic | File |
|---|---|
| Decision map, reading order, status of upstream coverage | [references/REFERENCE.md](references/REFERENCE.md) |
| Setup — CDN script, TypeScript types, env detection, framework integration, dev stub | [references/setup.md](references/setup.md) |
| Consolidated bridge API surface — capability matrix, method index, what's NOT in MAX | [references/bridge-api.md](references/bridge-api.md) |
| Server-side validation algorithm — Node.js + Edge implementations, Fastify/Hono integration, pitfalls | [references/launch-data-validation.md](references/launch-data-validation.md) |
| Side-by-side MAX vs VK Bridge — method mapping, sign-algorithm diff, multi-platform architecture | [references/comparison-vk-bridge.md](references/comparison-vk-bridge.md) |
| Troubleshooting — symptom-indexed: WebApp undefined, signature fails, CSP, openLink silent, biometry quirks | [references/troubleshooting.md](references/troubleshooting.md) |
| Recommended defaults — TTL, retry, cache strategy, CSP, header naming, 401 shapes | [references/recommended-defaults.md](references/recommended-defaults.md) |
| Wrong vs right — 5 high-stakes identity/security pairs with "why it matters" | [references/wrong-vs-right.md](references/wrong-vs-right.md) |
| Eval cases — positive / negative / edge routing prompts | [references/eval-cases.md](references/eval-cases.md) |

### Upstream mirrors (verbatim)

| Source | File |
|---|---|
| `https://dev.max.ru/docs/webapps/bridge` — full method surface | [references/upstream/bridge.md](references/upstream/bridge.md) |
| `https://dev.max.ru/docs/webapps/validation` — 10-step algorithm + reference TypeScript | [references/upstream/validation.md](references/upstream/validation.md) |
| Source URLs, fetch date, re-sync procedure | [references/upstream/SOURCE.md](references/upstream/SOURCE.md) |

**How to use**: new mini-app → `setup.md` + `bridge-api.md`. Identity / payments → `launch-data-validation.md` + `wrong-vs-right.md`. Production support → `troubleshooting.md` + `recommended-defaults.md`. Cross-platform with VK → `comparison-vk-bridge.md`. Diff against `references/upstream/` if a method name in the wild does not match this skill — upstream is the floor.
