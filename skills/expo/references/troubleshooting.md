# Troubleshooting

Group symptoms by surface (Metro / Hermes / native build / EAS / runtime). Run `npx expo-doctor` first when anything mysterious happens.

## Metro / bundler

### "Unable to resolve module …"

- Stop the dev server
- Clear caches: `npx expo start -c`
- Verify package is in `dependencies` (not just `devDependencies`)
- If a workspace, ensure `metro.config.js` includes all workspace roots:

```js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
const workspaceRoot = path.resolve(__dirname, '../..');
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
module.exports = config;
```

### Multiple copies of `react` / `react-native`

Symptom: "Invalid hook call" or "Two copies of React" at runtime. Fix with `metro.config.js` `resolver.alias` or by hoisting in the workspace:

```js
config.resolver.alias = {
  react: path.resolve(__dirname, 'node_modules/react'),
  'react-native': path.resolve(__dirname, 'node_modules/react-native'),
};
```

### TypeScript paths not resolving in Metro

Add `resolver.alias` mirroring `tsconfig.json` `paths`. `expo/metro-config` honours `tsconfig.json` paths automatically only when set under `compilerOptions.paths` with the matching `baseUrl`.

## Hermes

### App crashes on launch, only on release build

- Check Hermes is enabled in both platforms (default in SDK 55 / RN 0.85)
- Strict-mode JS that uses `Symbol`-keyed iteration with older polyfills can throw — remove the polyfill
- "Property '…' doesn't exist" — usually a tree-shaken import bundled differently in release; check `babel.config.js` excludes and `transform-inline-environment-variables`

### Source maps missing in Sentry

```bash
eas build --profile production --platform all
# Sentry sourcemaps upload step runs automatically via @sentry/react-native if installed.
```

For manual upload:

```bash
npx sentry-expo-upload-sourcemaps dist
```

## Native build (Xcode / Gradle)

### iOS pod install failures

- Run `npx expo prebuild --clean` to regenerate the Podfile
- `cd ios && pod install --repo-update`
- Xcode 16+ requires CocoaPods ≥ 1.15. Update with `sudo gem install cocoapods`
- For M-series Macs running into arch issues: `arch -arm64 pod install`

### Gradle "Could not initialize class …"

- Java 17+ required. Set `JAVA_HOME` to a JDK 17 install.
- Increase heap in `gradle.properties` (via a plugin):
  ```properties
  org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m
  ```
- Wipe build dir: `cd android && ./gradlew clean`

### "Command PhaseScriptExecution failed with a nonzero exit code"

Usually a script in Build Phases. Most commonly:

- `[CP] Embed Pods Frameworks` — `pod install` left a stale Podfile.lock; re-run
- "Bundle React Native code and images" — Metro couldn't start during the build; check Node version and PATH within Xcode (Xcode uses `/usr/local/bin` / `/opt/homebrew/bin`, not your shell PATH)

## EAS Build

### Build cancelled / queue stuck

- Check `eas build:list` for the actual status
- Free tier has concurrency limits; paid plans get parallel slots
- Cancel manually: `eas build:cancel <id>`

### "ENOSPC" or out-of-memory in EAS logs

- Bump `resourceClass`: `"ios": { "resourceClass": "m-large" }`
- For Android: `"android": { "resourceClass": "large" }`

### Credentials prompt loops

```bash
eas credentials --platform ios
```

Choose "Remove provisioning profile" and "Remove distribution certificate", then re-run the build to let EAS provision fresh ones.

## EAS Update

### "No update available" but you just published

- Channel/branch mismatch — `eas channel:view <channel>` to confirm pointing at the right branch
- Runtime version mismatch — `eas update:view <id>` shows the runtime version it targeted; compare to the running binary (`Updates.runtimeVersion`)
- Fingerprint policy: native deps changed since the binary was built → no compatible update will land. Rebuild the binary.

### Update downloaded but not applied

```ts
const { isUpdatePending } = Updates.useUpdates();
useEffect(() => { if (isUpdatePending) Updates.reloadAsync(); }, [isUpdatePending]);
```

Or check `Updates.isEmbeddedLaunch` to see if the running JS is still the embedded one.

## Runtime errors

### "Invariant Violation: requireNativeComponent: '…' was not found"

A native component is referenced before its module is loaded. Causes:

- Module isn't autolinked (check `expo-modules-autolinking`)
- Native code missing from build (rerun `npx expo run:ios` / `run:android`)
- Wrong platform (the module is iOS-only and you're running Android)

### "Cannot read property 'X' of undefined" in production but not dev

Often a Hermes vs JSC string-coercion difference. Add types or null-checks; reproduce with `EXPO_USE_PRODUCTION_LISTING=1` if possible.

### `Reanimated` errors

```text
[Reanimated] Mismatch between JS and native part of Reanimated
```

- Mismatched versions across worktree; `npx expo install react-native-reanimated`
- `react-native-reanimated/plugin` is missing or not last in `babel.config.js`:

```js
module.exports = {
  presets: ['babel-preset-expo'],
  plugins: ['react-native-reanimated/plugin'], // must be last
};
```

After fixing, run `npx expo start -c`.

### "PlatformConstants" or "DevSettings" null

The dev menu or fast refresh tried to access a module that requires the dev client. Make sure you're running a dev build (`developmentClient: true` in `eas.json`) and not a release build with `expo start`.

## Inspecting logs

```bash
# EAS build log streaming
eas build:view <id> --logs

# Device logs (iOS)
xcrun simctl spawn booted log stream --predicate 'process == "MyApp"'

# Device logs (Android)
adb logcat -v color
adb logcat *:E ReactNative:V ReactNativeJS:V
```

## When all else fails

```bash
# Verify config + deps
npx expo-doctor

# Reinstall everything
rm -rf node_modules ios android
npx expo install
npx expo prebuild --clean

# Force-clear Metro and Watchman
npx expo start -c
watchman watch-del-all
```

If a build was working yesterday and isn't today, check:

- A dependency installed `latest` instead of the SDK-compatible version
- An external service (Apple, Google, FCM) credential expired
- macOS / Xcode auto-updated and changed the toolchain
