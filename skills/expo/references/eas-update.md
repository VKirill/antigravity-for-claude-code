# EAS Update — Over-the-Air JS Patches

`expo-updates` + EAS Update ship JS bundles to installed apps without going through the store. Only the JS layer changes; native code requires a new binary.

## Install and enable

```bash
npx expo install expo-updates
eas update:configure
```

`eas update:configure` adds `expo-updates` plugin, sets `updates.url` to `https://u.expo.dev/<project-id>`, and writes a default `runtimeVersion`.

## Runtime version

The pairing key between a binary and an update. A device only applies updates whose `runtimeVersion` matches its embedded binary.

Three policies in `app.config.ts`:

| Policy | Behaviour |
|---|---|
| `"<literal>"` | Manual string. Bump it every time native deps change. |
| `{ policy: "appVersion" }` | Uses `expo.version`. Suitable when you bump version per release. |
| `{ policy: "nativeVersion" }` | Combines `version` with `buildNumber` / `versionCode`. |
| `{ policy: "fingerprint" }` | **Recommended.** Hashes native deps so the runtime version updates automatically. |

```ts
// app.config.ts
export default {
  expo: {
    runtimeVersion: { policy: 'fingerprint' },
    updates: { url: 'https://u.expo.dev/<project-id>' },
  },
};
```

With fingerprint policy, `eas-cli` computes the hash at build time and at update publish time. If they don't match, the update is rejected for that binary — preventing JS-native mismatches.

## Channels and branches

- **Channel** — a name assigned at build time (`channel: "production"` in `eas.json`). A binary subscribes to one channel.
- **Branch** — a stream of updates. Channels point to branches; the mapping is mutable via the EAS dashboard or `eas channel:edit`.

Typical mapping:

```
build profile  channel       branch (initial)
development → development → development
preview     → preview     → preview
production  → production  → production
```

Switching a channel to a different branch performs a controlled rollout.

## Publishing

```bash
# Publish to a branch
eas update --branch production --message "Fix sign-in copy"

# Auto-detect branch from git
eas update --auto

# Platform-scoped
eas update --branch production --platform ios
```

The update is downloaded on next app start (or in the background per `updates.checkAutomatically`).

## Rollback

Roll a channel back to the binary's embedded JS:

```bash
eas update:roll-back-to-embedded --branch production
```

Or republish an earlier update:

```bash
eas update:republish --branch production --group <update-group-id>
```

Rollouts can be staged with `--rollout-percentage 25` then bumped to 100 once verified.

## Client-side update flow

```tsx
import * as Updates from 'expo-updates';
import { useEffect } from 'react';

export function UpdateGate() {
  const { isUpdateAvailable, isUpdatePending } = Updates.useUpdates();

  useEffect(() => {
    if (isUpdatePending) Updates.reloadAsync();
  }, [isUpdatePending]);

  return null;
}
```

Or manual:

```ts
const result = await Updates.checkForUpdateAsync();
if (result.isAvailable) {
  await Updates.fetchUpdateAsync();
  await Updates.reloadAsync();
}
```

`Updates.reloadAsync()` rejects in Expo Go / dev mode — gate with `Updates.isEnabled`.

## Code signing

Production should sign updates so a compromised CDN cannot inject JS.

```bash
npx expo-updates codesigning:generate \
  --key-output-directory keys --certificate-output-directory certs \
  --certificate-validity-duration-years 10 --certificate-common-name "My App"

npx expo-updates codesigning:configure \
  --certificate-input-directory certs --key-input-directory keys
```

Publish with the private key:

```bash
eas update --branch production --private-key-path keys/private-key.pem
```

The public certificate is embedded in the binary; updates failing the signature check are discarded.

## Useful CLI commands

```bash
eas channel:list
eas channel:view production
eas channel:edit production --branch production-v2
eas branch:list
eas update:list --branch production
eas update:view <update-id>
```

## Environment variables in updates

`EXPO_PUBLIC_*` vars are inlined at build time, so a JS-only update can change them. Other env vars are read from the binary's snapshot.

## Anti-patterns

- Hand-setting `runtimeVersion` and forgetting to bump it after adding a native module — updates land on incompatible binaries
- Shipping an OTA that touches `app.config.ts` plugins — the change requires a new binary; the OTA will be silently ignored
- Mixing channel + branch concepts — channels are subscriptions; branches are streams
- Skipping code signing in production — a hijacked CDN can replace the JS bundle
- Calling `Updates.reloadAsync()` without a permission/UX gate — interrupts the user mid-task
- Publishing without `--auto` and forgetting `--branch` — the CLI errors but devs sometimes script around it
