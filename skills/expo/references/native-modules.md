# Native Modules and Config Plugins

Two complementary layers:

- **Expo Modules API** — write Swift/Kotlin and expose it to JS via declarative DSL. Lives under `modules/<name>/`.
- **Config plugins** — Node functions that mutate native files (Info.plist, AndroidManifest, Gradle, Podfile) at prebuild. Live under `plugins/` or as npm packages.

Most third-party native libraries ship with their own config plugin; you write your own when adding org-specific native code.

## Local Expo module

```bash
npx create-expo-module@latest --local
# prompts for name, e.g. my-module
```

Result:

```
modules/my-module/
├── expo-module.config.json
├── android/
│   └── src/main/java/expo/modules/mymodule/MyModule.kt
├── ios/
│   └── MyModule.swift
├── src/
│   └── index.ts
└── package.json
```

### Swift module

```swift
// modules/my-module/ios/MyModule.swift
import ExpoModulesCore

public class MyModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MyModule")

    Constants(["PI": Double.pi])

    Function("hello") { (name: String) -> String in
      return "Hello, \(name)"
    }

    AsyncFunction("greet") { (name: String, promise: Promise) in
      DispatchQueue.global().async {
        promise.resolve("Hello, \(name)")
      }
    }

    Events("onChange")
  }
}
```

### Kotlin module

```kotlin
// modules/my-module/android/src/main/java/expo/modules/mymodule/MyModule.kt
package expo.modules.mymodule

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MyModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MyModule")

    Constants("PI" to Math.PI)

    Function("hello") { name: String ->
      "Hello, $name"
    }

    AsyncFunction("greet") { name: String ->
      "Hello, $name"
    }

    Events("onChange")
  }
}
```

### JS binding

```ts
// modules/my-module/src/index.ts
import { requireNativeModule } from 'expo';

const MyModule = requireNativeModule('MyModule');

export function hello(name: string): string {
  return MyModule.hello(name);
}

export function greet(name: string): Promise<string> {
  return MyModule.greet(name);
}
```

After scaffolding, `npx expo run:ios` / `npx expo run:android` rebuilds and autolinks the module.

## Config plugins

A plugin is a function that takes the Expo config and returns it modified. Use the `with*` mods from `expo/config-plugins`.

### Inject an iOS Info.plist key + Android meta-data

```ts
// plugins/with-api-key.ts
import {
  withInfoPlist,
  withAndroidManifest,
  AndroidConfig,
  ConfigPlugin,
} from 'expo/config-plugins';

interface Props { apiKey: string }

const withApiKey: ConfigPlugin<Props> = (config, { apiKey }) => {
  config = withInfoPlist(config, (cfg) => {
    cfg.modResults['MY_API_KEY'] = apiKey;
    return cfg;
  });

  config = withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(app, 'MY_API_KEY', apiKey);
    return cfg;
  });

  return config;
};

export default withApiKey;
```

Reference it in app config:

```ts
// app.config.ts
export default {
  expo: {
    plugins: [
      ['./plugins/with-api-key', { apiKey: process.env.MY_API_KEY }],
    ],
  },
};
```

Apply:

```bash
npx expo prebuild --clean
```

### Common mods

| Mod | Target |
|---|---|
| `withInfoPlist` | `ios/<App>/Info.plist` |
| `withEntitlementsPlist` | `ios/<App>/<App>.entitlements` |
| `withAppDelegate` | `AppDelegate.swift` / `.mm` |
| `withPodfile` / `withPodfileProperties` | iOS CocoaPods |
| `withAndroidManifest` | `android/app/src/main/AndroidManifest.xml` |
| `withMainApplication` | `MainApplication.kt/.java` |
| `withMainActivity` | `MainActivity.kt/.java` |
| `withAppBuildGradle` / `withProjectBuildGradle` | Gradle scripts |
| `withGradleProperties` | `android/gradle.properties` |
| `withStringsXml` / `withColorsXml` | Android resources |
| `withDangerousMod` | Arbitrary file copy / write (escape hatch) |
| `withPlugins` | Compose multiple plugins |

### Plugin from npm

If a library ships `app.plugin.js` at its package root:

```ts
plugins: ['some-library', ['other-library', { foo: 'bar' }]]
```

The string form invokes the package's default plugin export.

### Validating a plugin

```bash
npx expo prebuild --clean --no-install
```

Inspect generated files under `ios/` and `android/`. Discard with `git restore` or `npx expo prebuild --clean` again from a clean state.

`expo-doctor` flags common plugin mistakes (missing dep, version mismatch).

## When to escape to bare workflow

Stay in managed/CNG when:

- Native customisation can be expressed as a config plugin
- You want EAS Build to manage native files

Switch to bare when:

- You need to vendor a long-term fork of a native library
- The project predates the Expo Modules API and you can't rewrite

To switch: `npx expo prebuild`, commit `ios/` and `android/`, stop running prebuild in CI. You keep the Expo SDK and EAS Build, but lose CNG.

## Anti-patterns

- Hand-editing generated `ios/` or `android/` files in a CNG project — wiped on next prebuild
- Writing a `withDangerousMod` when a typed mod exists — harder to maintain
- Forgetting to gate plugin behaviour on platform — use the second arg `(config, props) => …` and check `config.modName?.startsWith('ios')` inside `withDangerousMod`
- Skipping `npx expo prebuild --clean` after plugin changes in CI — stale native files survive
- Pinning native dependencies without using `npx expo install` — the SDK-incompatible version breaks autolinking
