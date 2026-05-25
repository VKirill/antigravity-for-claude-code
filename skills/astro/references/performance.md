# Performance

Astro defaults are already excellent — a vanilla Astro page hits 100/100/100/100 Lighthouse with minimal effort. This file covers the recurring optimization patterns.

## Lighthouse baseline targets

| Metric | Target |
|---|---|
| Performance | 95+ |
| LCP | < 2.0s |
| TBT | < 200ms |
| CLS | < 0.05 |
| JS shipped (uncompressed) | < 100 KB total |

If you're below these, the most common causes are: over-hydration, unoptimized images, blocking third-party scripts.

## Audit JS shipped per page

```bash
astro build --verbose
```

Look for `[client]` lines — each is an island that ships JS. Cross-reference with `dist/_astro/*.js` sizes.

Use `npm run preview` then run Lighthouse in Chrome DevTools.

## Hydration discipline

Default to `client:visible` for any non-critical island. Above-the-fold cases that need `client:load`:

- Top navigation with state (mobile menu, cart count)
- Auth header (logged-in dropdown)
- Search bar

Everything else: `client:visible` or `client:idle`.

If a component has no state and no event handlers, **rewrite as `.astro`** — it ships zero JS.

## Image optimization

Use `<Image />` from `astro:assets` for every image:

```astro
---
import { Image } from 'astro:assets'
import hero from '../assets/hero.jpg'   // sharp processes at build
---
<Image
  src={hero}
  alt="Hero photo"
  widths={[400, 800, 1200, 1600]}
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
  loading="eager"
  fetchpriority="high"
/>
```

Below-the-fold images: omit `loading="eager"` (default is `lazy`).

For non-local images, configure `image.remotePatterns` + use the same `<Image />` with a URL.

## Fonts

Self-host fonts to avoid third-party requests:

```astro
---
// src/layouts/Layout.astro
---
<link rel="preload" href="/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin />
<style is:global>
  @font-face {
    font-family: 'Inter';
    src: url('/fonts/inter-var.woff2') format('woff2-variations');
    font-weight: 100 900;
    font-display: swap;
  }
</style>
```

For Google Fonts use `astro-google-fonts-optimizer` or, better, download and self-host.

## Third-party scripts

Wrap analytics/chat in `astro-partytown` so they run in a web worker:

```bash
astro add partytown
```

```astro
<script type="text/partytown" src="https://www.googletagmanager.com/gtag/js?id=G-XXX"></script>
```

Worker-bound scripts don't block the main thread.

## Prefetching

```js
// astro.config.mjs
export default defineConfig({
  prefetch: {
    prefetchAll: false,                  // don't prefetch every link
    defaultStrategy: 'hover',            // prefetch on hover
  },
})
```

Strategies:
- `tap` — on link tap/click (cheapest)
- `hover` — on mouseover (default in 6.x)
- `viewport` — when link enters viewport (most aggressive)
- `load` — at page load (use sparingly)

Force prefetch on a specific link: `<a href="/about" data-astro-prefetch>About</a>`.

## SSR caching

For `output: 'server'` pages that don't need per-user data, set cache headers:

```astro
---
Astro.response.headers.set(
  'cache-control',
  'public, max-age=60, stale-while-revalidate=300'
)
---
```

Or use ISR on Vercel:

```js
adapter: vercel({
  isr: { expiration: 60 },
})
```

CDN-cache shared responses, never personalized ones. Use Server Islands for personalization inside cacheable shells.

## CSS

Astro scopes component styles by default. For global CSS, use `is:global`:

```astro
<style is:global>
  body { margin: 0; }
</style>
```

For Tailwind 4, all utilities are tree-shaken by default — no manual purge config needed.

Inline critical CSS for above-the-fold content via `<style>` tags in `.astro` files (already inlined per page).

## View Transitions overhead

`<ClientRouter />` adds ~3-5 KB gzipped. For sites with primarily one-page-loads (landing pages), skip it.

For sites where users navigate frequently (docs, blogs, app dashboards), it dramatically improves perceived performance.

## Build performance

For sites with thousands of pages:

- Enable parallel builds: Astro 6.x defaults to parallel
- Split into multiple sitemaps: `sitemap({ entryLimit: 10000 })`
- Use a paginated Content Loader for huge collections instead of one giant `glob`
- Cache content fetches in custom loaders — they re-run on every build

## Common pitfalls

- **`<img>` instead of `<Image />`** — no responsive variants, no AVIF/WebP, no lazy by default
- **`client:load` on a leaf React `<Card />`** — should be `.astro` static markup
- **Large data passed as island props** — fetch on the client or use Server Islands
- **Inlining huge `<script>` blocks in `.astro` files** — they're inlined per page; extract to ES modules
- **Forgetting `font-display: swap`** — invisible text during font load = bad CLS
- **CDN caching personalized pages** — set `cache-control: private, no-store` on auth-gated routes
- **Hydrating components that only need CSS hover** — pure CSS `:hover` is free; no JS needed
