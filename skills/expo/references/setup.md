# Setup — Bootstrap, Config, Dev Builds

## Create a new app

```bash
npx create-expo-app@latest my-app
cd my-app
```

The default template ships with:

- TypeScript (`tsconfig.json` extending `expo/tsconfig.base`)
- Expo Router (file-based routing under `app/`)
- ESLint config, `.gitignore`, EAS-ready `app.json`
- `react`, `react-native`, `expo` pinned to the active SDK

Other templates:

```bash
npx create-expo-app@latest --template blank-typescript    # no Router, plain TS
npx create-expo-app@latest --template tabs                # Tabs + Router
```

## Static vs dynamic config

**`app.json`** — JSON, static, easiest to read.
**`app.config.ts`** — TypeScript, dynamic, can read `process.env`, can compute values per environment. Preferred for any non-trivial project.

```ts
// app.config.ts
import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: process.env.APP_ENV === 'prod' ? 'MyApp' : 'MyApp (dev)',
  slug: 'my-app',
  scheme: 'myapp',
  ios: { bundleIdentifier: 'com.example.myapp' },
  android: { package: 'com.example.myapp' },
  plugins: [
    'expo-router',
    'expo-dev-client',
  ],
  experiments: { typedRoutes: true },
});
```

Only one of `app.json` / `app.config.ts` should exist. If both are present, `app.config.ts` wins and may spread `config` from `app.json`.

## Key config keys

| Key | Purpose |
|---|---|
| `name`, `slug` | display name and project identifier |
| `scheme` | custom URL scheme for deep links (`myapp://`) |
| `ios.bundleIdentifier`, `android.package` | platform IDs (immutable after store submit) |
| `version`, `ios.buildNumber`, `android.versionCode` | semantic version + native build counter |
| `runtimeVersion` | OTA compatibility key; pair with `fingerprint` policy in production |
| `plugins` | array of config plugins (strings or `[name, options]` tuples) |
| `experiments.typedRoutes` | enables Expo Router typed `<Link href="…">` autocomplete |
| `ios.associatedDomains`, `android.intentFilters` | universal links / app links |

## Development build vs Expo Go

| | Expo Go | Development build |
|---|---|---|
| Setup cost | None — install from store | Build once via EAS or locally |
| Native modules | Fixed SDK surface only | Any |
| Config plugins | Ignored | Applied |
| Production parity | Low | High |
| When to use | Quick prototyping | Everything else |

Install the dev-client package and rebuild any time you add a native dependency:

```bash
npx expo install expo-dev-client
eas build --profile development --platform ios
```

After that, `npx expo start --dev-client` launches Metro with the dev-build runtime.

## Daily commands

```bash
npx expo start                  # Metro bundler (Expo Go OR dev client)
npx expo start --dev-client     # force dev client
npx expo start --tunnel         # ngrok tunnel for QR pairing
npx expo install <pkg>          # installs the SDK-compatible version
npx expo prebuild               # materialise ios/ + android/
npx expo prebuild --clean       # wipe + regenerate (re-applies plugins)
npx expo run:ios                # local native build (requires Xcode)
npx expo run:android            # local native build (requires Android SDK)
npx expo-doctor                 # config + dependency sanity check
```

`npx expo install` is preferred over `npm install` for any Expo-managed package — it picks the version that matches the installed SDK.

## TypeScript

`tsconfig.json` should extend `expo/tsconfig.base` and enable `strict`. Auto-generated route types live in `.expo/types/` and are picked up by the editor when `experiments.typedRoutes` is enabled.

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": { "@/*": ["./*"] }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

## Project structure (with Expo Router)

```
my-app/
├── app/
│   ├── _layout.tsx          # root navigator
│   ├── index.tsx            # /
│   ├── (tabs)/
│   │   ├── _layout.tsx
│   │   ├── index.tsx
│   │   └── settings.tsx
│   ├── [id].tsx             # dynamic
│   └── +not-found.tsx
├── components/
├── lib/
├── modules/                 # local Expo modules
├── plugins/                 # custom config plugins
├── assets/
├── app.config.ts
├── eas.json
├── package.json
└── tsconfig.json
```

## Anti-patterns

- Hand-editing `ios/` / `android/` in a managed/CNG project — those are derived from config plugins; the change will be wiped on the next prebuild
- Using `npm install` for Expo-managed packages — version drift causes Metro/Hermes failures
- Mixing `app.json` and `app.config.ts` without explicit `config` spread — silent merges lose keys
- Skipping `expo-dev-client` and trying to use Expo Go with non-SDK native modules — fails at runtime with no useful message
