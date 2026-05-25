# Changelog

All notable changes to the `expo` skill are documented here. Format adapted from Keep a Changelog; the skill follows SemVer at the skill level.

## [1.0.0] — Initial release

### Added
- `SKILL.md` Pattern-2 navigator with frontmatter (name, description, stacks, packages, manifests, tags, risk=medium-stakes)
- Capability map at `references/REFERENCE.md`
- Reference files covering:
  - `setup.md` — create-expo-app, app.json vs app.config.ts, Expo Go vs dev build
  - `expo-router.md` — file-based routing, Stack/Tabs/Drawer, typed routes, modals, redirects
  - `eas-build.md` — eas.json profiles, env vars/secrets, prebuild, monorepo configs
  - `eas-update.md` — channels, branches, runtime version with fingerprint policy, rollback, code signing
  - `eas-submit.md` — App Store (ASC API key) and Google Play (service account, tracks)
  - `native-modules.md` — Expo Modules API (Swift/Kotlin), config plugins with `withInfoPlist`/`withAndroidManifest`
  - `permissions-and-native-apis.md` — declare-via-plugin + request-via-API pattern
  - `push-notifications.md` — expo-notifications, FCM/APNs, Expo push service, channels
  - `auth-and-deep-links.md` — expo-auth-session with PKCE, expo-linking, universal/app links
  - `new-architecture.md` — Fabric, TurboModules, bridgeless on RN 0.85, library compatibility
  - `troubleshooting.md` — Metro, Hermes, Xcode/Gradle, EAS, runtime errors
  - `eval-cases.md` — positive, negative, and borderline routing prompts

### Notes
- Targets Expo SDK 55 + React Native 0.85 (versions managed via the central registry)
- New Architecture treated as the default; legacy Paper-only paths documented as opt-out
- Related skills: `react`, `typescript`, `better-auth`, `tanstack-query`, `zod`, `react-hook-form`, `vitest`, `eslint`, `biome`, `playwright`
