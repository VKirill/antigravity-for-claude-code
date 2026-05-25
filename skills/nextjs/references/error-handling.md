# Next.js 16 — Error Handling

## Error boundary files

| File | When rendered | Component type | Receives |
|---|---|---|---|
| `error.tsx` | Unhandled error in segment | `'use client'` | `error`, `reset` |
| `global-error.tsx` | Unhandled error in root layout | `'use client'` | `error`, `reset` |
| `not-found.tsx` | `notFound()` called | Server Component | nothing |
| `forbidden.tsx` | `forbidden()` called (Next.js 16+) | Server Component | nothing |
| `unauthorized.tsx` | `unauthorized()` called (Next.js 16+) | Server Component | nothing |

## error.tsx

```tsx
// app/products/error.tsx
'use client'

import { useEffect } from 'react'

export default function ProductsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log to your error tracking service
    console.error('Products segment error:', error)
  }, [error])

  return (
    <div>
      <h2>Something went wrong in Products</h2>
      <p>{error.message}</p>
      {error.digest && <p>Error ID: {error.digest}</p>}
      <button onClick={reset}>Try again</button>
    </div>
  )
}
```

`reset()` re-renders the segment without a full page reload. `error.digest` is a stable identifier for the error — log it and show it to users so support can correlate with server logs.

## global-error.tsx

Catches errors that bubble up through the root layout. Replaces the root layout entirely, so it must include `<html>` and `<body>`:

```tsx
// app/global-error.tsx
'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <h1>Application error</h1>
        <p>Digest: {error.digest}</p>
        <button onClick={reset}>Reload</button>
      </body>
    </html>
  )
}
```

`global-error.tsx` only activates in production. In development, the Next.js overlay shows instead.

## Nesting error boundaries

Place `error.tsx` at the most specific segment to limit blast radius:

```
app/
  error.tsx             ← catches errors from any segment without its own error.tsx
  products/
    error.tsx           ← catches errors only in products segment
    [id]/
      page.tsx
  orders/
    page.tsx            ← no error.tsx: bubbles up to app/error.tsx
```

An error in `app/products/[id]/page.tsx` is caught by `app/products/error.tsx`. An error in `app/orders/page.tsx` is caught by `app/error.tsx`.

## not-found.tsx

```tsx
// app/not-found.tsx — global 404
export default function NotFound() {
  return (
    <main>
      <h1>404 — Page not found</h1>
      <a href="/">Go home</a>
    </main>
  )
}
```

Triggered by:

```ts
// In any Server Component or Server Action
import { notFound } from 'next/navigation'

export default async function ProductPage({ params }: Props) {
  const { id } = await params
  const product = await getProduct(id)
  if (!product) notFound()              // throws — terminates render
  return <div>{product.name}</div>
}
```

Segment-level `not-found.tsx` takes precedence over the root one:

```
app/
  not-found.tsx         ← global 404
  products/
    not-found.tsx       ← 404 specific to products (overrides global for this segment)
    [id]/
      page.tsx
```

## forbidden.tsx and unauthorized.tsx (Next.js 16+)

New in Next.js 16. Provide semantic HTTP 403/401 responses with distinct UIs.

```tsx
// app/forbidden.tsx
export default function Forbidden() {
  return (
    <main>
      <h1>403 — Forbidden</h1>
      <p>You don't have permission to access this page.</p>
    </main>
  )
}
```

```tsx
// app/unauthorized.tsx
export default function Unauthorized() {
  return (
    <main>
      <h1>401 — Unauthorized</h1>
      <a href="/login">Log in</a>
    </main>
  )
}
```

Trigger from Server Components or Server Actions:

```ts
import { forbidden, unauthorized, notFound } from 'next/navigation'

async function checkAccess(userId: string) {
  const session = await getSession()
  if (!session) unauthorized()        // → app/unauthorized.tsx
  if (!session.isAdmin) forbidden()   // → app/forbidden.tsx
}
```

Enable in `next.config.ts`:

```ts
const config: NextConfig = {
  experimental: {
    authInterrupts: true,   // enables forbidden() and unauthorized() in Next.js 16
  },
}
```

## Error logging

Connect to Sentry or similar in `error.tsx`:

```tsx
// app/error.tsx
'use client'
import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])
  return <button onClick={reset}>Try again</button>
}
```

For Sentry with Next.js 16: install `@sentry/nextjs` and run `npx @sentry/wizard@latest -i nextjs`. The wizard patches `next.config.ts` and injects instrumentation.

## Server Action error handling

Server Actions throw to the nearest error boundary, but you usually want structured errors for form feedback rather than full error boundaries:

```ts
// app/actions.ts
'use server'

type ActionResult = { success: true } | { success: false; error: string }

export async function updateProduct(id: string, formData: FormData): Promise<ActionResult> {
  try {
    await db.products.update({ where: { id }, data: Object.fromEntries(formData) })
    return { success: true }
  } catch (err) {
    if (err instanceof ValidationError) return { success: false, error: err.message }
    throw err   // re-throw unexpected errors → triggers error boundary
  }
}
```

```tsx
// Component
'use client'
const [state, action] = useActionState(updateProduct.bind(null, productId), null)
return (
  <form action={action}>
    {state && !state.success && <p className="error">{state.error}</p>}
    ...
  </form>
)
```

## Route Handler error responses

```ts
// app/api/products/[id]/route.ts
import { NextResponse } from 'next/server'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const product = await getProduct(id)
    if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(product)
  } catch (err) {
    console.error('Product route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```
