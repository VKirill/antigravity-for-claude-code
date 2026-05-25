# EAS Build

`eas-cli` builds production-grade iOS and Android binaries in the cloud (or locally with `--local`). Configuration lives in `eas.json`.

## Install and link

```bash
npm i -g eas-cli
eas login
eas init                  # links the project to an EAS project ID
eas build:configure       # writes a starter eas.json
```

`eas init` writes `expo.extra.eas.projectId` into `app.config.ts`/`app.json`.

## eas.json shape

```json
{
  "cli": { "version": ">= 16.0.0", "appVersionSource": "remote" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "channel": "development",
      "ios": { "resourceClass": "m-medium", "simulator": true },
      "android": { "buildType": "apk", "gradleCommand": ":app:assembleDebug" },
      "env": { "APP_ENV": "development" }
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview",
      "ios": { "simulator": false },
      "android": { "buildType": "apk" },
      "env": { "APP_ENV": "preview" }
    },
    "production": {
      "channel": "production",
      "autoIncrement": true,
      "env": { "APP_ENV": "production" }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "you@example.com",
        "ascAppId": "1234567890",
        "appleTeamId": "AB12XYZ34S"
      },
      "android": { "track": "internal" }
    }
  }
}
```

Profile inheritance:

```json
{ "production-staging": { "extends": "production", "env": { "API_URL": "https://staging.example.com" } } }
```

## Profile knobs

| Key | Effect |
|---|---|
| `developmentClient` | Bundles `expo-dev-client`; required for daily dev builds |
| `distribution` | `internal` (ad-hoc / AdHoc provisioning) or `store` |
| `channel` | Maps the binary to an EAS Update channel |
| `ios.simulator` | If `true`, builds a sim-only `.app` (no signing) |
| `ios.resourceClass` | `default`, `m-medium`, `m-large`, `m-large-arm64` |
| `android.buildType` | `apk` (testing) or `app-bundle` (Play Store) |
| `autoIncrement` | Auto-bumps `buildNumber` / `versionCode` server-side |
| `env` | Build-time env, available as `process.env.*` |

## Building

```bash
eas build --profile development --platform ios
eas build --profile production --platform all
eas build --profile preview --platform android --local      # build on this machine
```

After build:

```bash
eas build:list                       # recent builds
eas build:run --profile development  # install latest dev build on attached device
```

## Env vars and secrets

Three storage tiers:

1. **`.env` files** — read at build time when the file is in the working tree. Use sparingly; never commit secrets.
2. **EAS env vars** (`eas env:create`) — per-environment (`development`, `preview`, `production`) plain or sensitive vars. Plain values are visible in logs; sensitive values are not.
3. **EAS Secrets** (legacy `eas secret:create`) — encrypted strings, exposed only at build time. Prefer EAS env vars for new projects.

```bash
eas env:create --environment production --name SENTRY_AUTH_TOKEN --type sensitive
eas env:pull   --environment preview                            # writes .env.local
```

`EXPO_PUBLIC_*` vars are inlined into JS at build time and **visible to anyone with the bundle** — never use for secrets.

## Prebuild

`npx expo prebuild` materialises `ios/` + `android/` from `app.config.ts` and runs all config plugins. EAS Build runs this implicitly. Reasons to run it locally:

- Inspect the native files a plugin produces
- Move from managed → CNG (Continuous Native Generation) / bare workflow
- Debug a plugin failure

```bash
npx expo prebuild --clean              # wipe + regenerate
npx expo prebuild --platform ios       # one platform
npx expo prebuild --no-install         # skip CocoaPods / Gradle resolve
```

If `ios/` or `android/` exists, prebuild merges. With `--clean` it deletes them first and rewrites — destructive, but safe in a managed/CNG project where those folders are gitignored.

## Local vs cloud builds

```bash
eas build --local --profile production --platform ios
```

`--local` requires Xcode 16+ / Android SDK on the host, plus `fastlane` for iOS. Cloud builds are simpler unless you have CI constraints or need custom toolchains.

## Monorepo

For a workspace (pnpm, Yarn, npm), set:

```json
// eas.json
{
  "build": {
    "production": {
      "cache": { "key": "v1" }
    }
  }
}
```

```json
// app.config.ts → ensures correct hoisting
expo: {
  packagerOpts: { config: 'metro.config.js' }
}
```

Common monorepo pitfalls:

- Metro resolving multiple `react-native` copies — use `metro.config.js` with `nodeModulesPaths` set to all workspace roots
- Hoisted dependencies — pin packages that ship native code (`react-native-reanimated`, `expo-*`) at the app workspace, not the root
- Wrong working directory — `eas build` must be run from the app directory; use `--cwd` if needed

## Credentials

```bash
eas credentials                # interactive credential manager
eas credentials --platform ios # iOS-only
```

EAS can manage signing certs and provisioning profiles, or you can provide them manually. For Android, the keystore is generated on first build and stored on EAS; download with `eas credentials` → "Download credentials".

## Sharing dev builds

After a dev build completes, share the install URL or use:

```bash
eas build:run --profile development
```

Internal distribution requires the device's UDID (iOS) or just a download link (Android).

## Anti-patterns

- Putting secrets in `EXPO_PUBLIC_*` or `.env` files — they end up in the JS bundle
- Forgetting `developmentClient: true` on a dev profile — produces a release-style build that can't connect to Metro
- Using `simulator: true` for the dev profile that runs on a phone — install fails silently
- Skipping `autoIncrement` on production — uploads to TestFlight/Play fail because the build number is already in use
- Running `prebuild` without `--clean` after changing a plugin — stale native files override the plugin output
