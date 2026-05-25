# TanStack Query 5 — Queries

## Query Key Factory Pattern

Query keys are the cache identity. Wrong or inconsistent keys cause stale data, ghost cache entries, and invalidation that doesn't propagate. Use the factory pattern — one object per feature, colocated with its queries.

```ts
// src/features/posts/query-keys.ts
export const postKeys = {
  // Root key — invalidates EVERYTHING for this feature
  all: ['posts'] as const,

  // List namespace — invalidates all list variants
  lists: () => [...postKeys.all, 'list'] as const,
  list: (filters: PostFilters) => [...postKeys.lists(), filters] as const,

  // Detail namespace — invalidates all detail variants
  details: () => [...postKeys.all, 'detail'] as const,
  detail: (id: string) => [...postKeys.details(), id] as const,

  // Nested resource — e.g., comments on a post
  comments: (postId: string) => [...postKeys.detail(postId), 'comments'] as const,
};
```

Invalidation ladder:
- `postKeys.all` — invalidates everything (list + detail)
- `postKeys.lists()` — invalidates all list views only
- `postKeys.list(filters)` — invalidates exactly this filtered list
- `postKeys.detail(id)` — invalidates one item

### Key Rules

1. Always an array — `['posts']` not `'posts'`
2. Serializable values only — objects, arrays, primitives. No class instances, no functions.
3. All variables that affect the fetch result must be in the key
4. Hierarchical from stable → variable: `['posts', 'list', { status: 'active', userId }]`

---

## useQuery

### Core signature

```ts
const result = useQuery({
  queryKey: postKeys.detail(id),
  queryFn: ({ signal }) => fetchPost(id, signal),
  // options...
});
```

`queryFn` receives `{ queryKey, signal, meta }`. Always pass `signal` to fetch for automatic cancellation.

### enabled — conditional queries

```ts
// Fetch user's posts only when userId is known
const { data: posts } = useQuery({
  queryKey: postKeys.list({ userId }),
  queryFn: () => fetchUserPosts(userId!),
  enabled: !!userId,               // boolean — falsy disables
});

// Chained query: fetch post, then fetch its author
const { data: post } = useQuery({ queryKey: postKeys.detail(id), queryFn: ... });
const { data: author } = useQuery({
  queryKey: userKeys.detail(post?.authorId ?? ''),
  queryFn: () => fetchUser(post!.authorId),
  enabled: !!post?.authorId,       // only when post loaded
});
```

Never pass `undefined` to disabled query keys — use a safe fallback or rely solely on `enabled`.

### select — transform and subscribe to a slice

`select` transforms query data before returning to the component. The component only re-renders when the selected slice changes, not the full response.

```ts
// Expensive computation memoized: only re-runs when posts data changes
const { data: activePosts } = useQuery({
  queryKey: postKeys.list({}),
  queryFn: fetchAllPosts,
  select: (data) => data.filter((p) => p.status === 'active'),
});

// Subscribe to count only — no re-render when item content changes
const { data: count } = useQuery({
  queryKey: postKeys.list({}),
  queryFn: fetchAllPosts,
  select: (data) => data.length,
});
```

Memoize expensive selects with `useCallback` if the function captures state or props.

### placeholderData — keep previous results during refetch

Replaces v4 `keepPreviousData`. Shows previous data while new data loads (no loading flash on filter change).

```ts
import { keepPreviousData } from '@tanstack/react-query';

const { data, isFetching } = useQuery({
  queryKey: postKeys.list(filters),     // filters change on user interaction
  queryFn: () => fetchPosts(filters),
  placeholderData: keepPreviousData,    // show old list until new one arrives
});

// Visual indicator that data is refreshing
return (
  <div style={{ opacity: isFetching ? 0.5 : 1 }}>
    {data?.items.map((post) => <PostCard key={post.id} post={post} />)}
  </div>
);
```

Alternatively, supply a static placeholder:
```ts
placeholderData: { items: [], total: 0 }   // static fallback shape
```

### refetchInterval — polling

```ts
const { data: status } = useQuery({
  queryKey: ['job', jobId, 'status'],
  queryFn: () => fetchJobStatus(jobId),
  refetchInterval: (query) => {
    // Dynamic interval: stop polling when complete
    if (query.state.data?.status === 'complete') return false;
    return 3000; // 3s while running
  },
  refetchIntervalInBackground: false,    // pause when tab hidden
});
```

### staleTime and gcTime

| Option | Default | Controls |
|---|---|---|
| `staleTime` | `0` | When background refetch triggers (0 = always refetch) |
| `gcTime` | `5 * 60 * 1000` | When unused entries are garbage collected |

Production baselines:
```ts
staleTime: 60 * 1000        // 1 min: most API data
staleTime: 5 * 60 * 1000    // 5 min: slower-changing data
staleTime: Infinity          // immutable data (user session, config)
```

Rule: `gcTime` must always be `>= staleTime`. If gcTime < staleTime, the cache entry is garbage collected before it ever becomes stale — data appears to vanish.

### Return value shape

```ts
const {
  data,          // TData | undefined — undefined until first success
  error,         // TError | null
  isPending,     // true when no data yet (loading + no cached data)
  isFetching,    // true during any background fetch (incl. refetch)
  isSuccess,     // true when data is present
  isError,       // true when error present
  isStale,       // data is older than staleTime
  refetch,       // () => Promise<QueryObserverResult> — manual trigger
  status,        // 'pending' | 'error' | 'success'
  fetchStatus,   // 'fetching' | 'paused' | 'idle'
} = useQuery({ ... });
```

Key distinction: `isPending` is about data availability; `isFetching` is about network activity. A refetch has `isSuccess && isFetching` simultaneously.

---

## useQueries — parallel queries

```ts
const queries = useQueries({
  queries: ids.map((id) => ({
    queryKey: postKeys.detail(id),
    queryFn: () => fetchPost(id),
    staleTime: 5 * 60 * 1000,
  })),
});
// queries: QueryObserverResult[]
const allLoaded = queries.every((q) => q.isSuccess);
```

---

## Query Cancellation

Pass `signal` from `queryFn` to the underlying request. TanStack Query cancels in-flight requests when:
- Component unmounts
- Query key changes (new navigation)
- `queryClient.cancelQueries({ queryKey })` is called manually

```ts
// fetch-based cancellation
queryFn: async ({ signal }) => {
  const response = await fetch(`/api/posts/${id}`, { signal });
  if (!response.ok) throw new Error('Failed to fetch');
  return response.json();
}

// axios cancellation
queryFn: async ({ signal }) => {
  const { data } = await axios.get(`/api/posts/${id}`, { signal });
  return data;
}
```

---

## Retry Configuration

Default: 3 retries with exponential backoff. Never retry 4xx client errors.

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry client errors (4xx)
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          return false;
        }
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
    },
  },
});
```

Override per-query for specific resources:
```ts
useQuery({
  queryKey: ['search', query],
  queryFn: () => searchPosts(query),
  retry: 1,          // search: fail fast
  retryDelay: 500,
})
```

---

## Prefetching

```ts
// On hover / intent signal — warm cache before navigation
async function prefetchPost(queryClient: QueryClient, id: string) {
  await queryClient.prefetchQuery({
    queryKey: postKeys.detail(id),
    queryFn: () => fetchPost(id),
    staleTime: 5 * 60 * 1000,    // don't prefetch if already fresh
  });
}

// In component
const queryClient = useQueryClient();
<Link
  href={`/posts/${id}`}
  onMouseEnter={() => prefetchPost(queryClient, id)}
>
```

`prefetchQuery` is a no-op if data is already fresh (stale time applies). Safe to call on every hover.
