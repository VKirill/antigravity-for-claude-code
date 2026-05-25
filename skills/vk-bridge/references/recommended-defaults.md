# Recommended defaults — canonical knobs for vk-bridge integration

Single source of truth for operational knob values. Don't duplicate these numbers in other reference files — link here instead.

## Sign validation

| Knob | Recommended | Rationale |
|---|---|---|
| Replay window (`vk_ts` skew) | **3600 s (1 hour)** | Tolerates user device clock drift; short enough to bound replay attack surface |
| Comparison | **`crypto.timingSafeEqual`** | Prevents timing oracles on the digest |
| Algorithm | **HMAC-SHA256** | Fixed by VK — not negotiable |
| Encoding | **base64url no-padding** | Fixed by VK — not negotiable |
| Cache TTL of "verified" tag (Redis) | **600 s (10 min)** | Avoids re-HMAC on every API call; smaller than the replay window |

## bridge.send

| Knob | Recommended | Rationale |
|---|---|---|
| Per-call timeout | **5000 ms** | Mobile network round-trip + native UI animation; above this it's stuck |
| Retry on bridge_timeout | **No automatic retry** | Stale bridge state — surface to user and let them re-tap |
| Retry on `error_data.error_code` 6 (rate-limit) on `VKWebAppCallAPIMethod` | **Exponential backoff: 1s, 3s, 9s, give up** | VK API rate limits are short-window |

## Storage

| Knob | Recommended | Rationale |
|---|---|---|
| Key prefix | **`app.`** (or `<your-short-tag>.`) | Namespaces away from other apps' historical data when schema migrates |
| Value size cap (your enforcement) | **2048 chars** | Half the platform max; safety margin for emoji-heavy content |
| What goes in storage | **UI state, last-seen markers, first-run flags** | Anything safe to lose |
| What does NOT go in storage | **Tokens, secrets, billing data, entitlements** | User can read their own storage |

## Theme detection fallback (standalone mode)

```ts
function detectTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const appearance = useAppearance() ?? detectTheme();
```

## VK API calls

| Knob | Recommended | Rationale |
|---|---|---|
| API version (`v` param) | **`5.131`** (or current pinned) | Stable, widely deployed; pin so changes are explicit |
| Default timeout for `fetch` to `api.vk.com` | **10000 ms** | API can be slow during incidents |
| Retry on transient (5xx, network error) | **3 attempts, exponential** | Treat 4xx as terminal |
| Use `random_id` on `messages.send` | **`hash(user_id + event_id)`** | VK-side dedupe within ~1 hour |

## VK Pay

| Knob | Recommended | Rationale |
|---|---|---|
| Idempotency key | **`transaction_id` from result** | VK's authoritative identifier |
| DB constraint | **UNIQUE on `payments.transaction_id`** | Prevents double-grant on retry |
| Pre-create order before opening pay form | **Always** | Stable `order_id` for server confirmation |
| Server-side verification before grant | **Always** | Never trust client `status: 'success'` |
| Polling backoff for transaction lookup (eventually consistent) | **1s, 3s, 9s, give up at 30s** | Allows VK Pay async settlement to converge |
| Stale pending order TTL | **30 min** | Auto-expire and free the order_id slot |

## Notifications

| Knob | Recommended | Rationale |
|---|---|---|
| Intent for transactional messages | **`confirmed_notification`** | High-trust category; lower volume cap but reliable |
| Intent for periodic updates | **`non_promo_newsletter`** | Sustainable category for repeated content |
| Backoff on `error_code: 6` (rate-limit) | **1m, 5m, 25m** | VK community rate limit is per-minute |
| Mark inactive on | **`error_code: 7, 15, 901`** | Terminal — re-attempt only after re-engagement |
| Re-check permission on | **App launch + `VKWebAppViewRestore`** | User may have revoked between sessions |

## Feature-detect everything optional

| Capability | Detect before calling |
|---|---|
| `VKWebAppShowStoryBox` | Older clients lack stories |
| `VKWebAppOpenCodeReader` | Desktop usually lacks camera |
| `VKWebAppGetGeodata` | Desktop iframe usually lacks geo |
| `VKWebAppDisableSwipeBack` | iOS-only effective |
| `VKWebAppResizeWindow` | Desktop only |

Always wrap with `bridge.supports(...)` (or `supportsAsync`) + try/catch — never assume.

## React component patterns

| Pattern | Use |
|---|---|
| `useAppearance()` for theme | From `@vkontakte/vk-bridge-react` |
| `useInsets()` for safe-area padding | From `@vkontakte/vk-bridge-react` |
| Subscribe in `useEffect` with cleanup | For non-hook events (`VKWebAppLocationChanged`, `VKWebAppViewHide`) |
| `'use client'` directive | Required for any bridge code in Next.js App Router |
| Gate by `bridge.isEmbedded()` | Render standalone fallback when not in VK client |

## Token storage

| Token type | Where to store |
|---|---|
| User `access_token` | Server-side, bound to verified `vk_user_id`, encrypted at rest |
| Service token | Server-side env var, never shipped to client |
| Community access token | Server-side env var, scoped to that community |

Never ship any token in `VKWebAppStorageSet` — bridge storage is user-readable.
