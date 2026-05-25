# Deploy Adapters

Static builds work anywhere (CDN, S3, GitHub Pages). For SSR/hybrid you need an adapter matching your host.

## Static deployment (zero adapter)

```js
// astro.config.mjs
export default defineConfig({
  site: 'https://example.com',
  output: 'static',                   // default
})
```

`npm run build` → `dist/` → upload to any static host. Best Lighthouse, cheapest, simplest.

## Vercel

```bash
npm install @astrojs/vercel
```

```js
import vercel from '@astrojs/vercel/serverless'

export default defineConfig({
  output: 'server',                   // or 'hybrid'
  adapter: vercel({
    imageService: true,               // use Vercel Image Optimization
    webAnalytics: { enabled: true },
    isr: {
      bypassToken: process.env.VERCEL_BYPASS_TOKEN,
      expiration: 60,
    },
  }),
})
```

- Vercel's edge runtime: `@astrojs/vercel/edge` (limited Node API)
- ISR (Incremental Static Regeneration) requires `output: 'hybrid'` + `prerender = true` on the page
- File-system writes go to `/tmp` only

## Netlify

```bash
npm install @astrojs/netlify
```

```js
import netlify from '@astrojs/netlify'

export default defineConfig({
  output: 'server',
  adapter: netlify({
    edgeMiddleware: true,             // run middleware at the edge
    cacheOnDemandPages: true,
  }),
})
```

Netlify supports Astro Image Service automatically. Edge functions available via `edgeMiddleware: true`.

## Cloudflare Pages / Workers

```bash
npm install @astrojs/cloudflare
```

```js
import cloudflare from '@astrojs/cloudflare'

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    platformProxy: { enabled: true },   // local dev with Wrangler bindings
    imageService: 'cloudflare',         // use Cloudflare Image Resizing
  }),
})
```

### Bindings (KV, D1, R2, etc.)

```ts
// src/env.d.ts
type Runtime = import('@astrojs/cloudflare').Runtime<Env>

declare namespace App {
  interface Locals extends Runtime {}
}

interface Env {
  KV: KVNamespace
  DB: D1Database
  R2: R2Bucket
}
```

Access in a page or endpoint:

```ts
const { env } = Astro.locals.runtime
await env.KV.put('key', 'value')
const { results } = await env.DB.prepare('SELECT * FROM users').all()
```

### Caveats

- No Node built-ins in default (Workers) runtime — use the `nodejs_compat` flag in `wrangler.toml` if needed
- `fs` and most Node APIs unavailable — use Astro's filesystem-free pattern (assets via `astro:assets`, no `fs.readFile`)
- Workers have CPU time limits; offload heavy work to D1/external APIs

## Node (self-hosted)

```bash
npm install @astrojs/node
```

```js
import node from '@astrojs/node'

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),  // or 'middleware'
})
```

Build → `dist/server/entry.mjs` → run with `node ./dist/server/entry.mjs`. Wrap with PM2 for production:

```bash
pm2 start dist/server/entry.mjs --name astro-app
pm2 startup && pm2 save
```

Or behind Angie/Nginx as a reverse proxy on `localhost:4321`.

### Middleware mode

`mode: 'middleware'` exports an Express-compatible request handler — mount inside an existing Express/Fastify app:

```ts
import express from 'express'
import { handler as ssrHandler } from './dist/server/entry.mjs'

const app = express()
app.use(express.static('dist/client/'))
app.use(ssrHandler)
app.listen(8080)
```

## Deno

```bash
npm install @astrojs/deno
```

```js
import deno from '@astrojs/deno'

export default defineConfig({
  output: 'server',
  adapter: deno(),
})
```

Run with `deno run --allow-net --allow-read --allow-env dist/server/entry.mjs`.

## Bun

No official Bun adapter. Use the Node adapter — Bun is Node-compatible enough:

```bash
bun ./dist/server/entry.mjs
```

## Per-host quick reference

| Host | Adapter | Best for |
|---|---|---|
| Vercel | `@astrojs/vercel` | Marketing sites, ISR, Image Optimization |
| Netlify | `@astrojs/netlify` | Marketing sites with edge middleware |
| Cloudflare | `@astrojs/cloudflare` | Edge SSR, global low-latency, free tier |
| Node (PM2 + Angie) | `@astrojs/node` | Self-hosted, full control, no cold starts |
| Static (CDN) | none | Pure SSG, best perf, cheapest |

## Common pitfalls

- **Wrong adapter for the host** → deploy succeeds but runtime crashes (e.g., Node adapter on Cloudflare)
- **Vercel/Netlify default image service when Sharp is needed for advanced ops** — explicitly opt in (`imageService: true`)
- **Cloudflare without `nodejs_compat`** when using a library that imports `node:crypto` etc.
- **Forgetting `output: 'server'`** in config — adapter is installed but pages still prerender; check `astro.config.mjs`
- **Local dev not exercising the adapter** — `astro dev` doesn't go through the adapter; test with `astro build && astro preview` (or `wrangler pages dev` for Cloudflare)
- **Environment variables**: Astro reads `PUBLIC_*` at build time and `import.meta.env.*` at runtime. Server-only secrets via `astro:env` (typed) or raw `process.env`
