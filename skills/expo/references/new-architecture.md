# New Architecture on RN 0.85

In React Native 0.85 the New Architecture is **the default for all new projects** and the supported path for existing ones. Three pieces:

- **Fabric** — the new C++ renderer; concurrent-rendering compatible, synchronous layout, no shadow-tree bridge
- **TurboModules** — lazy-loaded native modules with a typed JSI interface; replaces the old NativeModules bridge
- **Bridgeless mode** — removes the legacy JSON bridge entirely; native ↔ JS communication is JSI calls

Hermes is the default JS engine and recommended for both architectures.

## Detecting the architecture

```ts
import { isFabricEnabled, isBridgeless } from 'react-native';

console.log(isFabricEnabled(), isBridgeless()); // both true on 0.85 defaults
```

## Project flags

In `app.config.ts` (Expo controls these — don't edit `gradle.properties` by hand):

```ts
expo: {
  newArchEnabled: true, // default on SDK 55 / RN 0.85; can be set false but discouraged
}
```

When `newArchEnabled` is unset on SDK 55, the value is `true`. Setting it `false` is an opt-out and only valid while the project waits on a non-converted dependency.

For bare projects, the equivalent Gradle and Podfile flags are set by `npx expo prebuild`.

## Library compatibility

Most actively-maintained native libraries support the New Architecture by RN 0.85. Verify before adding any native dep:

1. Check the library's README for `newArchEnabled` / "Fabric" / "TurboModule" notes
2. Look for `codegenConfig` in its `package.json` (TurboModule spec)
3. Search the directory at https://reactnative.directory and filter by "New Architecture"

If a critical library hasn't migrated, options:

- File an issue / submit a PR
- Vendor a fork using the Expo Modules API as a wrapper
- Defer to a Paper-only release (set `newArchEnabled: false`) — last resort

## Behavioural differences vs legacy

| Area | Legacy (Paper) | New Architecture |
|---|---|---|
| Render | shadow tree on a JS thread, diffed to UIManager | Fabric C++ renderer, synchronous layout |
| Native modules | Eager-load via `NativeModules` | Lazy via JSI / TurboModule registry |
| Layout | Async via the bridge | Synchronous (no flash of unstyled layout) |
| Communication | JSON bridge | Direct JSI calls |
| Concurrent React | Limited | Full support (Suspense, transitions) |

The most visible app-level differences:

- **`measure`** and `findNodeHandle` results return synchronously — no race on first paint
- `onLayout` events batch by default — listeners that assumed a separate event per child may need to deduplicate
- `useLayoutEffect` timing aligns with Fabric's commit phase — fewer "flicker" classes of bugs
- React 19 features (`use(promise)`, `useOptimistic`) work as documented

## Common migration gotchas on RN 0.85

- **`react-native-reanimated` ≥ 4** is required for full New-Arch support. The babel plugin must be **last** in `babel.config.js`'s plugin list.
- **`react-native-gesture-handler` ≥ 2.x** with `GestureHandlerRootView` at the root layout
- **`react-native-screens`** must be enabled (it is, by default, via expo-router) for native stack performance
- **`react-native-skia`** needs a New-Arch-compatible release; older versions crash at startup
- **`react-native-svg`** has a Fabric-only build; check the version pinned by `expo install`

If you migrate an existing app:

```bash
npx expo install --check
npx expo-doctor
npx expo prebuild --clean
```

`expo-doctor` flags packages without TurboModule support and version drift.

## Bridgeless mode

Bridgeless removes the legacy JSON bridge entirely. The only practical impact:

- `NativeModules.<X>` access still works (TurboModule shim translates), but direct legacy access patterns (e.g., adding to `NativeModules` from outside) won't work
- Inline native calls that previously serialised through the bridge now run on the calling thread via JSI — performance improves, but anything assuming async serialisation needs review

The flag is implicit on RN 0.85; you don't toggle bridgeless separately.

## Codegen for native modules

TurboModules use codegen to derive a typed C++ spec from the JS interface. For your own modules:

```json
// package.json (of the native module)
{
  "codegenConfig": {
    "name": "RNMyModule",
    "type": "modules",
    "jsSrcsDir": "./src"
  }
}
```

The Expo Modules API does this for you — `requireNativeModule('Name')` is the JSI bridge.

## Performance notes

- App start improves notably (TurboModules don't all load eagerly)
- List perf depends on `FlatList`/`FlashList` — `react-native-fabric` `Pressable` is on the JS thread by default; use `Pressable` from React Native, not third-party wrappers, when possible
- Concurrent React features work but Suspense boundaries in async-heavy screens need explicit fallbacks; cold-launch can otherwise show empty frames

## Anti-patterns

- Setting `newArchEnabled: false` to silence a runtime error — usually masks a library compat bug; report it instead
- Editing `ios/Podfile` or `android/gradle.properties` to tweak New-Arch flags in a managed project — use `app.config.ts` and a plugin
- Mixing `react-native-reanimated@3.x` with New Arch — crashes at runtime
- Calling `findNodeHandle` from JS expecting the old async timing — synchronous now
- Assuming legacy `NativeModules.<X>` registration code still works — third-party native code must use the TurboModule path
- Skipping `npx expo-doctor` after a dep bump — catches New-Arch incompatibilities before a build fails
