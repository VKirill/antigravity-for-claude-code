# Setup — MAX Bridge in a Mini App

Practical bootstrap for a MAX mini-app frontend. Upstream source: `upstream/bridge.md` («Подключение библиотеки»).

## 1. CDN script tag

MAX Bridge is **CDN-only** — there is no public npm package as of the fetch date. Include via plain `<script>`:

```html
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>My MAX Mini App</title>
    <script src="https://st.max.ru/js/max-web-app.js"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

> The script must be loaded BEFORE your application bundle reads `window.WebApp`. Inline it in `<head>` (not deferred) so `window.WebApp` is available synchronously when your bundle runs.

## 2. Type declarations

Since the library is not published to npm, declare the surface yourself. Place this in `src/types/max-webapp.d.ts`:

```typescript
declare global {
  interface Window {
    WebApp: MaxWebApp;
  }
}

type MaxPlatform = 'ios' | 'android' | 'desktop' | 'web';
type MaxChatType = 'DIALOG' | 'CHAT' | 'CHANNEL';

export interface MaxInitData {
  query_id: string;
  ip?: string;
  auth_date: number;
  hash: string;
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
    type: MaxChatType;
  };
  start_param: string;
}

export interface MaxBridgeError {
  error: { code: string };
}

export interface MaxWebApp {
  readonly initData: string;
  readonly initDataUnsafe: MaxInitData;
  readonly platform: MaxPlatform;
  readonly version: string;

  requestScreenMaxBrightness(): Promise<{ maxBrightness: boolean }>;
  restoreScreenBrightness(): Promise<{ maxBrightness: boolean }>;
  ScreenCapture: {
    enableScreenCapture(): Promise<{ isScreenCaptureEnabled: boolean }>;
    disableScreenCapture(): Promise<{ isScreenCaptureEnabled: boolean }>;
  };

  requestContact(): Promise<{ phone: string }>;

  enableClosingConfirmation(): void;
  disableClosingConfirmation(): void;

  openLink(url: string): void;
  openMaxLink(url: string): void;

  downloadFile(url: string, file_name: string): Promise<{ status: 'downloading' | 'cancelled' }>;

  shareContent(params: { text?: string; link?: string }): Promise<{ status: 'shared' | 'cancelled' }>;
  shareMaxContent(
    params: { text?: string; link?: string } | { mid: string; chatType: 'DIALOG' | 'CHAT' },
  ): Promise<{ status: 'shared' | 'cancelled' }>;

  openCodeReader(fileSelect?: boolean): Promise<{ value: string }>;

  BackButton: {
    show(): void;
    hide(): void;
    readonly isVisible: boolean;
    onClick(callback: () => void): void;
    offClick(callback: () => void): void;
  };

  DeviceStorage: {
    setItem(key: string, value: string): Promise<{ status: 'updated' | 'removed' }>;
    getItem(key: string): Promise<{ key: string; value: string }>;
    removeItem(key: string): Promise<{ status: 'updated' | 'removed' }>;
    clear(): void;
  };

  SecureStorage: {
    setItem(key: string, value: string): Promise<{ status: 'updated' | 'removed' }>;
    getItem(key: string): Promise<{ key: string; value: string }>;
    removeItem(key: string): Promise<{ status: 'updated' | 'removed' }>;
    clear(): void;
  };

  BiometricManager: {
    init(): Promise<MaxBiometryInfo>;
    readonly isInited: boolean;
    readonly isBiometricAvailable: boolean;
    readonly isAccessRequested: boolean;
    readonly isAccessGranted: boolean;
    readonly isBiometricTokenSaved: boolean;
    readonly biometricType: Array<'finger' | 'face' | 'unknown'>;
    readonly deviceId: string | null;
    requestAccess(reason?: string): Promise<MaxBiometryInfo>;
    authenticate(reason?: string): Promise<{ status: 'authorized'; token: string }>;
    updateBiometricToken(token?: string, reason?: string): Promise<{ status: 'updated' | 'removed' }>;
    openSettings(): Promise<{ status: 'opened' }>;
  };

  HapticFeedback: {
    impactOccurred(
      style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft',
      disableVibrationFallback?: boolean,
    ): Promise<{ status: 'impactOccured' }>;
    notificationOccurred(
      type: 'error' | 'success' | 'warning',
      disableVibrationFallback?: boolean,
    ): Promise<{ status: 'notificationOccured' }>;
    selectionChanged(disableVibrationFallback?: boolean): Promise<{ status: 'selectionChanged' }>;
  };

  NfcManager: {
    init(): Promise<MaxNfcInfo>;
    readonly isInited: boolean;
    openSystemSettings(): Promise<{ status: 'opened' }>;
    emulateNfcTag(nfctag?: string): Promise<{ status: 'scanned' | 'stopped' }>;
  };
}

export interface MaxBiometryInfo {
  available: boolean;
  type: Array<'finger' | 'face' | 'unknown'>;
  accessRequested: boolean;
  accessGranted: boolean;
  tokenSaved: boolean;
  deviceId: string | null;
}

export interface MaxNfcInfo {
  available: boolean;
  enabled: boolean;
  accessRevoked?: boolean;
}

export {};
```

> The status string `'impactOccured'` / `'notificationOccured'` is misspelled upstream (single `r`). Use the misspelling — that is the exact value the client returns.

## 3. Initialization — no explicit init required

Per upstream: «Объект создаётся с каждым запуском сервиса, предзагружает данные и не требует отдельной инициализации». You do NOT call an init method for the top-level bridge. Just access `window.WebApp` after script load.

> Exception: `BiometricManager` and `NfcManager` DO require a one-time `init()` call before any other method.

## 4. Environment detection

Two cases to handle gracefully:

1. **Outside MAX** (developer browser): `window.WebApp` is undefined.
2. **Inside MAX**: `window.WebApp` exists; `platform` is one of `ios | android | desktop | web`.

```typescript
export function getWebApp(): MaxWebApp | null {
  return typeof window !== 'undefined' && window.WebApp ? window.WebApp : null;
}

export function isMaxEnvironment(): boolean {
  return getWebApp() !== null;
}

export function requireWebApp(): MaxWebApp {
  const wa = getWebApp();
  if (!wa) {
    throw new Error('MAX Bridge not loaded. This page must be opened inside the MAX client.');
  }
  return wa;
}
```

> Capability checks for storage / biometry / NFC / haptic / native share: upstream marks these as «Не поддерживается веб-клиентом» — so even when `window.WebApp` exists, you must additionally check `webApp.platform !== 'web'` before calling those methods, or you risk a rejected Promise.

## 5. Pass `initData` to your backend

The `initData` string is **the only safe handle on user identity**. Send it on every authenticated request — most teams attach it as a header:

```typescript
async function maxFetch(input: RequestInfo, init: RequestInit = {}): Promise<Response> {
  const wa = requireWebApp();
  const headers = new Headers(init.headers);
  headers.set('X-Max-InitData', wa.initData);
  return fetch(input, { ...init, headers });
}
```

> Do NOT cache `initData` in `localStorage`. It contains an `auth_date` and is meant to be re-validated on each request with a short TTL (see `recommended-defaults.md`).

## 6. Framework integration

For React 19, Vue 3.5, Nuxt 4, Next.js 16 — treat the bridge as a side-effect-free module that is initialized once and accessed via a thin hook. Example for React:

```tsx
import { useEffect, useState } from 'react';
import { getWebApp, type MaxWebApp } from './max-webapp';

export function useMaxWebApp(): MaxWebApp | null {
  const [wa, setWa] = useState<MaxWebApp | null>(() => getWebApp());
  useEffect(() => {
    // Script may load after first render in dev — re-check after mount.
    if (!wa) setWa(getWebApp());
  }, [wa]);
  return wa;
}
```

For Server Components / SSR: nothing on `window.WebApp` is accessible server-side. Push all bridge interactions into client components.

## 7. Local development workflow

Because the bridge is CDN-only and the user identity comes from the MAX client, local dev requires either:

- Running the mini-app inside the MAX client against an HTTPS tunnel (ngrok, cloudflared, localtunnel) and a real bot bound in MAX для партнёров.
- Stubbing `window.WebApp` in dev — but never bypass server-side validation. The stub gives you UI iteration; identity remains untrustable until validated by your backend against a real `initData`.

A minimal stub for UI iteration:

```typescript
if (import.meta.env.DEV && !window.WebApp) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).WebApp = {
    initData: '',
    initDataUnsafe: {
      query_id: 'dev-query',
      auth_date: Math.floor(Date.now() / 1000),
      hash: '',
      user: {
        id: 1,
        first_name: 'Dev',
        last_name: 'User',
        username: 'dev',
        language_code: 'ru',
        photo_url: '',
      },
      chat: { id: 1, type: 'DIALOG' },
      start_param: '',
    },
    platform: 'web',
    version: '0.0.0',
  };
}
```
