# nextjs — Wrong vs Right

Pattern pairs. The left column is what new code accidentally produces; the right is the canonical Next 16 form.

## 1. `cookies()` / `headers()` — sync vs async

```ts
// ❌ Wrong (Next 15 style; throws in Next 16)
import { cookies } from 'next/headers'
const token = cookies().get('token')

// ✅ Right (Next 16)
const cookieStore = await cookies()
const token = cookieStore.get('token')
```

`cookies()`, `headers()`, `draftMode()` all return Promises in Next 16. Same goes for `params` and `searchParams` in page/route handler props.

## 2. Force-dynamic — `fetch` opt-out vs route segment config

```ts
// ❌ Wrong (Next 15 idiom no longer the canonical lever)
const data = await fetch(url, { cache: 'no-store' })

// ✅ Right (Next 16) — opt out at the segment level
// page.tsx
export const dynamic = 'force-dynamic'
const data = await fetch(url)   // now always uncached
```

Or — if only a *single* call should be uncached, leave the rest cacheable and use `noStore()`:

```ts
import { unstable_noStore as noStore } from 'next/cache'

export async function getLiveStock(id: string) {
  noStore()
  return db.stock.find(id)
}
```

In Next 16 the segment-level `dynamic` / `'use cache'` is the primary lever; `fetch` cache options are a fallback.

## 3. Server Action validation — raw vs Zod safeParse

```ts
// ❌ Wrong — trusting FormData shape
'use server'
export async function createPost(_: unknown, formData: FormData) {
  const title = formData.get('title') as string   // unchecked cast
  await db.posts.insert({ title })                // could be empty / undefined
}

// ✅ Right — Zod safeParse, return errors for useActionState
'use server'
import { z } from 'zod'

const PostSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1),
})

export async function createPost(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = PostSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }
  await db.posts.insert(parsed.data)
  revalidateTag('posts')
  redirect('/posts')
}
```

## 4. Suspense placement — page-level vs scoped

```tsx
// ❌ Wrong — one Suspense at the top defeats streaming
export default async function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Hero />
      <ProductList />
      <Reviews />
    </Suspense>
  )
}

// ✅ Right — scope each async leaf
export default function Page() {
  return (
    <>
      <Hero />                                    {/* static, no Suspense */}
      <Suspense fallback={<ListSkeleton />}>
        <ProductList />                           {/* async, streams independently */}
      </Suspense>
      <Suspense fallback={<ReviewsSkeleton />}>
        <Reviews />                               {/* async, streams independently */}
      </Suspense>
    </>
  )
}
```

With PPR enabled, only the contents of `<Suspense>` are dynamic; everything outside is static-prerendered.

## 5. Revalidation — path vs tag

```ts
// ❌ Wrong — coarse, invalidates the whole route tree
'use server'
export async function updateProduct(id: string, data: FormData) {
  await db.products.update({ id, data })
  revalidatePath('/products')   // also blows /products/[id], /products/list, etc.
}

// ✅ Right — surgical, by tag
'use server'
export async function updateProduct(id: string, data: FormData) {
  await db.products.update({ id, data })
  revalidateTag(`product-${id}`)   // only this product's cached calls
}
```

Use `cacheTag()` on the cached function and `revalidateTag()` on mutation.

## 6. Client Component fetching for mutations

```tsx
// ❌ Wrong — raw fetch from Client, no progressive enhancement
'use client'
function CreateForm() {
  const onSubmit = async (e) => {
    e.preventDefault()
    await fetch('/api/posts', { method: 'POST', body: new FormData(e.target) })
  }
  return <form onSubmit={onSubmit}>...</form>
}

// ✅ Right — Server Action with useActionState
'use client'
import { useActionState } from 'react'
import { createPost } from './actions'

function CreateForm() {
  const [state, action, isPending] = useActionState(createPost, { errors: {} })
  return (
    <form action={action}>
      <input name="title" />
      {state.errors?.title && <p>{state.errors.title}</p>}
      <button disabled={isPending}>Create</button>
    </form>
  )
}
```

Progressive enhancement (works without JS), automatic pending state, type-safe action signature, server-side validation, free CSRF.

## See also

- [caching.md](caching.md), [examples/server-action-with-form.md](../examples/server-action-with-form.md), [troubleshooting.md](troubleshooting.md)
