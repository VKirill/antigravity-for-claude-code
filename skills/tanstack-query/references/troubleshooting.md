# tanstack-query — Troubleshooting

Symptom-indexed.

## Stale data after mutation

**Symptom:** `useMutation` succeeds (200 OK) but list/detail still shows old data.

**Causes:**
1. Missing `onSettled` invalidation
2. Key mismatch — `invalidateQueries({ queryKey: ['user'] })` vs query key `['users', 'detail', id]`
3. Invalidation called WITHOUT `await` inside `onSettled` and component unmounted before refetch fired

**Fix:**
```ts
useMutation({
  mutationFn: updateUser,
  onSettled: async (_data, _err, variables) => {
    await queryClient.invalidateQueries({ queryKey: userKeys.detail(variables.id) })
    await queryClient.invalidateQueries({ queryKey: userKeys.lists() })
  },
})
```

Use the query key factory pattern to guarantee shape match between query and invalidation.

## Refetch infinite loop

**Symptom:** Network tab shows endless requests to the same endpoint.

**Causes:**
1. `queryFn` mutates a value in the queryKey on each call
2. `enabled` depends on data from the same query
3. `select` returns a new object reference each call AND a child invalidates on selected value change

**Fix:** Stabilize the queryKey, gate `enabled` on a different source, and make `select` return stable references for the same input (or wrap in a memoized selector).

## Hydration mismatch in SSR (Next.js)

**Symptom:** Server-rendered HTML shows data; client hydration throws "Hydration failed" or refetches and flashes.

**Causes:**
1. Different `QueryClient` instance per render — shared module-level singleton across requests (data leakage)
2. `staleTime: 0` (default) — client immediately considers data stale and refetches
3. Dehydrated state doesn't include all keys the client tries to read

**Fix:**
```tsx
// Provider — one QueryClient per request via state
'use client'
function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 60_000 } },
  }))
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
```

Set `staleTime >= 1` second so the client doesn't refetch on mount if data is fresh.

## `useQuery` returns `undefined` data even after success

**Symptom:** `const { data } = useQuery(...)` — `data` is `undefined` despite the network call returning 200.

**Causes:**
1. `queryFn` doesn't return a value — `await fetch(...)` without parsing JSON
2. `queryFn` throws but caller treats failure as success
3. `select` returns `undefined` when data is loading

**Fix:**
```ts
queryFn: async () => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()                       // must return
}
```

For type narrowing in components, use `useSuspenseQuery` — data is non-nullable after Suspense.

## `useInfiniteQuery` doesn't load next page

**Symptom:** `hasNextPage` is `true` but `fetchNextPage()` doesn't fire, or fires once and stops.

**Causes:**
1. `getNextPageParam` returning `null` — v5 changed: `null` means "has next page"; return `undefined` to stop
2. `initialPageParam` missing (required in v5)
3. Cursor field name mismatch between API response and `getNextPageParam`

**Fix:**
```ts
useInfiniteQuery({
  queryKey: ['posts'],
  queryFn: ({ pageParam }) => fetchPosts(pageParam),
  initialPageParam: 0,
  getNextPageParam: (lastPage) =>
    lastPage.nextCursor ?? undefined,    // undefined → stop pagination
})
```

## Optimistic update vanishes after server response

**Symptom:** UI shows optimistic value, then snaps back to old value briefly, then to new value.

**Cause:** `onSettled` invalidates BEFORE the server response has been merged into cache — refetch returns the still-not-updated server state momentarily.

**Fix:** Cancel in-flight queries before optimistic update; let server response drive the final reconciliation:

```ts
onMutate: async (newValue) => {
  await queryClient.cancelQueries({ queryKey })   // critical — stops in-flight refetch
  const previous = queryClient.getQueryData(queryKey)
  queryClient.setQueryData(queryKey, newValue)
  return { previous }
},
```

## `useSuspenseQuery` doesn't trigger Suspense

**Symptom:** Loading state shows briefly as `undefined` then data renders; expected the Suspense fallback.

**Cause:** Component renders `useSuspenseQuery` but is NOT inside a `<Suspense>` boundary, OR data is already cached so suspense doesn't trigger.

**Fix:** Wrap the consumer:
```tsx
<ErrorBoundary fallback={<Error />}>
  <Suspense fallback={<Skeleton />}>
    <UserCard id={id} />
  </Suspense>
</ErrorBoundary>
```

If data is cached, that's correct — suspense only triggers on cache miss.

## v4 → v5 migration: `cacheTime` doesn't work

**Symptom:** Setting `cacheTime: 60_000` has no effect — entries GC at default 5 minutes.

**Cause:** v5 renamed it to `gcTime`. Old key is silently ignored.

**Fix:**
```ts
// Wrong (v4)
useQuery({ queryKey, queryFn, cacheTime: 60_000 })

// Right (v5)
useQuery({ queryKey, queryFn, gcTime: 60_000 })
```

Other v5 renames: `keepPreviousData: true` → `placeholderData: keepPreviousData` (imported); `isLoading` → `isPending`; `status: 'loading'` → `status: 'pending'`.

## Mutation `onSuccess` doesn't fire after navigation

**Symptom:** User submits form, navigates away, mutation eventually completes but `onSuccess` toast doesn't show.

**Cause:** Component-level mutation observer was unmounted before mutation finished. v5 removed component-level `onSuccess` callback for queries; mutations still have it but require the component to be mounted.

**Fix:** Use `MutationCache` event handlers for global side effects (toasts, analytics):

```ts
new QueryClient({
  mutationCache: new MutationCache({
    onSuccess: (_data, _variables, _context, mutation) => {
      if (mutation.meta?.toastSuccess) toast.success(mutation.meta.toastSuccess as string)
    },
  }),
})
```

## See also

- [queries.md](queries.md), [mutations.md](mutations.md), [cache-management.md](cache-management.md), [ssr-prefetch.md](ssr-prefetch.md), [recommended-defaults.md](recommended-defaults.md)
