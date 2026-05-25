# Next.js 16 — Metadata and SEO

## Static metadata

Export a `metadata` object from `page.tsx` or `layout.tsx`:

```ts
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'My App',
  description: 'What my app does',
  keywords: ['nextjs', 'react'],
  authors: [{ name: 'Kirill' }],
  robots: { index: true, follow: true },
  openGraph: {
    title: 'My App',
    description: 'What my app does',
    url: 'https://example.com',
    siteName: 'My App',
    type: 'website',
    images: [{ url: '/og-default.jpg', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'My App',
    description: 'What my app does',
    images: ['/og-default.jpg'],
  },
}
```

Layout metadata is inherited by all child pages unless overridden. More specific metadata wins.

## Dynamic metadata — `generateMetadata`

```ts
import type { Metadata } from 'next'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const product = await getProduct(id)       // same data function used in the page

  if (!product) return { title: 'Not Found' }

  return {
    title: product.name,
    description: product.description,
    openGraph: {
      title: product.name,
      description: product.description,
      images: [
        {
          url: product.imageUrl,
          width: 1200,
          height: 630,
          alt: product.name,
        },
      ],
    },
  }
}
```

Next.js deduplicates the data fetch — if both `generateMetadata` and the page component call the same `'use cache'` function with the same args, the result is reused.

## Metadata template (title inheritance)

```ts
// app/layout.tsx
export const metadata: Metadata = {
  title: {
    template: '%s | My App',   // child titles slot into %s
    default: 'My App',         // used when no child title set
  },
}

// app/products/page.tsx
export const metadata: Metadata = {
  title: 'Products',           // renders as "Products | My App"
}
```

## OpenGraph image route

Generate dynamic OG images using `ImageResponse` from `next/og`:

```tsx
// app/og/route.tsx
import { ImageResponse } from 'next/og'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const title = searchParams.get('title') ?? 'Default Title'

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          fontSize: 60,
          color: 'white',
          background: '#000',
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {title}
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
```

Use from metadata:

```ts
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const product = await getProduct(id)
  return {
    openGraph: {
      images: [{ url: `/og?title=${encodeURIComponent(product.name)}` }],
    },
  }
}
```

The `/og` route can also be colocated at `app/products/[id]/opengraph-image.tsx` as a special convention — Next.js handles the route automatically.

## `opengraph-image` and `twitter-image` conventions

Place these files in a route segment to auto-register OG images without manually linking in metadata:

```
app/
  opengraph-image.tsx      ← global OG image (ImageResponse)
  opengraph-image.png      ← static global OG image
  products/
    [id]/
      opengraph-image.tsx  ← dynamic OG image for this segment
```

```tsx
// app/products/[id]/opengraph-image.tsx
import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const product = await getProduct(id)
  return new ImageResponse(<div>{product.name}</div>, size)
}
```

## Sitemap

```ts
// app/sitemap.ts
import type { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getProducts()
  return [
    { url: 'https://example.com', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    ...products.map((p) => ({
      url: `https://example.com/products/${p.id}`,
      lastModified: p.updatedAt,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
  ]
}
```

Next.js generates `/sitemap.xml` automatically from this export. For large sitemaps (>50k URLs), use `generateSitemaps()` to split:

```ts
export async function generateSitemaps() {
  const count = await getProductCount()
  return Array.from({ length: Math.ceil(count / 50000) }, (_, i) => ({ id: i }))
}

export default async function sitemap({ id }: { id: number }) {
  const products = await getProducts({ page: id, pageSize: 50000 })
  // ...
}
```

## robots.txt

```ts
// app/robots.ts
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/'],
      },
    ],
    sitemap: 'https://example.com/sitemap.xml',
  }
}
```

## JSON-LD structured data

Add structured data via a `<script>` tag in Server Components:

```tsx
// app/products/[id]/page.tsx
export default async function ProductPage({ params }: Props) {
  const { id } = await params
  const product = await getProduct(id)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: 'USD',
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* page content */}
    </>
  )
}
```

## Canonical URLs

```ts
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  return {
    alternates: {
      canonical: `https://example.com/products/${id}`,
      languages: {
        'en-US': `https://example.com/en/products/${id}`,
        'ru-RU': `https://example.com/ru/products/${id}`,
      },
    },
  }
}
```
