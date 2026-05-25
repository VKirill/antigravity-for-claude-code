# Setup — install, init, runtime detection

## Install

```bash
npm install @vkontakte/vk-bridge
# optional React hook helpers
npm install @vkontakte/vk-bridge-react
```

ESM default import:

```ts
import bridge from '@vkontakte/vk-bridge';
```

For a plain `<script>` page (rare — most Mini Apps bundle):

```html
<script src="https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js"></script>
<script>
  // exposes window.vkBridge
  vkBridge.send('VKWebAppInit');
</script>
```

## Initialize

`VKWebAppInit` is the handshake. Without it the host client does not register your Mini App as active and some events stop arriving. Call it **once, as early as possible**, before any other bridge method.

```ts
import bridge from '@vkontakte/vk-bridge';

async function bootstrap() {
  try {
    await bridge.send('VKWebAppInit');
  } catch (err) {
    // Not running inside VK client (standalone dev mode, or sandbox blocked the call)
    console.warn('VK Bridge init failed — running in standalone mode', err);
  }
  // ...mount React, fetch profile, etc.
}

bootstrap();
```

`VKWebAppInit` itself accepts no parameters and resolves to `{ result: true }` on success.

## Runtime detection

```ts
bridge.isEmbedded();  // true inside VK client (iframe / WebView)
bridge.isIframe();    // true specifically for web iframe runtime
bridge.isWebView();   // true on iOS/Android WebView
```

Use these to fork UX:

```ts
if (!bridge.isEmbedded()) {
  // Standalone dev/browser — show a "open in VK" CTA + mock data
  return <StandaloneFallback />;
}
```

## Feature detection — `supports` and `supportsAsync`

Different platforms (iOS WebView, Android WebView, web iframe, desktop) expose different method subsets. Always probe before calling an optional capability.

```ts
// Synchronous — best-effort, returns immediately
if (bridge.supports('VKWebAppShowStoryBox')) {
  await bridge.send('VKWebAppShowStoryBox', { /* ... */ });
}

// Async — round-trips to the client; more authoritative for some methods
if (await bridge.supportsAsync('VKWebAppOpenCodeReader')) {
  await bridge.send('VKWebAppOpenCodeReader', {});
}
```

`supports` is best-effort and may return `true` for a method the platform actually rejects at call time. Always wrap the `send` in try/catch.

## Typed wrapper pattern

A thin wrapper centralizes feature detection and typing:

```ts
import bridge from '@vkontakte/vk-bridge';

type SafeSend = <M extends Parameters<typeof bridge.send>[0]>(
  method: M,
  params?: Parameters<typeof bridge.send>[1],
) => Promise<Awaited<ReturnType<typeof bridge.send>> | null>;

export const safeSend: SafeSend = async (method, params) => {
  if (!bridge.supports(method as string)) return null;
  try {
    return await bridge.send(method as any, params as any);
  } catch (err) {
    console.warn(`[vk-bridge] ${String(method)} failed`, err);
    return null;
  }
};
```

## Subscribe to client → app events

`bridge.subscribe(handler)` registers a listener that receives every event the client pushes (theme changes, viewport changes, geolocation results, QR scan results, etc.).

```ts
import bridge from '@vkontakte/vk-bridge';

const off = bridge.subscribe((event) => {
  if (!event.detail) return;
  const { type, data } = event.detail;
  switch (type) {
    case 'VKWebAppUpdateConfig':
      console.log('appearance =', data.appearance); // 'light' | 'dark'
      break;
    case 'VKWebAppLocationChanged':
      console.log('hash =', data.location);
      break;
  }
});

// Later — clean up
off();
```

In React, prefer the dedicated hooks (`useAppearance`, `useInsets`) from `@vkontakte/vk-bridge-react` rather than subscribing manually inside an effect.

## Middleware (advanced)

`applyMiddleware` wraps `send`/`subscribe` for cross-cutting concerns (logging, retries, telemetry):

```ts
import bridge, { applyMiddleware } from '@vkontakte/vk-bridge';

const logger = ({ send }: any) => (next: any) => async (method: string, props: unknown) => {
  const start = performance.now();
  try {
    const result = await next(method, props);
    console.debug('[bridge]', method, 'ok in', performance.now() - start, 'ms');
    return result;
  } catch (err) {
    console.error('[bridge]', method, 'failed', err);
    throw err;
  }
};

export const enhancedBridge = applyMiddleware(logger)(bridge);
```

## Bundler quirks

- **Vite / Next.js**: import works out of the box. No SSR concerns — the bridge is browser-only; gate calls behind `typeof window !== 'undefined'` (or `'use client'` in Next App Router).
- **TypeScript**: `@vkontakte/vk-bridge` ships its own `.d.ts`. The `send` return type is a discriminated union keyed off the method name; you get autocomplete on the params + result.
- **CSP**: iframe Mini Apps load under VK's CSP. Your code can use any origin for `fetch`, but `frame-ancestors` is controlled by VK. WebSocket connections work normally.
