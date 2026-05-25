# Next.js 16 — Rendering

## Server Components vs Client Components

### Decision rule

Start with a Server Component. Add `'use client'` only when the component needs:
- React hooks (`useState`, `useEffect`, `useRef`, etc.)
- Browser APIs (`window`, `document`, `localStorage`)
- Event handlers (`onClick`, `onChange`)
- Real-time subscriptions

### What each can do

| Capability | Server Component | Client Component |
|---|---|---|
| Direct DB / filesystem access | Yes | No |
| Contributes to JS bundle | No | Yes |
| async/await at component level | Yes | No (use `useEffect` or `use()`) |
| React hooks | No | Yes |
| Event handlers | No | Yes |
| `cookies()`, `headers()` | Yes | No |
| `useState`, `useReducer` | No | Yes |
| Context (Provider) | No | Yes (can wrap Server tree) |

### Composition patterns

Server Components can render Client Components. Client Components can receive Server Components via `children` or props, but **cannot import** Server Components.

```tsx
// Server Component — can do DB access and render Client leaf
import { ClientButton } from './ClientButton'  // 'use client'

export default async function ProductPage() {
  const product = await getProduct()
  return (
    <div>
      <h1>{product.name}</h1>
      <ClientButton productId={product.id} />   {/* Client leaf */}
    </div>
  )
}
```

```tsx
// Pattern: Server Component as children of Client Component
// Server Component
import { Modal } from './Modal'      // 'use client'

export default async function Page() {
  const data = await getData()
  return (
    <Modal>
      <ServerContent data={data} />   {/* Server Component passed as children */}
    </Modal>
  )
}

// 'use client'
// Modal.tsx
export function Modal({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return open ? <div className="modal">{children}</div> : null
}
```

### Context providers

Context requires `'use client'`. Wrap providers in a client component and render it high in the tree:

```tsx
// app/providers.tsx
'use client'
import { ThemeProvider } from 'next-themes'

export function Providers({ children }: { children: React.ReactNode }) {
  return <ThemeProvider attribute="class">{children}</ThemeProvider>
}

// app/layout.tsx (Server Component)
import { Providers } from './providers'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

## Rendering modes

| Mode | When | Config |
|---|---|---|
| **Static** | No dynamic data, no Dynamic APIs | Default for pages that use only `'use cache'` data |
| **Dynamic** | Uses cookies/headers/searchParams or `dynamic = 'force-dynamic'` | Request-time rendering |
| **Streaming** | Suspense boundaries wrap async work | Incremental HTML flush |
| **PPR** | Static shell + dynamic streaming slots | `experimental_ppr = true` |

Next.js 16 determines the rendering mode per-page automatically based on usage. Avoid `dynamic = 'force-dynamic'` unless you truly need all data fresh every request — it disables static optimization entirely.

## PPR — Partial Prerendering

PPR splits a route into a **static prerendered shell** and **streaming dynamic holes**, served from a single response. The static shell ships instantly from CDN; dynamic parts stream in from the origin.

### Enable per-route

```ts
// app/products/[id]/page.tsx
export const experimental_ppr = true
```

### Enable globally

```ts
// next.config.ts
const config: NextConfig = {
  experimental: {
    ppr: true,          // stable in Next.js 16
  },
}
```

### How PPR uses Suspense

The static shell is everything outside your `<Suspense>` boundaries. Wrap dynamic content:

```tsx
import { Suspense } from 'react'
import { ProductSkeleton, RecommendationsSkeleton } from './skeletons'
import { ProductDetails } from './ProductDetails'     // reads from DB
import { Recommendations } from './Recommendations'  // personalized

export const experimental_ppr = true

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  // Note: with PPR, params may still need await in Next.js 16 for dynamic slots
  return (
    <div>
      <header>Static navigation shell</header>
      <Suspense fallback={<ProductSkeleton />}>
        <ProductDetails params={params} />     {/* streams dynamically */}
      </Suspense>
      <Suspense fallback={<RecommendationsSkeleton />}>
        <Recommendations params={params} />    {/* streams dynamically */}
      </Suspense>
    </div>
  )
}
```

`<Suspense>` boundary placement determines the PPR split. Content outside all Suspense boundaries is static.

### PPR + `'use cache'`

Best practice: data functions used in dynamic slots still use `'use cache'`. The cache serves the data faster; PPR handles the HTML delivery model.

```ts
// The Recommendations component's data function is cached
'use cache'
export async function getRecommendations(userId: string) {
  cacheLife('minutes')
  cacheTag(`recs-${userId}`)
  ...
}
```

## Streaming with Suspense

Even without PPR, Suspense enables streaming — the page renders incrementally rather than waiting for all async work:

```tsx
// app/dashboard/page.tsx
import { Suspense } from 'react'

export default function Dashboard() {
  return (
    <main>
      <h1>Dashboard</h1>
      <Suspense fallback={<p>Loading stats...</p>}>
        <StatsPanel />        {/* async Server Component */}
      </Suspense>
      <Suspense fallback={<p>Loading activity...</p>}>
        <ActivityFeed />      {/* async Server Component */}
      </Suspense>
    </main>
  )
}

// Each wrapped component can fetch independently
async function StatsPanel() {
  const stats = await getStats()    // runs independently of ActivityFeed
  return <div>{/* ... */}</div>
}
```

`loading.tsx` is sugar for wrapping the page in Suspense at the segment level. For finer control, compose `<Suspense>` directly.

## `use()` for deferred data in Client Components

React 19's `use()` hook lets a Client Component consume a Promise passed from a Server Component:

```tsx
// app/page.tsx — Server Component
import { Suspense } from 'react'
import { ClientWithData } from './ClientWithData'

export default function Page() {
  const dataPromise = getData()     // not awaited — passes promise down
  return (
    <Suspense fallback={<Skeleton />}>
      <ClientWithData dataPromise={dataPromise} />
    </Suspense>
  )
}

// ClientWithData.tsx
'use client'
import { use } from 'react'

export function ClientWithData({ dataPromise }: { dataPromise: Promise<Data> }) {
  const data = use(dataPromise)   // suspends until resolved
  return <div>{data.name}</div>
}
```

This pattern avoids serializing data through props when the Client Component is wrapped in Suspense.

## Server-side rendering (traditional SSR)

Pure SSR (every request renders fresh) is triggered by:
- Reading `cookies()`, `headers()`, `searchParams` without caching
- `export const dynamic = 'force-dynamic'`
- `noStore()` in a data function

Avoid SSR for the entire page when only part of the page is dynamic — use PPR + Suspense instead.
