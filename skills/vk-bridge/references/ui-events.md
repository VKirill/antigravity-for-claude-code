# UI events — theme, viewport, chrome

The VK client controls the chrome (status bar, swipe-back, theme). Your Mini App reacts via subscribe events and sets chrome state via send methods.

## `VKWebAppUpdateConfig` — the most important event

Fired whenever the host changes theme, viewport, or insets. Subscribe early.

```ts
import bridge from '@vkontakte/vk-bridge';

bridge.subscribe((event) => {
  if (event.detail?.type !== 'VKWebAppUpdateConfig') return;
  const data = event.detail.data;
  // data: {
  //   appearance: 'light' | 'dark';
  //   scheme: 'bright_light' | 'space_gray' | 'vkcom_light' | 'vkcom_dark' | ...;
  //   app: 'vkclient' | 'vkme' | 'vkcom' | ...;
  //   app_id: number;
  //   viewport_width: number;
  //   viewport_height: number;
  //   insets?: { top, right, bottom, left };  // safe area for notch / nav bar
  //   start_time: number;
  // }
  document.documentElement.dataset.theme = data.appearance;
});
```

To get the current config immediately on load:

```ts
const config = await bridge.send('VKWebAppGetConfig');
// Same shape as the VKWebAppUpdateConfig event data
```

## React: `useAppearance` and `useInsets`

The official React companion handles subscription + cleanup for you:

```tsx
import { useAppearance, useInsets } from '@vkontakte/vk-bridge-react';

function App() {
  const appearance = useAppearance(); // 'light' | 'dark' | null
  const insets = useInsets();         // { top, bottom, left, right } | null

  return (
    <div
      data-theme={appearance ?? 'light'}
      style={{
        paddingTop: insets?.top ?? 0,
        paddingBottom: insets?.bottom ?? 0,
        minHeight: '100vh',
        background: appearance === 'dark' ? '#19191a' : '#fff',
        color:      appearance === 'dark' ? '#e1e3e6' : '#000',
      }}
    >
      {/* ... */}
    </div>
  );
}
```

Both hooks return `null` when not running embedded (`bridge.isEmbedded()` is `false`) — fall back to a sensible default.

## Theme fallback when standalone

```ts
function detectTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
```

In the React tree: `const appearance = useAppearance() ?? detectTheme();`.

## `VKWebAppSetViewSettings` — status bar

```ts
await bridge.send('VKWebAppSetViewSettings', {
  status_bar_style: 'dark',          // 'light' | 'dark' — content color, not background
  action_bar_color: '#1c1c1e',       // background color of the iOS status bar area
  navigation_bar_color: '#1c1c1e',   // Android nav bar background
});
```

`status_bar_style: 'dark'` means "use dark icons" — appropriate over a light background. Reverse for dark backgrounds.

Re-emit this on every theme change to keep the chrome in sync with your app.

## Swipe-back control (iOS)

iOS users can swipe from the left edge to dismiss the Mini App. If you have a custom router with its own back gesture, disable the system one to avoid conflicts.

```ts
await bridge.send('VKWebAppDisableSwipeBack');
// later, when on the root screen
await bridge.send('VKWebAppEnableSwipeBack');
```

Best practice: enable swipe-back on the root screen, disable on deeper navigation.

## Scroll control

```ts
// Scroll to a specific Y inside the Mini App viewport
await bridge.send('VKWebAppScroll', { top: 0, speed: 200 });
```

`speed` is animation duration in ms; pass `0` for instant.

## `VKWebAppResizeWindow` (desktop / iframe)

On desktop, the iframe has a fixed default size. Resize it to fit content:

```ts
await bridge.send('VKWebAppResizeWindow', { width: 720, height: 900 });
```

Mobile WebView ignores width — only height applies (and only up to platform limits).

## `VKWebAppLocationChanged`

If you push hash routes (`window.location.hash = '#feed'`), the client sees them and can preserve state. The reverse event lets you react when the user navigates back via host UI.

```ts
bridge.subscribe((event) => {
  if (event.detail?.type === 'VKWebAppLocationChanged') {
    const newHash = event.detail.data.location;
    // Sync your router
  }
});
```

## View lifecycle — `VKWebAppViewHide` / `VKWebAppViewRestore`

Mobile clients can put your Mini App in the background (user switches tabs, gets a call). You receive lifecycle events:

```ts
bridge.subscribe((event) => {
  const type = event.detail?.type;
  if (type === 'VKWebAppViewHide') {
    // Pause audio, video, expensive timers
  } else if (type === 'VKWebAppViewRestore') {
    // Resume; revalidate stale data
  }
});
```

Pair with `document.visibilityState` for full coverage — on web iframe the latter is the primary signal.

## Pitfalls

- **Don't call `VKWebAppSetViewSettings` before `VKWebAppInit`** — the call hangs.
- **Insets are not always present** — `data.insets` is undefined on older clients. Default to `0`.
- **`viewport_height` ≠ `window.innerHeight`** on some platforms (keyboard, browser chrome). Prefer the event value for full-screen layouts.
- **`appearance` only — not `scheme`** for high-level theming. `scheme` is the granular VK design token set; map it to your design system only if you actually use VKUI.
