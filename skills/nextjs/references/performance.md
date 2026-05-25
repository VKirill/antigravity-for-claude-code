# Next.js 16 — Performance

## Turbopack

Next.js 16 uses Turbopack as the default bundler for both `next dev` and `next build`. No configuration required.

### Key facts

- Written in Rust — 10-700x faster cold dev starts vs webpack
- Incremental: only rebuilds what changed (persistent cache across restarts)
- Default since Next.js 16; `next build` uses it automatically
- Does NOT use webpack loaders. If your project has custom webpack plugins, check compatibility.

### Falling back to webpack

```bash
next build --no-turbopack    # or
next dev --no-turbopack
```

Or in `package.json`:
```json
{
  "scripts": {
    "build": "next build --no-turbopack"
  }
}
```

### Turbopack config in next.config.ts

```ts
// next.config.ts
const config: NextConfig = {
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],    // SVGR still works via Turbopack rules
        as: '*.js',
      },
    },
    resolveAlias: {
      'underscore': 'lodash',          // module aliasing
    },
    resolveExtensions: ['.tsx', '.ts', '.jsx', '.js'],
  },
}
```

### Known incompatibilities

- `babel-loader` / `.babelrc` — use SWC transforms or swc plugins instead
- Webpack-specific plugin APIs (`webpack.DefinePlugin`, `webpack.NormalModuleReplacementPlugin`)
- `@module-federation` — partial support, check current status
- CSS Modules with non-standard names (must end in `.module.css`)

## next/image

`<Image>` from `next/image` auto-optimizes (WebP/AVIF conversion, resize, lazy load, blur placeholder).

### Required props

```tsx
import Image from 'next/image'

// Fixed dimensions
<Image src="/hero.png" alt="Hero image" width={1200} height={630} priority />

// Fill container (responsive)
<div style={{ position: 'relative', height: '400px' }}>
  <Image
    src="/hero.png"
    alt="Hero"
    fill
    sizes="(max-width: 768px) 100vw, 50vw"  // required with fill
    style={{ objectFit: 'cover' }}
  />
</div>
```

### Remote images

Must allowlist in `next.config.ts`:

```ts
const config: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.example.com',
        port: '',
        pathname: '/products/**',
      },
    ],
  },
}
```

### LCP optimization

Add `priority` to above-the-fold images (disables lazy loading, adds `rel="preload"`):

```tsx
<Image src="/hero.jpg" alt="Hero" width={1920} height={1080} priority />
```

Only add `priority` to the actual LCP image — adding it to all images degrades load performance.

### Blur placeholder

```tsx
// Static image (blur auto-generated at build time)
import heroImage from '/public/hero.jpg'
<Image src={heroImage} alt="Hero" placeholder="blur" />

// Remote image (must provide blurDataURL)
<Image
  src="https://cdn.example.com/hero.jpg"
  alt="Hero"
  width={1200}
  height={630}
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,/9j/4AAQ..."
/>
```

## next/dynamic

Code-split Client Components to reduce initial bundle:

```tsx
import dynamic from 'next/dynamic'

// Basic lazy load
const HeavyChart = dynamic(() => import('./HeavyChart'))

// With loading UI
const HeavyChart = dynamic(() => import('./HeavyChart'), {
  loading: () => <p>Loading chart...</p>,
  ssr: false,   // disable SSR for browser-only components
})

// Named export
const { Modal } = dynamic(
  () => import('./Modal').then((mod) => ({ default: mod.Modal }))
)
```

`ssr: false` is useful for components that use `window`, `document`, or browser-only APIs. Don't use it unnecessarily — it removes the Server Component rendering advantage.

## Bundle analysis

```bash
# Install
npm i @next/bundle-analyzer

# next.config.ts
import bundleAnalyzer from '@next/bundle-analyzer'
const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === 'true' })
export default withBundleAnalyzer(config)

# Run
ANALYZE=true next build
```

Opens an interactive treemap of your bundle. Focus on:
- Packages in `node_modules` that appear in the client bundle unexpectedly
- Duplicate dependencies (different versions of the same package)
- Large icon libraries (use tree-shaking or import specific icons)

## Core Web Vitals targets

| Metric | Good | Needs improvement | Poor |
|---|---|---|---|
| LCP (Largest Contentful Paint) | <2.5s | 2.5–4s | >4s |
| INP (Interaction to Next Paint) | <200ms | 200–500ms | >500ms |
| CLS (Cumulative Layout Shift) | <0.1 | 0.1–0.25 | >0.25 |

### Common fixes

**LCP**
- Add `priority` to LCP image
- Use `'use cache'` to serve cached HTML faster
- Enable PPR so shell arrives static

**INP**
- Move expensive computation out of event handlers
- Use `useTransition` to defer non-urgent state updates
- Lazy-load heavy Client Components with `next/dynamic`

**CLS**
- Always provide `width` / `height` or `fill` + `sizes` on `<Image>`
- Reserve space for dynamic content (skeleton loaders)
- Avoid inserting content above existing content after load

## Font optimization

```ts
// app/layout.tsx
import { Inter, Roboto_Mono } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',         // 'swap' prevents invisible text
  variable: '--font-inter', // CSS variable for use in Tailwind
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html className={inter.variable}>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

`next/font` auto-hosts fonts (zero external requests), adds `preload` links, and inlines the font-face CSS. Fonts are loaded once, hashed, and served from `_next/static`.

## Script optimization

```tsx
import Script from 'next/script'

// afterInteractive (default): loads after page is interactive
<Script src="https://analytics.example.com/script.js" strategy="afterInteractive" />

// lazyOnload: lowest priority, loads when browser is idle
<Script src="https://chat-widget.example.com/widget.js" strategy="lazyOnload" />

// beforeInteractive: critical scripts (must be in layout, not page)
<Script src="/critical-polyfill.js" strategy="beforeInteractive" />

// worker: off-main-thread via Partytown (requires extra setup)
<Script src="/heavy-analytics.js" strategy="worker" />
```

## Prefetching

Next.js prefetches `<Link>` targets automatically when they enter the viewport (in production). Control this:

```tsx
// Disable prefetch for heavy pages
<Link href="/heavy-page" prefetch={false}>Heavy page</Link>

// Force prefetch (default behaviour in production)
<Link href="/next-page" prefetch={true}>Next page</Link>
```

Programmatic prefetch:

```ts
import { useRouter } from 'next/navigation'

const router = useRouter()
router.prefetch('/checkout')   // on hover or user intent signal
```
