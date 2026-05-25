# tanstack-query — Recommended Defaults

Canonical `QueryClient` config. Override per query when needed.

## `QueryClient` baseline

```ts
import { QueryClient } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,              // 1 minute — fresh enough for most reads
      gcTime: 5 * 60_000,             // 5 minutes — keep recently-unmounted in cache
      retry: (failureCount, error) => {
        // Don't retry client errors (4xx)
        if (error instanceof Response && error.status >= 400 && error.status < 500) {
          return false
        }
        return failureCount < 3
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
      refetchOnWindowFocus: 'always', // refetch when tab regains focus
      refetchOnReconnect: 'always',
      refetchOnMount: true,
      networkMode: 'online',          // pause when offline
    },
    mutations: {
      retry: false,                   // mutations should not retry by default
      networkMode: 'online',
    },
  },
})
```

## `staleTime` / `gcTime` per data-type

| Data type | `staleTime` | `gcTime` | Notes |
|---|---|---|---|
| User profile (after login) | `Infinity` | `Infinity` | Logout invalidates manually |
| Catalog / lookups (countries, categories) | `1 hour` | `24 hours` | Rarely change |
| Product detail | `60_000` (1m) | `5 * 60_000` | Background refetch on focus |
| Search results | `30_000` | `2 * 60_000` | Match user's expected freshness |
| Real-time feed (chat, notifications) | `0` | `2 * 60_000` | Always stale — also use streams/sockets |
| Auth status | `60_000` | `Infinity` | Keep last-known across navigations |

**Rule:** `gcTime >= staleTime`. Otherwise the entry is GC'd before going stale.

## `retry` policy

| Endpoint type | Strategy |
|---|---|
| Read endpoints | retry 3× with exponential backoff (default config above) |
| Mutations (POST/PATCH/DELETE) | `retry: false` — let the user retry manually |
| 4xx errors | NEVER retry — client error |
| 401/403 | NEVER retry — refresh token or redirect to login |
| 5xx errors | retry up to 3× — transient |
| Network failures | retry — handled by `networkMode` |

## `refetchOnWindowFocus`

| Value | Effect | Use case |
|---|---|---|
| `'always'` ⭐ | refetch even if data is fresh | most production apps |
| `true` (default) | refetch only if stale | minor optimization, rarely matters |
| `false` | never refetch | dashboards with manual refresh button only |

## Mutation defaults — optimistic updates

```ts
const mutation = useMutation({
  mutationFn: updateUser,

  // Snapshot + optimistic write
  onMutate: async (newUser) => {
    await queryClient.cancelQueries({ queryKey: ['user', newUser.id] })
    const previous = queryClient.getQueryData(['user', newUser.id])
    queryClient.setQueryData(['user', newUser.id], newUser)
    return { previous }
  },

  // Rollback on error
  onError: (_err, _newUser, context) => {
    if (context?.previous) {
      queryClient.setQueryData(['user', context.previous.id], context.previous)
    }
  },

  // ALWAYS invalidate on settle (success or error)
  onSettled: (_data, _err, variables) => {
    queryClient.invalidateQueries({ queryKey: ['user', variables.id] })
  },
})
```

## Query keys — factory pattern

```ts
// features/users/queries.ts
export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (filters: UserFilters) => [...userKeys.lists(), filters] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
}

// Invalidate ALL user lists (but not details) after creating a user:
queryClient.invalidateQueries({ queryKey: userKeys.lists() })

// Invalidate one specific user:
queryClient.invalidateQueries({ queryKey: userKeys.detail(id) })
```

## SSR / Next.js App Router

```ts
// One QueryClient per request — NEVER module-level singleton
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
      },
      dehydrate: {
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
      },
    },
  })
}
```

## Tuning ranges

| Knob | Default | Min sane | Max sane | Notes |
|---|---|---|---|---|
| `staleTime` | `60_000` | `0` | `Infinity` | match data volatility |
| `gcTime` | `5 * 60_000` | `staleTime` | `Infinity` | must be >= staleTime |
| `retry` | 3× | 0 | 5 | exponential backoff caps blast radius |
| `retryDelay` cap | `30_000` | `1000` | `60_000` | upper bound on exponential |
| `refetchOnWindowFocus` | `'always'` | — | — | `false` for dashboards |

## See also

- [queries.md](queries.md) — full useQuery API
- [mutations.md](mutations.md) — mutation lifecycle
- [cache-management.md](cache-management.md) — invalidation strategies
- [troubleshooting.md](troubleshooting.md) — when defaults misbehave
