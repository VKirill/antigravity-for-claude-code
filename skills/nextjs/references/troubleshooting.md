# nextjs — Troubleshooting

Symptom-indexed. Find the symptom, then jump to the fix.

## `'use cache'` not invalidating

**Symptom:** `revalidateTag('foo')` is called but next request still returns stale data.

**Causes:**
1. Tag mismatch — `cacheTag('foo')` vs `revalidateTag('foos')` (typo / pluralization)
2. `cacheTag(...)` called *after* the cached value was computed — must be inside the `'use cache'` function before the async work
3. Cached function lives in `'use client'` file — `'use cache'` only works in Server Components / Server Actions / route handlers
4. `revalidateTag` called from a non-mutating context — must be Server Action or route handler

**Fix:**
```ts
'use cache'
import { cacheTag } from 'next/cache'

export async function getProduct(id: string) {
  cacheTag(`product-${id}`)   // FIRST line of the body
  return db.products.findUnique({ where: { id } })
}
```

Then in Server Action: `revalidateTag(\`product-${id}\`)` — same tag string.

## Server Action 413 Payload Too Large

**Symptom:** Multipart upload via Server Action returns 413.

**Cause:** Default `serverActions.bodySizeLimit` is 1 MB.

**Fix:**
```ts
// next.config.ts
serverActions: { bodySizeLimit: '2mb' }
```

For files >4 MB use presigned uploads (S3 / R2 / Vercel Blob) instead of routing bytes through the Server Action.

## Middleware (`proxy.ts`) doesn't run

**Symptom:** `proxy.ts` exists but never executes.

**Causes:**
1. File named `middleware.ts` in a Next 16 project — must be `proxy.ts`
2. Located inside `app/` or `src/app/` — must be at project root or `src/` root
3. `matcher` excludes the route you're testing
4. Request hits a static asset path that the matcher excludes (correct behavior, not a bug)

**Fix:** Move file to project root as `proxy.ts`; verify `matcher` patterns; test with `curl -I` to confirm.

## Hydration mismatch

**Symptom:** Console error: "Hydration failed because the initial UI does not match what was rendered on the server."

**Common causes (in order):**
1. `Date.now()` / `Math.random()` / `new Date()` rendered without `suppressHydrationWarning`
2. Browser-only API (`window`, `localStorage`) called in render — should be in `useEffect`
3. Locale-formatted strings (`toLocaleString()`) differing between server tz and client tz
4. Conditional rendering on `typeof window !== 'undefined'`
5. Browser extension injecting nodes (Grammarly, password managers) — add `suppressHydrationWarning` to `<body>`

**Fix:** Wrap dynamic content in a Client Component that returns `null` on the server (e.g., via `useEffect` + state flag), or use the `use client` + dynamic import `{ ssr: false }` pattern.

## PPR debugging

**Symptom:** PPR enabled but the route renders fully dynamic, or fully static.

**Diagnosis:**
1. Run `next build` then `next start` — `next dev` does NOT exercise PPR
2. Check build output: routes show `◐` (partial) vs `○` (static) vs `λ` (dynamic)
3. If fully dynamic: a non-cached async call exists OUTSIDE `<Suspense>` — wrap it
4. If fully static: no dynamic call exists, or all dynamic calls are inside `'use cache'` (which is what PPR wants — the page is just "static with cached holes")

**Fix:** Place dynamic API calls (`cookies()`, `headers()`, uncached `fetch`) inside `<Suspense fallback={<Skeleton />}>`. The fallback is what gets prerendered in the static shell.

## `cookies()` / `headers()` is a Promise — TypeScript error

**Symptom:** `Property 'get' does not exist on type 'Promise<ReadonlyRequestCookies>'`.

**Cause:** Next 16 made these async.

**Fix:**
```ts
import { cookies, headers } from 'next/headers'

// Correct (Next 16)
const cookieStore = await cookies()
const token = cookieStore.get('token')

// Wrong (Next 15 style)
const token = cookies().get('token')   // ❌ TS + runtime error
```

## `generateMetadata` runs twice

**Symptom:** Logs show `generateMetadata` invoked twice per request.

**Cause:** Normal — Next.js invokes it once for `<head>` rendering and once for streaming metadata. Both should be deterministic and ideally hit cache.

**Fix:** Wrap any DB call inside `generateMetadata` with `'use cache'` so the second invocation is free.

## Server Action mutates DB but UI doesn't update

**Symptom:** Server Action succeeds but the page shows old data.

**Causes:**
1. Missing `revalidateTag` / `revalidatePath` at the end of the action
2. Data fetched on the client via TanStack Query — needs `queryClient.invalidateQueries` instead
3. Cached page revalidating but client component holds stale state

**Fix:** Call `revalidateTag(tag)` (preferred when a tag exists) or `revalidatePath('/route')` at the end of the action. For client-side caches, return success and trigger `queryClient.invalidateQueries` from the client.

## See also

- [caching.md](caching.md) — `'use cache'` semantics
- [middleware.md](middleware.md) — proxy.ts matcher patterns
- [rendering.md](rendering.md) — PPR + Suspense placement
- [recommended-defaults.md](recommended-defaults.md) — canonical config values
