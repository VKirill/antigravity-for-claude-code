# nextjs — Recommended Defaults

Canonical values for Next.js 16 config knobs. Override only with a specific reason.

## `next.config.ts` baseline

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // 'use cache' profiles (Next 16 stable)
  experimental: {
    useCache: true,
    cacheLife: {
      // Default profiles also exist: seconds | minutes | hours | days | weeks | max
      // Add custom only if defaults are insufficient.
      shortLived: { stale: 30, revalidate: 60, expire: 300 },         // 5-min hard cap
      product:    { stale: 60, revalidate: 300, expire: 3600 },       // 1-hour expire
      catalog:    { stale: 300, revalidate: 1800, expire: 86_400 },   // 1-day expire
    },
    ppr: 'incremental', // per-route opt-in via `export const experimental_ppr = true`
  },

  // Server Action body size limit (defaults to 1 MB)
  serverActions: {
    bodySizeLimit: '2mb',          // bump only if multipart uploads via Server Action
    allowedOrigins: ['localhost:3000'], // tighten in prod
  },

  // Image optimization
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.example.com' },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  },
}

export default nextConfig
```

## `cacheLife` profile choice

| Data type | Built-in profile | When to switch to custom |
|---|---|---|
| Marketing / about pages | `hours` or `days` | almost never |
| Product detail (inventory-sensitive) | `minutes` | if inventory is real-time, drop to `seconds` |
| Static catalog listing | `hours` | if catalog mutates per-tenant, use custom with `cacheTag` per tenant |
| User-private feed | DO NOT cache | use `noStore()` or skip `'use cache'` |
| Auth-gated dashboard | DO NOT cache at module level | wrap per-resource with `cacheTag(userId+'-'+resource)` |

## Server Action body limits

- Default: **1 MB** — sufficient for typical form posts
- Multipart uploads via Server Action: bump to `2mb`–`4mb`, but prefer presigned uploads (S3/R2) for >4 MB
- NEVER set `bodySizeLimit` to `'10mb'+` without a rate limiter

## Image loader

- Self-hosted production: install `sharp` (`npm i sharp`) and use the default loader
- Edge / Vercel: built-in loader is automatic
- CDN-hosted assets: configure `images.remotePatterns`, never `images.domains` (deprecated)

## PPR rollout

- Phase 1: `experimental.ppr: 'incremental'` — opt-in per-route via `export const experimental_ppr = true`
- Phase 2: once stable on key routes, flip to `experimental.ppr: true` globally
- Always test with `next build` then `next start` — `next dev` does NOT exercise PPR

## Tuning ranges

| Knob | Default | Min sane | Max sane | Notes |
|---|---|---|---|---|
| `cacheLife` profile expire | profile-dependent | `60s` | `1y` | match data volatility |
| `serverActions.bodySizeLimit` | `1mb` | `1mb` | `4mb` | larger → presigned upload |
| `images.deviceSizes` | 8 sizes | 4 | 12 | matches actual breakpoints |
| `images.minimumCacheTTL` | 60 | 60 | 31536000 | bump for immutable assets |

## See also

- [caching.md](caching.md) — full `'use cache'` API
- [performance.md](performance.md) — Turbopack config, bundle analysis
- [troubleshooting.md](troubleshooting.md) — when defaults misbehave
