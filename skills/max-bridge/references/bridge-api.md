# MAX Bridge — Consolidated API Reference

This file is our consolidated quick-reference index. Authoritative upstream content is in [upstream/bridge.md](upstream/bridge.md) — open that for verbatim text. This file is for quick navigation by capability.

Every entry below is verified against the fetched upstream page (2026-05-16). If a method is not listed here, it is not documented upstream — do not invent it.

## Object model

```
window.WebApp
├── initData              (string)
├── initDataUnsafe        (MaxInitData; for display only)
├── platform              ('ios' | 'android' | 'desktop' | 'web')
├── version               (string, e.g. '25.9.16')
├── requestScreenMaxBrightness()
├── restoreScreenBrightness()
├── requestContact()
├── enableClosingConfirmation()
├── disableClosingConfirmation()
├── openLink(url)
├── openMaxLink(url)
├── downloadFile(url, file_name)
├── shareContent(params)
├── shareMaxContent(params)
├── openCodeReader(fileSelect?)
├── ScreenCapture.{enableScreenCapture, disableScreenCapture}
├── BackButton.{show, hide, isVisible, onClick, offClick}
├── DeviceStorage.{setItem, getItem, removeItem, clear}
├── SecureStorage.{setItem, getItem, removeItem, clear}
├── BiometricManager.{init, isInited, isBiometricAvailable, isAccessRequested,
│                     isAccessGranted, isBiometricTokenSaved, biometricType,
│                     deviceId, requestAccess, authenticate,
│                     updateBiometricToken, openSettings}
├── HapticFeedback.{impactOccurred, notificationOccurred, selectionChanged}
└── NfcManager.{init, isInited, openSystemSettings, emulateNfcTag}
```

## Capability matrix

| Capability | Method(s) | Platforms supported |
|---|---|---|
| Init data (raw string) | `initData` | all |
| Init data (parsed object — UNSAFE) | `initDataUnsafe` | all |
| Platform / version detection | `platform`, `version` | all |
| Max screen brightness (30 s) | `requestScreenMaxBrightness`, `restoreScreenBrightness` | all |
| Screen-capture toggle | `ScreenCapture.enableScreenCapture / disableScreenCapture` | all (mobile-meaningful) |
| Phone number request | `requestContact` | all |
| Closing confirmation | `enableClosingConfirmation / disableClosingConfirmation` | all |
| Open external URL | `openLink(url)` | all |
| Open MAX deep-link | `openMaxLink(url)` | all |
| Download HTTPS file | `downloadFile(url, file_name)` | all |
| Native share sheet | `shareContent({text?, link?})` | iOS, Android (NOT web) |
| In-MAX share to chat | `shareMaxContent({text?, link?} \| {mid, chatType})` | all |
| QR / code reader | `openCodeReader(fileSelect=true)` | all |
| Back button (header) | `BackButton.*` | all |
| Device storage (k/v) | `DeviceStorage.*` | iOS, Android, desktop (NOT web) |
| Secure encrypted storage | `SecureStorage.*` (10-key limit per bot/user) | iOS, Android, desktop (NOT web) |
| Biometry (TouchID / FaceID) | `BiometricManager.*` | iOS, Android only |
| Haptic feedback | `HapticFeedback.*` | iOS, Android only |
| NFC tag emulation | `NfcManager.*` | Android only |

> Treat **«Не поддерживается»** in the upstream docs as a hard guarantee that the Promise will reject. Always wrap optional capabilities in a platform check.

## Init data shape

```typescript
interface InitData {
  query_id: string;       // unique session ID
  ip?: string;            // user IP
  auth_date: number;      // Unix seconds — drives TTL
  hash: string;           // server-side validation handle
  user: {
    id: number;
    first_name: string;
    last_name: string;
    username: string;
    language_code: string;
    photo_url: string;
  };
  chat: {
    id: number;
    type: 'DIALOG' | 'CHAT' | 'CHANNEL';
  };
  start_param: string;    // value of ?startapp=... in launch URL
}
```

The Web Launch URL fragment carries three top-level keys:

- `WebAppData` — the URL-encoded payload validated by `hash` (this is what `initData` mirrors).
- `WebAppPlatform` — same as `platform`.
- `WebAppVersion` — same as `version` (NOT part of the hash).

## Error shape

Most Promise methods reject with:

```typescript
{ error: { code: string } }
```

Upstream does NOT publish a list of error codes — handle `error.code` as an opaque string, log it, and present a generic «not supported / unavailable» message to the user.

## Common usage patterns

### Capability check before call

```typescript
const wa = window.WebApp;
if (wa && wa.platform !== 'web') {
  await wa.HapticFeedback.impactOccurred('light');
}
```

### Two-step biometry

```typescript
const info = await wa.BiometricManager.init();
if (!info.available) return; // no hardware

if (!info.accessGranted) {
  const granted = await wa.BiometricManager.requestAccess('Sign in');
  if (!granted.accessGranted) return;
}

const { token } = await wa.BiometricManager.authenticate('Confirm payment');
```

### Share via bot-uploaded media

```typescript
// Backend: bot uploaded a file via Bot API POST /messages — got back { mid }
// Frontend: share that mid into a chat
await wa.shareMaxContent({ mid, chatType: 'CHAT' });
```

### Back button lifecycle

```typescript
const onBack = () => {
  // Custom navigation logic
  history.back();
};

wa.BackButton.onClick(onBack);
wa.BackButton.show();

// On unmount:
wa.BackButton.offClick(onBack);
wa.BackButton.hide();
```

> Always keep a reference to the callback so you can pass the same function to `offClick`. Anonymous functions cannot be unsubscribed.

## What is NOT in the API surface (verified 2026-05-16)

These are common Mini App capabilities present in VK Bridge / Telegram WebApp but **not documented** on dev.max.ru as of fetch date — do not assume they exist:

- Theme parameters / colors (`themeParams`, `colorScheme`, dark mode signals)
- Viewport / safe area events (`viewportChanged`, `safeAreaInsets`)
- Main / secondary button (`MainButton`, `SecondaryButton`)
- Settings button or `SettingsButton.show()`
- Cloud storage (multi-device synced storage)
- Geolocation request
- Native popups (`showPopup`, `showConfirm`, `showAlert`)
- Payments / invoices
- `sendData` to bot from inline keyboard
- Event subscription bus (`onEvent('themeChanged', ...)`)

If a project requires any of the above, treat them as unsupported and design alternative UX. Re-check upstream on each new release of the skill.

(verified 2026-05-16 against dev.max.ru — may change)
