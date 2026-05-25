# Error tracking — Sentry / Bugsnag / GlitchTip

Logs tell you what happened; error tracking surfaces what's currently broken with stack + frequency + affected users.

## Tool choice (2026)

| Tool | Hosting | Pricing | Notes |
|---|---|---|---|
| **Sentry** | Cloud or self-host | Generous free tier; pricey at scale | Industry standard, mature SDK for every stack |
| **GlitchTip** | Self-host | Free | Open-source, Sentry-API-compatible (use Sentry SDK) |
| **Bugsnag** | Cloud | Paid from day 1 | Strong mobile / RN support |
| **Highlight.io** | Cloud or self-host | Mid-tier | Session replay + errors + logs in one |
| **Rollbar** | Cloud | Paid | Older option, similar to Sentry |

For Kirill's solo / small-team setup: GlitchTip self-hosted (free, Sentry-API-compatible — use Sentry SDK and just point at your GlitchTip instance) or Sentry free tier.

## Backend (Node) setup

```ts
// instrument.ts — IMPORTED FIRST, before any other module
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.SERVICE_VERSION,   // 'api@1.2.3'
  tracesSampleRate: 0.1,                  // 10% transactions for perf
  profilesSampleRate: 0.1,                // 10% of those have profiles
  sendDefaultPii: false,                  // strict
  beforeSend(event, hint) {
    // Scrub before send
    return scrubSensitive(event);
  },
  integrations: [
    // Pino integration so logger.error() auto-creates Sentry events
    Sentry.pinoIntegration?.(/* opts */),
  ],
});
```

Then in `index.ts`:
```ts
import './instrument.js';
// ... rest of app
```

## Backend (Python) setup

```python
# sentry_setup.py
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
import os, logging

sentry_sdk.init(
    dsn=os.environ['SENTRY_DSN'],
    environment=os.environ.get('APP_ENV', 'development'),
    release=os.environ.get('SERVICE_VERSION'),
    traces_sample_rate=0.1,
    send_default_pii=False,
    integrations=[
        FastApiIntegration(),
        StarletteIntegration(),
        LoggingIntegration(level=logging.INFO, event_level=logging.ERROR),
    ],
    before_send=lambda event, hint: scrub_sensitive(event),
)
```

Import in your app entry before anything else.

## What to send

| Event | Send to Sentry? |
|---|---|
| Unhandled exception | ✅ auto (SDK catches process-level) |
| Caught exception during request processing | ✅ via `Sentry.captureException(err)` |
| Logger.error()  | Auto via logging integration |
| Logger.warn() | Usually no (alerting noise) |
| Logger.info() | No |
| Performance regression (slow span) | ✅ via tracesSampleRate |

## Manual error capture

```ts
try {
  await processPayment(...);
} catch (err) {
  Sentry.captureException(err, {
    tags: { module: 'payments' },          // searchable in Sentry UI
    extra: { payment_id, amount },          // extra context (not searchable)
    user: { id: req.user?.id },             // identifies the user (ID only!)
    level: 'error',
  });
  throw err;  // re-throw so app's error handler runs
}
```

## User identification (PII discipline)

```ts
// Acceptable
Sentry.setUser({ id: 'user_abc123' });

// Acceptable with consent
Sentry.setUser({ id: 'user_abc123', email: '<redacted in beforeSend>' });

// NEVER
Sentry.setUser({
  id: 'user_abc123',
  email: 'real@email.com',     // PII
  ip: '1.2.3.4',                // PII
  full_name: 'Иван Иванов',     // PII
});
```

If you absolutely need email (e.g., for support follow-up): document the legal basis (consent), implement deletion request flow, set retention < 30 days.

## Releases — match errors to deploys

```bash
# Build pipeline
SENTRY_RELEASE="api@$(git rev-parse --short HEAD)"
sentry-cli releases new "$SENTRY_RELEASE"
sentry-cli releases set-commits "$SENTRY_RELEASE" --auto
sentry-cli sourcemaps upload --release "$SENTRY_RELEASE" dist/
sentry-cli releases finalize "$SENTRY_RELEASE"

# Pass to app
echo "SERVICE_VERSION=$SENTRY_RELEASE" >> .env
```

Now in Sentry UI: errors are grouped by release; you see "this regression started after deploy v1.2.3" immediately.

## Source maps (frontend)

For client-side bundles. Upload during build, delete from public dist before deploy:

```bash
npm run build
sentry-cli sourcemaps upload --release "web@$VERSION" --url-prefix "~/assets" dist/assets
rm dist/assets/**/*.map  # CRITICAL: do not ship .map to users
```

Without this, Sentry shows you minified `e(t,n)` stack frames instead of `loadDashboard(req, res)`.

## Breadcrumbs (auto-captured by default)

Sentry captures:
- Last 100 console.log/info/warn/error calls (use to your advantage; don't pollute)
- Last 100 fetch/XHR requests (URL, method, status)
- Last 100 navigation events
- Last 100 DOM clicks

When an error fires, you see the chronological lead-up. Strong context.

## Alert rules

Set up in Sentry UI (or via API/Terraform):

| Rule | Threshold |
|---|---|
| New issue | Notify immediately (first occurrence of a new error fingerprint) |
| Issue frequency spike | >10× baseline in 1 hour |
| Errors affecting >10 users | Within 1 hour |
| Performance regression | p95 latency up 50% over 7-day baseline |
| Crash-free session rate < 99% | (Mobile / SPA) |

Don't alert on every error — alert fatigue kills response.

## Anti-patterns

| Pattern | Why bad |
|---|---|
| Sending every log to Sentry | Sentry isn't a log aggregator; cost explodes; alert noise |
| `sendDefaultPii: true` | Captures cookies, headers, IPs — GDPR/CCPA risk |
| Capturing exceptions twice (manual + auto) | Inflated counts, deduplication confusion |
| Not setting `release` | Can't tie errors to deploys; no source maps |
| Sentry as analytics | Wrong tool; high cost; missing aggregations |
| Ignoring "frequency dropping" | Bug "went away" — verify fix, don't celebrate yet |

## Self-hosting GlitchTip (free Sentry alternative)

If cost or data-residency matters:

```bash
git clone https://gitlab.com/glitchtip/glitchtip
cd glitchtip
docker compose up -d
# UI at http://localhost:8000
```

Point your Sentry SDK at `http://glitchtip.your-host.com` instead of `https://sentry.io`. Same API; ~95% feature parity for errors (perf monitoring is limited).

## Cost tuning

- Set `tracesSampleRate: 0.1` (10%) or lower; not all transactions need profiles
- Filter known-noisy errors before send (`beforeSend` returning null drops the event)
- Use Sentry's "spike protection" — caps cost during outage-driven error storms
- Aggregate similar errors via fingerprinting:
  ```ts
  Sentry.captureException(err, {
    fingerprint: ['order-create', err.code]   // group by error code, not stack
  });
  ```

## Linking errors to logs

If both your logger and Sentry know `request_id`, you can:

1. See a Sentry error → click → see `request_id` in tags
2. Use that request_id to query your log aggregator (Loki/CloudWatch) for the full request trace

```ts
Sentry.captureException(err, {
  tags: { request_id: getRequestId() }
});
```

This is the bridge between error tracking (incident-driven) and logging (investigation-driven). Both should share IDs.
