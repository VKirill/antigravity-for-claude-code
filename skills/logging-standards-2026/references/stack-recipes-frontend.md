# Frontend logging — browser

Different rules from backend. The browser is a hostile environment — your logs are visible to users (DevTools console), can leak via support-ticket screenshots, can ship with PII to telemetry.

## The four rules

1. **`console.log` only in development.** Build pipeline strips it from prod bundles.
2. **No secrets in client code, period.** If a secret is in the bundle, it's in every user's browser.
3. **Errors → Sentry (or alternative).** Not console.
4. **Behaviour analytics → PostHog / Mixpanel / Plausible.** Not logs.

## Stripping console.log in production

### Vite

```ts
// vite.config.ts
export default defineConfig({
  esbuild: {
    drop: ['console', 'debugger'],  // strips in prod build
  },
  // Or selective:
  // drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
});
```

### Next.js

```ts
// next.config.ts
const config = {
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error', 'warn'] }    // keep error/warn for Sentry breadcrumbs
      : false,
  },
};
export default config;
```

### Webpack

```ts
// webpack.config.js — terser plugin
optimization: {
  minimizer: [
    new TerserPlugin({
      terserOptions: { compress: { drop_console: true, drop_debugger: true } },
    }),
  ],
}
```

### Vue / Nuxt

Same as Vite (uses esbuild) or via `nuxt.config.ts` terser settings.

## A thin frontend logger

```ts
// src/lib/log.ts
type Level = 'debug' | 'info' | 'warn' | 'error';

const isDev = import.meta.env.DEV;
const LEVEL_ORDER: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const MIN: Level = isDev ? 'debug' : 'warn';

function emit(level: Level, msg: string, fields?: Record<string, unknown>) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN]) return;

  if (isDev) {
    // Dev: pretty console
    console[level === 'debug' ? 'log' : level](`[${level}]`, msg, fields ?? '');
  } else {
    // Prod: send error+warn to Sentry; everything else dropped (console stripped at build)
    if (level === 'error' || level === 'warn') {
      import('@sentry/browser').then(({ captureMessage }) => {
        captureMessage(msg, { level, extra: fields });
      });
    }
  }
}

export const log = {
  debug: (msg: string, fields?: Record<string, unknown>) => emit('debug', msg, fields),
  info:  (msg: string, fields?: Record<string, unknown>) => emit('info',  msg, fields),
  warn:  (msg: string, fields?: Record<string, unknown>) => emit('warn',  msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => emit('error', msg, fields),
};
```

## Errors → Sentry

See [../templates/sentry-init.template](../templates/sentry-init.template) for full setup.

Minimum:

```ts
// src/sentry.ts
import * as Sentry from '@sentry/browser';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  release: import.meta.env.VITE_RELEASE,   // 'app@1.2.3' for source map matching
  tracesSampleRate: 0.1,                    // 10% of transactions
  replaysSessionSampleRate: 0,              // off by default; high cost
  replaysOnErrorSampleRate: 1.0,            // 100% for errors

  // PII discipline
  sendDefaultPii: false,                    // do NOT auto-capture user IP/cookies
  beforeSend(event) {
    // Strip any field that might contain PII
    return scrubSensitive(event);
  },
});

// Optional: identify user (be careful with PII)
export function identifyUser(id: string) {
  Sentry.setUser({ id });   // ONLY id; no email/name unless you have consent
}
```

## Source maps

Sentry can show original source code in stack traces if source maps uploaded. CRITICAL: source maps must NOT be served to users (reveals code). Either:

1. Upload via build step, then exclude from production assets:
   ```bash
   sentry-cli sourcemaps upload --release "app@$VERSION" dist/
   rm dist/**/*.map  # delete before deploy
   ```
2. Or serve maps from a private endpoint requiring Sentry-only auth.

## React error boundary → Sentry

```tsx
import { ErrorBoundary } from '@sentry/react';

<ErrorBoundary fallback={<div>Something went wrong</div>}>
  <App />
</ErrorBoundary>
```

Or manually:

```tsx
class AppErrorBoundary extends React.Component {
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }
  render() { return this.state.hasError ? <ErrorUI/> : this.props.children; }
}
```

## Vue error handler

```ts
import { createApp } from 'vue';
import * as Sentry from '@sentry/vue';

const app = createApp(App);
Sentry.init({ app, /* config */ });
```

## Unhandled rejection / global errors

```ts
window.addEventListener('error', (event) => {
  Sentry.captureException(event.error);
});
window.addEventListener('unhandledrejection', (event) => {
  Sentry.captureException(event.reason);
});
```

@sentry/browser does this automatically on init.

## Breadcrumbs (context for errors)

Breadcrumbs = ordered list of events leading to an error. Auto-captured by Sentry: console.log, network requests, navigation, clicks. Plus you can add manually:

```ts
Sentry.addBreadcrumb({
  category: 'auth',
  message: 'User logged in',
  level: 'info',
  data: { method: 'oauth' },
});
```

Don't add breadcrumb for every action; auto-captured ones + key business steps are enough.

## Analytics (not the same as logging)

For "user clicked X" / "user completed flow Y" use a dedicated analytics tool:

| Tool | Best for |
|---|---|
| PostHog (self-hosted or cloud) | All-in-one: events, session replay, feature flags |
| Mixpanel | Product analytics, funnels, retention |
| Plausible / Umami | Privacy-friendly, page views + basic events |
| GA4 / Yandex.Metrika | Web traffic + conversion |

These are NOT logs. Don't pipe them through your error-tracking. Don't try to make Sentry do analytics.

## Don'ts

- ❌ `console.log(user)` where `user` includes email/token
- ❌ Shipping `console.log('DEBUG: ...')` to production
- ❌ Sentry init with `sendDefaultPii: true` (sends user IP, cookies, etc.)
- ❌ Including secrets in env vars exposed to client (`VITE_*` / `NEXT_PUBLIC_*` are PUBLIC)
- ❌ Logging request body in client-side handlers
- ❌ Serving `.map` files publicly to users
- ❌ Replaying every session with Sentry Session Replay (cost + privacy)

## Verifying the strip works

```bash
# Build prod
npm run build
# Grep for console.log in build output (should find nothing or only in vendor chunks with their own console)
grep -rn "console\.log" dist/
```

If found in your app code → strip not configured.

## What to log on the client

The minimum useful set:

| Event | Why |
|---|---|
| Unhandled errors | Sentry auto |
| Failed network requests (4xx/5xx) | Manual via fetch wrapper → Sentry breadcrumb |
| Auth state changes (sign-in/out) | Analytics + Sentry user identify |
| Critical UI errors (form failed, save failed) | Analytics for "feature broken for users" signal |
| Feature flag exposures | Analytics for A/B test |

What NOT to log on the client:

- Every state mutation (use Redux DevTools / Vue DevTools instead)
- Every render (React Profiler)
- Every keystroke (creepy + huge volume)
- API responses with PII

## Final checklist

- [ ] Build strips console.log + debugger in prod
- [ ] Sentry initialized with PII off
- [ ] Source maps uploaded but not served publicly
- [ ] Breadcrumbs configured (or default Sentry breadcrumbs sufficient)
- [ ] Error boundary at app root
- [ ] Analytics separate from error tracking
- [ ] No `VITE_*` / `NEXT_PUBLIC_*` env contains a secret
- [ ] User identified by ID only, not email/name
