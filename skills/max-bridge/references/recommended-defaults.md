# Recommended Defaults — MAX Bridge

Single source of truth for tunable knobs in a MAX mini-app stack. Cite from here instead of duplicating numbers in other reference files.

## Validation

| Knob | Default | Notes |
|---|---|---|
| `maxAgeSeconds` (initData TTL) | `3600` (1 hour) | Matches upstream recommendation: «Рекомендуемый интервал составляет 1 час». Tighten to 600 s (10 min) for high-value endpoints (payments, profile email change). |
| Clock-drift tolerance (future) | `60` s | Accept `auth_date - now ≤ 60s` to absorb client/server skew. Reject anything further in the future as malformed. |
| Validation algorithm | `HMAC-SHA256` two-step (see `launch-data-validation.md`) | Algorithm is fixed by upstream — never substitute. |
| Comparison primitive | `timingSafeEqual` (Node) / byte XOR loop (Edge) | Defends against timing-attack signal extraction. |

## Caching

| Knob | Default | Notes |
|---|---|---|
| Validated-initData cache TTL | `min(remaining_lifetime, 60s)` | Never longer than the credential's own remaining lifetime. |
| Cache key | `sha256(initData)` (hex) | Stable, opaque, safe to log. |
| Cache backend | Per-process LRU (≤1000 entries) for single-instance; Redis for multi-instance | Validation is cheap (~50 µs); only cache to reduce p99 tail at high RPS. |
| Cache invalidation on user mutation | Immediate `DEL` on email change, password change, role change | Avoid stale role grants. |

## Retry policy (client → server requests)

| Knob | Default | Notes |
|---|---|---|
| Retry attempts | `2` (so 3 total tries) | Network blips only — never retry 4xx. |
| Backoff | `200ms`, `800ms` | Exponential with jitter. |
| Retry-on | `408`, `425`, `429`, `5xx`, network errors | Never retry `401` (re-validate the credential first). |
| `401 code: 'expired'` handling | Reload page once to get a fresh `initData`, then re-fire request | Avoid a retry loop — bail after the first reload. |

## Bridge method usage

| Knob | Default | Notes |
|---|---|---|
| Capability check before native call | Required when method docs say «Не поддерживается веб-клиентом» | See capability matrix in `bridge-api.md`. |
| `BiometricManager.init()` cadence | Once per app session | Cache `BiometryInfo` in memory; re-init only after `openSettings()` returns. |
| `NfcManager.init()` cadence | Once per app session | Android-only. |
| Brightness max-out duration | 30 s (platform-enforced) | No need to set a manual timer; client restores automatically. |
| `SecureStorage` key count | ≤ 10 per bot per user (platform-enforced) | Plan namespacing accordingly. Use one JSON-blob key if you need more. |
| `auth_date` field unit | Unix seconds | NEVER milliseconds. |

## Logging

| Knob | Default | Notes |
|---|---|---|
| Log validated `initData` | Never log the raw string in plaintext | Hash with sha256 if you must correlate. |
| Log `error.code` from rejected bridge Promises | Yes, at `warn` level | The code is the only diagnostic upstream provides. |
| Log `user.id` after validation | Yes | This is your trust boundary's output. |
| Log `phone` from `requestContact()` | Mask all but last 4 digits | PII. |

## Networking / hosting

| Knob | Default | Notes |
|---|---|---|
| CSP `script-src` | `'self' https://st.max.ru` | Required for the bridge CDN. |
| CSP `frame-ancestors` | `https://*.max.ru` | MAX embeds the mini-app in an iframe. |
| `X-Frame-Options` | NOT SET | Use `frame-ancestors` instead. |
| HSTS | `max-age=31536000; includeSubDomains` | Mini-app must be HTTPS. |
| `Content-Type` for API responses | `application/json; charset=utf-8` | The bridge has no opinion here; standard hygiene. |

## Header convention for `initData`

| Knob | Default | Notes |
|---|---|---|
| Header name | `X-Max-InitData` | Lowercase-canonical: `x-max-initdata`. |
| Where to send it | Every authenticated request | Stateless — there is no session cookie in the bridge model. |
| Body alternative | POST `{ "initData": "..." }` for sensitive endpoints | Avoid header truncation by some proxies on long init data. |

## Failure-mode response codes

| Scenario | HTTP | Body |
|---|---|---|
| Missing `X-Max-InitData` | `401` | `{ "error": "missing init data" }` |
| Validation failed | `401` | `{ "error": "invalid init data", "code": "<reason>" }` |
| TTL expired | `401` | `{ "error": "expired", "code": "expired" }` — client must reload |
| Bot token misconfigured server-side | `500` | `{ "error": "internal" }` — do not leak the reason |

> Reasons exposed in 401 responses: `missing_hash`, `duplicate_key`, `expired`, `bad_signature`, `malformed`. Map them to a user-facing «Пожалуйста, обновите страницу» message — never to a technical description.
