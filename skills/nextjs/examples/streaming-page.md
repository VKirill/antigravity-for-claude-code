# Streaming Page with Suspense and PPR

## Scenario

A product page has a static header + nav shell that should be instantly available from CDN, while product details, recommendations, and reviews each load independently and stream in as they resolve. Uses PPR + multiple `<Suspense>` boundaries with skeleton fallbacks.

## Stack

- Next.js 16 (App Router + PPR enabled)
- `'use cache'` on data functions
- React 19 Suspense

## Step 1: Enable PPR globally or per-route

```ts
// next.config.ts (global)
const config: NextConfig = {
  experimental: { ppr: true },
}

// OR per-route (app/products/[id]/page.tsx)
export const experimental_ppr = true
```

## Step 2: Define cached data functions

```ts
// lib/data/products.ts
'use cache'
import { cacheLife, cacheTag } from 'next/cache'
import { db } from '@/lib/db'

export async function getProductBasic(id: string) {
  cacheLife('hours')
  cacheTag(`product-${id}`)
  return db.product.findUnique({ where: { id }, select: { id: true, name: true, price: true, imageUrl: true } })
}

export async function getProductDetails(id: string) {
  cacheLife('hours')
  cacheTag(`product-details-${id}`)
  // Heavier query with relations
  return db.product.findUnique({
    where: { id },
    include: { specs: true, variants: true, brand: true },
  })
}

export async function getProductReviews(id: string) {
  cacheLife('minutes')               // reviews update more frequently
  cacheTag(`product-reviews-${id}`)
  return db.review.findMany({ where: { productId: id }, take: 10, orderBy: { createdAt: 'desc' } })
}

export async function getRecommendations(productId: string) {
  cacheLife('hours')
  cacheTag(`recommendations-${productId}`)
  return db.product.findMany({ where: { categoryId: productId }, take: 6 })
}
```

## Step 3: Build skeleton components

```tsx
// app/products/[id]/skeletons.tsx
export function ProductDetailsSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-3/4 bg-gray-200 rounded mb-4" />
      <div className="h-4 w-full bg-gray-200 rounded mb-2" />
      <div className="h-4 w-5/6 bg-gray-200 rounded" />
    </div>
  )
}

export function ReviewsSkeleton() {
  return (
    <ul className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <li key={i} className="animate-pulse">
          <div className="h-4 w-1/3 bg-gray-200 rounded mb-2" />
          <div className="h-4 w-full bg-gray-200 rounded" />
        </li>
      ))}
    </ul>
  )
}

export function RecommendationsSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="animate-pulse h-48 bg-gray-200 rounded" />
      ))}
    </div>
  )
}
```

## Step 4: Page with multiple Suspense boundaries

```tsx
// app/products/[id]/page.tsx
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import type { Metadata } from 'next'
import { getProductBasic, getProductDetails, getProductReviews, getRecommendations } from '@/lib/data/products'
import {
  ProductDetailsSkeleton,
  ReviewsSkeleton,
  RecommendationsSkeleton,
} from './skeletons'

export const experimental_ppr = true

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const product = await getProductBasic(id)
  if (!product) return { title: 'Not Found' }
  return { title: product.name }
}

// ── Static shell (prerendered at build / CDN edge) ────────────────────────────
export default async function ProductPage({ params }: Props) {
  const { id } = await params
  const product = await getProductBasic(id)      // fast, cached — in static shell
  if (!product) notFound()

  return (
    <main>
      {/* Static shell — prerendered */}
      <nav>← Back to products</nav>
      <div className="product-hero">
        <Image
          src={product.imageUrl}
          alt={product.name}
          width={600}
          height={600}
          priority                               // LCP image
        />
        <div>
          <h1>{product.name}</h1>
          <p className="price">${product.price}</p>
        </div>
      </div>

      {/* Dynamic slots — each streams independently */}
      <section>
        <h2>Details</h2>
        <Suspense fallback={<ProductDetailsSkeleton />}>
          <ProductDetails id={id} />
        </Suspense>
      </section>

      <section>
        <h2>Reviews</h2>
        <Suspense fallback={<ReviewsSkeleton />}>
          <Reviews productId={id} />
        </Suspense>
      </section>

      <section>
        <h2>You might also like</h2>
        <Suspense fallback={<RecommendationsSkeleton />}>
          <Recommendations productId={id} />
        </Suspense>
      </section>
    </main>
  )
}

// ── Async sub-components (each streams when its data resolves) ─────────────────
async function ProductDetails({ id }: { id: string }) {
  const details = await getProductDetails(id)
  if (!details) return null
  return (
    <dl>
      {details.specs.map((spec) => (
        <div key={spec.key}>
          <dt>{spec.key}</dt>
          <dd>{spec.value}</dd>
        </div>
      ))}
    </dl>
  )
}

async function Reviews({ productId }: { productId: string }) {
  const reviews = await getProductReviews(productId)
  if (!reviews.length) return <p>No reviews yet.</p>
  return (
    <ul>
      {reviews.map((r) => (
        <li key={r.id}>
          <strong>{r.authorName}</strong>: {r.body}
        </li>
      ))}
    </ul>
  )
}

async function Recommendations({ productId }: { productId: string }) {
  const items = await getRecommendations(productId)
  return (
    <ul className="grid grid-cols-3 gap-4">
      {items.map((item) => (
        <li key={item.id}>
          <a href={`/products/${item.id}`}>{item.name}</a>
        </li>
      ))}
    </ul>
  )
}
```

## How it works

1. **Build time**: Next.js pre-renders the static shell (nav, hero, `<h1>`, price). The `<Suspense>` boundaries are recorded as dynamic holes.
2. **Request**: CDN serves the shell instantly (no origin hit).
3. **Streaming**: Origin streams `<ProductDetails>`, `<Reviews>`, and `<Recommendations>` as each resolves, in parallel.
4. **Browser**: React hydrates each slot when its HTML arrives. The page is usable after the first flush (static shell).

## Verification checklist

- [ ] `curl -N https://localhost:3000/products/[id]` shows chunked transfer encoding (streaming active)
- [ ] Static shell (nav, h1, price) is present in the first response chunk
- [ ] Removing `experimental_ppr = true` and re-running shows the page falls back to full SSR
- [ ] Skeleton loaders appear while each section loads in dev mode
- [ ] `revalidateTag('product-reviews-[id]')` from an action refreshes only reviews, not the whole page
- [ ] `next build` output shows the route as PPR (not static, not dynamic)
