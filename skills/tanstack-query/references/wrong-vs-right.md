# tanstack-query — Wrong vs Right

Pattern pairs.

## 1. Coarse vs hierarchical query keys

```ts
// ❌ Wrong — string keys, opaque invalidation
useQuery({ queryKey: ['users'], queryFn: fetchUsers })
queryClient.invalidateQueries({ queryKey: ['users'] })   // blows everything

// ✅ Right — factory + hierarchical
export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (filters: UserFilters) => [...userKeys.lists(), filters] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
}

useQuery({ queryKey: userKeys.list({ active: true }), queryFn: ... })
// Invalidate ALL lists (but not details) after create:
queryClient.invalidateQueries({ queryKey: userKeys.lists() })
```

## 2. `cacheTime` (v4) vs `gcTime` (v5)

```ts
// ❌ Wrong (v4 API — silently ignored in v5)
useQuery({ queryKey, queryFn, cacheTime: 60_000 })

// ✅ Right (v5)
useQuery({ queryKey, queryFn, gcTime: 60_000 })
```

## 3. `keepPreviousData` (v4) vs `placeholderData` (v5)

```ts
// ❌ Wrong (v4 — flagged by TS)
useQuery({ queryKey, queryFn, keepPreviousData: true })

// ✅ Right (v5)
import { keepPreviousData } from '@tanstack/react-query'
useQuery({ queryKey, queryFn, placeholderData: keepPreviousData })
```

## 4. `useQuery({ onSuccess })` (v4) vs `QueryCache` event handler (v5)

```ts
// ❌ Wrong (v4 — removed in v5)
useQuery({
  queryKey,
  queryFn,
  onSuccess: (data) => analytics.track('loaded', data),
})

// ✅ Right (v5 — global side effects via QueryCache)
new QueryClient({
  queryCache: new QueryCache({
    onSuccess: (data, query) => {
      if (query.meta?.trackOnSuccess) analytics.track('loaded', data)
    },
  }),
})

// Or — for component-level side effects, use useEffect on `data`
const { data } = useQuery(...)
useEffect(() => { if (data) analytics.track('loaded', data) }, [data])
```

## 5. Missing `onSettled` after mutation

```ts
// ❌ Wrong — stale data after success
useMutation({
  mutationFn: createPost,
  onSuccess: () => toast('Created'),
  // No invalidation — list won't refresh
})

// ✅ Right — onSettled fires on both success AND error
useMutation({
  mutationFn: createPost,
  onSuccess: () => toast('Created'),
  onSettled: () => queryClient.invalidateQueries({ queryKey: postKeys.lists() }),
})
```

`onSettled` runs after `onSuccess` / `onError`. Putting invalidation here ensures cache refresh even if the optimistic update succeeded but the server returned a different shape.

## 6. Module-level vs per-request `QueryClient` (SSR)

```ts
// ❌ Wrong — shared across requests, data leaks between users
const queryClient = new QueryClient()

export function Providers({ children }: Props) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

// ✅ Right — one per request via React state
'use client'
export function Providers({ children }: Props) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 60_000 } },
  }))
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
```

In React Server Components, create a fresh `new QueryClient()` per `prefetchQuery` call.

## 7. `useEffect` data fetching vs `useQuery`

```tsx
// ❌ Wrong — manual loading state, no cache, no retry, no dedup
function UserCard({ id }: { id: string }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch(`/api/users/${id}`).then(r => r.json()).then(u => { setUser(u); setLoading(false) })
  }, [id])
  if (loading) return <Skeleton />
  return <h2>{user?.name}</h2>
}

// ✅ Right — TanStack Query handles all of it
function UserCard({ id }: { id: string }) {
  const { data: user, isPending } = useQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => fetch(`/api/users/${id}`).then(r => r.json()),
  })
  if (isPending) return <Skeleton />
  return <h2>{user.name}</h2>
}
```

Or with Suspense: `useSuspenseQuery` + `<Suspense fallback>` wrapper — data is non-nullable inside.

## See also

- [queries.md](queries.md), [mutations.md](mutations.md), [cache-management.md](cache-management.md), [troubleshooting.md](troubleshooting.md)
