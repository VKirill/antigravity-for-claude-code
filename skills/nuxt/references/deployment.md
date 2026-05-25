# Nuxt 4 — Deployment (Nitro Presets)

## How Nitro presets work

`nuxt build` compiles the Nuxt app into a `.output/` directory. The Nitro preset determines the output format — Node.js server, serverless functions, edge workers, or static files. Build once, deploy anywhere.

```
.output/
├── public/          ← static assets (always)
└── server/          ← server entry + chunks (preset-specific format)
```

## Preset selection

Set in `nuxt.config.ts`. Auto-detected only for Vercel and Netlify (when their CI env vars are present):

```ts
export default defineNuxtConfig({
  nitro: {
    preset: 'cloudflare-pages',  // override auto-detection
  }
})
```

Or via env var (useful for CI without changing config): `NITRO_PRESET=cloudflare-pages nuxt build`

## Node.js server (default)

```ts
nitro: { preset: 'node-server' }  // or omit — this is the default
```

Build and run:

```bash
nuxt build
node .output/server/index.mjs
```

PM2:

```js
// ecosystem.config.cjs
module.exports = {
  apps: [{
    name: 'nuxt-app',
    script: '.output/server/index.mjs',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      PORT: 3000,
      NODE_ENV: 'production',
    }
  }]
}
```

The server listens on `process.env.PORT` (default 3000). Set `HOST` env var to bind address.

## Vercel

Auto-detected when `VERCEL=1` is set. No manual preset needed in most cases.

```ts
// Explicit override if needed
nitro: { preset: 'vercel' }
```

Server routes become Vercel Serverless Functions. `routeRules` with `{ static: true }` become static files. `{ swr: N }` uses Vercel's ISR (On-Demand ISR).

Vercel-specific tuning:

```ts
nitro: {
  preset: 'vercel',
  vercel: {
    functions: {
      maxDuration: 60,           // max function timeout (seconds)
    }
  }
}
```

## Netlify

Auto-detected when `NETLIFY=1`. Routes become Netlify Functions (v2).

```ts
nitro: { preset: 'netlify' }
```

`netlify.toml` is auto-generated in `.output/`. Redirect rules from `routeRules` are included automatically.

## Cloudflare Pages

**Not** auto-detected — always set explicitly:

```ts
nitro: { preset: 'cloudflare-pages' }
```

Build:

```bash
NITRO_PRESET=cloudflare-pages nuxt build
```

Output at `.output/`. Deploy:

```bash
npx wrangler pages deploy .output/public --project-name my-app
```

Cloudflare Pages limitations:
- No Node.js `child_process`, `fs`, or native modules — use `cloudflare:*` APIs or compatible packages
- Environment variables: set in Cloudflare dashboard or `wrangler.toml`
- Workers bundle size limit: 10 MB (free) / 25 MB (paid)

## Cloudflare Workers (module syntax)

```ts
nitro: { preset: 'cloudflare-module' }
```

More control than Pages. Use for Workers with Durable Objects or custom routing.

## Static / SSG

```bash
nuxt generate
```

Or set preset:

```ts
nitro: { preset: 'static' }
```

Crawls all `app/pages/` routes and pre-renders HTML. Dynamic routes need `nitro.prerender.routes`:

```ts
nitro: {
  preset: 'static',
  prerender: {
    routes: ['/sitemap.xml', '/api/og-image'],
    crawlLinks: true,      // follow internal links (default true)
    ignore: ['/admin/**'],
  }
}
```

## Hybrid rendering with `routeRules`

Mix strategies in one deployment:

```ts
routeRules: {
  '/':             { prerender: true },     // static home
  '/blog/**':      { swr: 3600 },           // ISR with 1hr TTL
  '/dashboard/**': { ssr: false },          // client-only SPA
  '/api/**':       { cache: false },        // no cache for API
}
```

## Environment variables at runtime

Nuxt reads `runtimeConfig` from env vars at runtime (not build time). For Node preset, just set the env vars before starting. For serverless:

- Vercel: set in project settings or via `vercel env`
- Netlify: site settings → environment variables
- Cloudflare: `wrangler secret put NUXT_API_SECRET` or dashboard

The env var must match the `NUXT_` prefix convention:

```
NUXT_API_SECRET=xxx
NUXT_PUBLIC_API_BASE=https://api.example.com
```

## Health check endpoint

Add a health route for load balancers:

```ts
// server/api/health.get.ts
export default defineEventHandler(() => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
}))
```

## Docker (Node preset)

```dockerfile
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx nuxt build

FROM node:24-alpine AS runtime
WORKDIR /app
COPY --from=build /app/.output /app/.output
ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

## Checklist before deploying

- [ ] `nitro.preset` set explicitly (never rely solely on CI auto-detection for edge targets)
- [ ] All `runtimeConfig` secrets set as env vars in the target platform
- [ ] `compatibilityDate` set in `nuxt.config.ts`
- [ ] `nuxt build` runs without errors locally with `NITRO_PRESET` matching the target
- [ ] Health check route exists for Node/containerized deployments
- [ ] Static assets (under `public/`) are CDN-cacheable (long cache headers via `routeRules`)
