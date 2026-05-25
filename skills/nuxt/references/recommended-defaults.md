# nuxt — Recommended Defaults

Canonical Nuxt 4 config knobs. Override only with a reason.

## `nuxt.config.ts` baseline

```ts
export default defineNuxtConfig({
  compatibilityDate: '2026-05-15',
  devtools: { enabled: true },

  modules: [
    '@nuxt/ui',
    '@pinia/nuxt',
  ],

  runtimeConfig: {
    // Server-only (process.env.NUXT_*)
    apiSecret: '',
    databaseUrl: '',
    // Client-accessible
    public: {
      apiBase: '/api',
      siteUrl: 'https://example.com',
    },
  },

  routeRules: {
    // Static marketing pages — prerender at build
    '/': { prerender: true },
    '/about': { prerender: true },
    // Cached at edge for 1 hour, SWR for 1 day
    '/blog/**': { swr: 3600 },
    // ISR — revalidate on demand
    '/products/**': { isr: 600 },
    // SPA fallback for client-only routes
    '/admin/**': { ssr: false },
    // API routes — never cache
    '/api/**': { cache: false },
  },

  nitro: {
    preset: process.env.NITRO_PRESET ?? 'node-server',
    storage: {
      // Use Redis for sessions / SWR / ISR in production
      // redis: { driver: 'redis', host: '127.0.0.1', port: 6379 }
    },
  },

  experimental: {
    payloadExtraction: true,    // smaller hydration payloads
  },

  typescript: {
    strict: true,
    typeCheck: false,           // run separately via `vue-tsc`
  },
})
```

## `runtimeConfig` pattern

| Key location | Visibility | Env var | Use for |
|---|---|---|---|
| `runtimeConfig.apiSecret` | server only | `NUXT_API_SECRET` | DB password, JWT secret, API keys |
| `runtimeConfig.public.apiBase` | server + client | `NUXT_PUBLIC_API_BASE` | URLs, feature flags, public IDs |

**Access:**

```ts
// In a server route or composable (universal)
const config = useRuntimeConfig()
config.apiSecret              // server-only — `undefined` on client
config.public.apiBase         // both sides
```

**NEVER** put secrets in `public.*` — they ship to the browser.

## Nitro preset selection

| Target | Preset | Notes |
|---|---|---|
| Self-hosted Node / PM2 | `node-server` (default) | use behind Nginx / Angie reverse proxy |
| Vercel | auto-detected (or `vercel`) | edge functions for `/api`, CDN for static |
| Netlify | auto-detected (or `netlify`) | similar to Vercel |
| Cloudflare Pages | `cloudflare-pages` | Workers runtime — no Node APIs |
| Cloudflare Workers | `cloudflare-module` | pure Workers, no Pages CDN |
| Static SSG | `static` (run `nuxt generate`) | no server runtime |
| AWS Lambda | `aws-lambda` | cold-start sensitive — pair with provisioned concurrency |

Set explicitly in CI if auto-detection is unreliable: `NITRO_PRESET=cloudflare-pages nuxt build`.

## `routeRules` patterns

| Pattern | Rule | When |
|---|---|---|
| `prerender: true` | static HTML at build | marketing, docs, blog index |
| `isr: 600` | ISR with 10-min TTL | product detail, catalog |
| `swr: 3600` | stale-while-revalidate, 1h | semi-dynamic feeds |
| `ssr: false` | SPA mode, no SSR | admin dashboards, behind-login UIs |
| `cache: { maxAge: 60 }` | CDN-level cache | API routes that can tolerate staleness |
| `headers: { 'X-Robots-Tag': 'noindex' }` | response headers | staging, internal pages |

## Tuning ranges

| Knob | Default | Min sane | Max sane | Notes |
|---|---|---|---|---|
| `swr` TTL | none | `60` | `86400` (1d) | balance freshness vs origin load |
| `isr` revalidate | none | `60` | `3600` | server hit on each revalidation |
| `experimental.payloadExtraction` | true (Nuxt 4) | — | — | keep on |
| `typescript.typeCheck` | false | — | — | run as separate `vue-tsc -p .` step |

## See also

- [modules.md](modules.md) — full `nuxt.config.ts` API
- [deployment.md](deployment.md) — Nitro preset details
- [troubleshooting.md](troubleshooting.md) — when defaults misbehave
