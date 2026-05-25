---
name: expo
description: "Expo SDK 55 + React Native 0.85 — build, ship, and update iOS/Android apps. Expo Router file-based navigation, EAS Build/Submit/Update, config plugins, Expo Modules API, push notifications, deep links, New Architecture (Fabric + TurboModules + bridgeless) on by default. Use when: react native, expo, ios app, android app, mobile app, expo router, eas build, eas update, eas submit, ota updates, push notifications, expo-notifications, expo-auth-session, expo-linking, config plugin, prebuild, expo modules api, dev client, app.json, app.config.ts, eas.json, fabric, turbomodules, hermes, bridgeless. SKIP: pure web React (→react), Next.js (→nextjs), Flutter, Cordova/Ionic, native Swift/Kotlin without RN."
stacks:
  - mobile
  - expo
  - react-native
  - react
  - typescript
packages:
  - expo
  - expo-router
  - expo-dev-client
  - expo-notifications
  - expo-updates
  - eas-cli
manifests:
  - app.json
  - app.config.ts
  - eas.json
tags:
  - mobile
  - react-native
  - ios
  - android
  - expo-router
  - eas
  - ota-updates
risk: medium-stakes
source: vechkasov-global-skills
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- Expo SDK: `55`
- React Native: `0.85.x`
- React: `19.x`
- TypeScript: `6.0.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->

## Usage

Loaded automatically when its description matches the active task. Read only the reference section that matches the current sub-task — Pattern 2 layout means you never need to scan the full skill.

## Use this skill when

- Bootstrapping a new Expo app (`create-expo-app`, TypeScript template, expo-dev-client)
- Designing or refactoring navigation with **Expo Router** (Stack, Tabs, Drawer, dynamic segments, typed routes, modals, redirects)
- Setting up **EAS Build** profiles (`development`, `preview`, `production`), env vars, secrets, build resources, monorepo configs
- Shipping **OTA updates via EAS Update** — channels, branches, runtime version, fingerprint policy, rollback, code signing
- Submitting to **App Store / Google Play** with EAS Submit (ASC API key, internal track, production track)
- Writing **Expo Modules** (Swift / Kotlin) or **config plugins** that modify Info.plist / AndroidManifest at prebuild
- Wiring **push notifications** (expo-notifications, FCM, APNs, foreground/background handlers, channels)
- Implementing **OAuth / deep links** with expo-auth-session (PKCE) and expo-linking (custom scheme, universal links, app links)
- Requesting **native permissions** (camera, location, contacts, notifications) and adding matching plist/manifest entries via plugins
- Migrating to or debugging **New Architecture** (Fabric, TurboModules, bridgeless) on RN 0.85
- Diagnosing Metro errors, Hermes crashes, native Gradle/Xcode build failures, EAS build log issues

## Do not use this skill when

- The codebase is plain React for the web — use `react`
- Working in Next.js App Router — use `nextjs`
- The project is Flutter / Dart, Capacitor, or native-only Swift/Kotlin — out of scope
- The question is about generic TypeScript type system design — use `typescript`
- Setting up Better Auth on the server — use `better-auth` (Expo only consumes the OAuth/session it exposes)

## Purpose

Expo SDK 55 is the latest stable release built on React Native 0.85, where the **New Architecture is the default** (Fabric renderer, TurboModules, bridgeless mode). The SDK pairs the OSS framework with **EAS** — managed builds, OTA updates, and store submission — so a single codebase ships to iOS, Android, and (optionally) web.

This skill covers the full mobile lifecycle: project creation, file-based routing with Expo Router, native customisation through config plugins and the Expo Modules API, push notifications, OAuth deep links, and the EAS pipeline from local prebuild to TestFlight / Play Console. It hands off to `react` for component patterns and to `typescript` for type-system specifics.

## Capabilities

### Project bootstrap and dev workflow

`create-expo-app` scaffolds a TypeScript + Expo Router project. The default workflow is a **development build** (`expo-dev-client`) — a customizable shell that supersedes Expo Go for anything beyond the SDK surface. Use Expo Go only for very early prototypes that touch zero custom native code.

→ [references/setup.md](references/setup.md)

### Expo Router (v5 conventions on SDK 55)

File-based routing maps `app/` to URL segments. `_layout.tsx` files define navigators (Stack, Tabs, Drawer). Dynamic segments use `[id].tsx`; groups use `(group)`; the `+not-found.tsx` file handles 404. Typed routes are enabled via `experiments.typedRoutes: true` in app config. Hooks: `useRouter`, `useLocalSearchParams`, `useSegments`, `useNavigation`, `Redirect`, `Link`.

→ [references/expo-router.md](references/expo-router.md)

### EAS Build

`eas.json` defines build profiles (`development`, `preview`, `production`). Profiles control distribution (`internal` vs store), `developmentClient`, resource class, env vars, and platform-specific overrides. `eas build:configure` initialises the file. `npx expo prebuild` materialises native `ios/`/`android/` directories for inspection or CNG-managed workflows.

→ [references/eas-build.md](references/eas-build.md)

### EAS Update (OTA)

Push JS-only updates to installed binaries. Updates are scoped by **channel** (mapped to a build profile) and **runtime version** (must match between binary and update). The `fingerprint` policy hashes native dependencies so an OTA never lands on an incompatible binary. `eas update:roll-back-to-embedded` reverts to the shipped JS.

→ [references/eas-update.md](references/eas-update.md)

### EAS Submit

`eas submit --platform <ios|android>` ships a finished build to the store. iOS uses an **ASC API key** (`appleId`, `ascAppId`, `appleTeamId`); Android uses a service-account JSON. The `track` knob controls Play Console rollout (`internal`, `alpha`, `beta`, `production`).

→ [references/eas-submit.md](references/eas-submit.md)

### Native modules and config plugins

Two layers of native customisation: **Expo Modules API** (Swift/Kotlin module with declarative `requireNativeModule` JS binding) and **config plugins** (Node functions that mutate `Info.plist`, `AndroidManifest.xml`, Gradle, Podfile at prebuild). Use `withInfoPlist`, `withAndroidManifest`, `withDangerousMod` from `expo/config-plugins`.

→ [references/native-modules.md](references/native-modules.md)

### Permissions and native APIs

Camera, location, contacts, notifications, microphone, photos. Two-step pattern: declare usage strings via config plugin (Info.plist key + Android `<uses-permission>`), then call the module's `requestPermissionsAsync()` at runtime. Never call native APIs without a fallback for denied/limited states.

→ [references/permissions-and-native-apis.md](references/permissions-and-native-apis.md)

### Push notifications

`expo-notifications` registers a device, fetches an Expo push token, sets a foreground handler, and listens for received/responded events. On Android, channels (`setNotificationChannelAsync`) are required before the permissions prompt. Production sends go via Expo's push service (proxy to FCM + APNs) or directly via FCM/APNs.

→ [references/push-notifications.md](references/push-notifications.md)

### Auth and deep links

`expo-auth-session` implements OAuth + PKCE flows; `expo-linking` parses incoming URLs and builds redirect URIs. `scheme` in app config plus `associatedDomains` (iOS) and `intentFilters` (Android) wire universal/app links. Always test both cold-start and warm-resume link handling.

→ [references/auth-and-deep-links.md](references/auth-and-deep-links.md)

### New Architecture (RN 0.85)

Fabric (concurrent renderer), TurboModules (lazy native modules), and bridgeless mode are on by default. Legacy Paper-only libraries are now opt-in via `newArchEnabled: false` — discouraged. Common gotchas: layout-effect timing changes, third-party libs missing TurboModule shims, Reanimated/Skia version pins.

→ [references/new-architecture.md](references/new-architecture.md)

### Troubleshooting

Metro module-resolution loops, Hermes string-property crashes, Xcode 16+ pod install failures, Gradle JVM heap, EAS build cancellations, runtime-version mismatch errors on OTA, fingerprint drift, Reanimated babel plugin order.

→ [references/troubleshooting.md](references/troubleshooting.md)

### Eval cases

Routing prompts that validate the skill loads when expected (Expo Router refactor, EAS Build setup, push token registration) and stays out when it shouldn't (web-only React, Next.js, Flutter).

→ [references/eval-cases.md](references/eval-cases.md)

## Behavioral Traits

- Reaches for **development builds** (`expo-dev-client`) over Expo Go on every non-trivial project — Expo Go's native surface is fixed and blocks most production features
- Pins **runtime version with the `fingerprint` policy** so OTA updates never collide with an incompatible binary
- Treats `app.config.ts` as the source of truth — never hand-edits files under `ios/` / `android/` unless the project is intentionally bare-workflow
- Models permissions as **declare-via-plugin + request-via-API** in one PR; never one without the other
- Wraps push-token registration in `Device.isDevice` and gracefully degrades on simulators
- Reads `EXPO_PUBLIC_*` env vars at build time only — secrets go to EAS Secrets, never bundled into JS
- Writes config plugins as **typed `ConfigPlugin<Props>`** from `expo/config-plugins` and validates with `expo prebuild --clean` before pushing
- Verifies New Architecture compatibility for every third-party native lib before adding it (TurboModule support matrix)
- Splits navigation by `_layout.tsx` boundary — auth-gated stacks live behind `(auth)` groups with `<Redirect>` in their layout
- Uses **typed routes** (`experiments.typedRoutes: true`) on every new project — eliminates an entire class of broken links

## Important Constraints

- NEVER hand-edit `ios/` or `android/` in a managed/CNG project — those are derived artifacts; encode the change as a config plugin and re-run prebuild
- NEVER ship secrets in JS — `EXPO_PUBLIC_*` is public; sensitive values belong in EAS Secrets or a backend
- NEVER call `Updates.reloadAsync()` in Expo Go or dev mode — it rejects; gate with `Updates.isEnabled`
- NEVER mismatch runtime versions across a binary and its OTA — clients ignore incompatible updates silently
- NEVER assume notifications work on a simulator — push tokens require a physical device on both platforms
- NEVER disable the New Architecture without a documented reason — it's the default on RN 0.85 and most libraries have dropped Paper-only support
- NEVER commit `google-services.json` / `GoogleService-Info.plist` with production keys to a public repo — load via EAS file env vars
- ALWAYS pair a config plugin change with `npx expo prebuild --clean` in CI to catch native drift
- ALWAYS test deep links from both cold-start (app killed) and warm-resume (app backgrounded) — they hit different code paths
- ALWAYS validate that a third-party native dependency declares Expo Modules / autolinking support before adopting it

## Related Skills

Active skills only; cascade markers omitted.

### Language and core framework
- ✓ `react` — composition patterns, hooks, Suspense, `useOptimistic` — all apply on RN
- ✓ `typescript` — strict-mode types, generics for typed routes, branded IDs

### Auth & data
- ✓ `better-auth` — server-side auth that Expo consumes via `expo-auth-session` callback URLs
- ✓ `tanstack-query` — server-state cache for mobile screens
- ✓ `zod` — runtime validation for API responses and deep-link params
- ✓ `react-hook-form` — forms on native screens

### Testing & lint
- ✓ `vitest` — unit tests for shared logic (RN component testing via `@testing-library/react-native`)
- ✓ `eslint` / ✓ `biome` — lint and format
- ✓ `playwright` — only for the optional web target

## API Reference

Domain-specific references (Pattern 2) — load only what's relevant:

| Topic | File |
|---|---|
| Capability map, decision tree, when-to-open-which-file | [references/REFERENCE.md](references/REFERENCE.md) |
| Bootstrap, TypeScript template, app.json / app.config.ts, expo-dev-client vs Expo Go | [references/setup.md](references/setup.md) |
| Expo Router — Stack/Tabs/Drawer, dynamic segments, typed routes, modals, deep links | [references/expo-router.md](references/expo-router.md) |
| EAS Build — profiles, env vars, secrets, resources, prebuild, monorepo | [references/eas-build.md](references/eas-build.md) |
| EAS Update — channels, runtime version, fingerprint, rollback, code signing | [references/eas-update.md](references/eas-update.md) |
| EAS Submit — App Store, Play Console, ASC API keys, tracks | [references/eas-submit.md](references/eas-submit.md) |
| Expo Modules API + config plugins (Swift/Kotlin, withInfoPlist/withAndroidManifest) | [references/native-modules.md](references/native-modules.md) |
| Permissions and native APIs — camera, location, contacts, request flow | [references/permissions-and-native-apis.md](references/permissions-and-native-apis.md) |
| Push notifications — expo-notifications, Expo push service, FCM/APNs, background | [references/push-notifications.md](references/push-notifications.md) |
| Auth + deep links — expo-auth-session PKCE, expo-linking, universal/app links | [references/auth-and-deep-links.md](references/auth-and-deep-links.md) |
| New Architecture — Fabric, TurboModules, bridgeless, RN 0.85 gotchas | [references/new-architecture.md](references/new-architecture.md) |
| **Troubleshooting** — Metro, Hermes, Xcode/Gradle pins, EAS log debugging | [references/troubleshooting.md](references/troubleshooting.md) |
| Eval cases — routing prompts to validate skill load/skip behaviour | [references/eval-cases.md](references/eval-cases.md) |

**How to use**: open the specific topic file. Don't read all references — pick what matches the current sub-task.
