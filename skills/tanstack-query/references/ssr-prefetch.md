# TanStack Query 5 — SSR Prefetching (Next.js App Router)

## Concept

Server-side prefetching sends pre-populated cache to the client so queries resolve immediately without a loading state. The flow:

```
Server Component
  → new QueryClient()              [per-request — never module-level]
  → prefetchQuery(queryKey, fn)    [fetch data on server]
  → dehydrate(queryClient)         [serialize cache to JSON]
  → <HydrationBoundary>            [pass to client]
    → Client Component
      → useQuery(queryKey)         [reads hydrated cache, no network request]
```

---

## Installation

```bash
# v5 ships dehydrate/hydrate in core — no extra package
npm install @tanstack/react-query
```

---

## Per-request QueryClient factory

**Critical**: never create `QueryClient` at module level in Next.js SSR. Each request must get its own instance to prevent data leakage between users.

```ts
// src/lib/query-client.ts
import { QueryClient, defaultShouldDehydrateQuery } from '@tanstack/react-query';

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,     // 1 min — avoids immediate refetch on hydration
        gcTime: Infinity,          // keep dehydrated data alive until client GCs it
      },
      dehydrate: {
        // Dehydrate pending queries too (for Suspense streaming)
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === 'pending',
      },
    },
  });
}
```

The `gcTime: Infinity` on the server prevents garbage collection of prefetched data before it's serialized. The client has its own gcTime.

---

## Server Component pattern

```tsx
// app/posts/page.tsx  (Server Component — no 'use client')
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { makeQueryClient } from '@/lib/query-client';
import { postKeys } from '@/features/posts/query-keys';
import { fetchPosts } from '@/features/posts/api';
import { PostList } from './post-list'; // Client Component

export default async function PostsPage() {
  const queryClient = makeQueryClient();

  // Prefetch in parallel if multiple queries needed
  await queryClient.prefetchQuery({
    queryKey: postKeys.list({}),
    queryFn: fetchPosts,
  });

  return (
    // dehydrate serializes the cache to a plain object
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PostList />
    </HydrationBoundary>
  );
}
```

### Prefetching multiple queries in parallel

```tsx
export default async function PostDetailPage({ params }: { params: { id: string } }) {
  const { id } = await params; // Next.js 16: params is async
  const queryClient = makeQueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: postKeys.detail(id),
      queryFn: () => fetchPost(id),
    }),
    queryClient.prefetchQuery({
      queryKey: userKeys.detail('me'),
      queryFn: fetchCurrentUser,
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PostDetail id={id} />
    </HydrationBoundary>
  );
}
```

---

## Client Component

The client component uses `useQuery` normally. If data is hydrated, the query starts in `success` state with no network request.

```tsx
// app/posts/post-list.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { postKeys } from '@/features/posts/query-keys';
import { fetchPosts } from '@/features/posts/api';

export function PostList() {
  const { data, isPending } = useQuery({
    queryKey: postKeys.list({}),
    queryFn: fetchPosts,
    staleTime: 60 * 1000,   // Must match server staleTime or data refetches immediately
  });

  // isPending is false on first render when hydrated — data is available immediately
  if (isPending) return <Spinner />;

  return (
    <ul>
      {data?.items.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}
```

**staleTime mismatch bug**: If server prefetches with `staleTime: 60_000` but client has `staleTime: 0` (default), the hydrated data is immediately stale and the client refetches on mount. Always set consistent `staleTime`.

---

## Nested prefetching

For deeply nested routes, prefetch at each Server Component level:

```tsx
// Layout Server Component — prefetch shared data
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const queryClient = makeQueryClient();

  await queryClient.prefetchQuery({
    queryKey: userKeys.detail('me'),
    queryFn: fetchCurrentUser,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {children}
    </HydrationBoundary>
  );
}

// Page Server Component — prefetch page-specific data
// HydrationBoundary instances merge — no conflict
export default async function PostsPage() {
  const queryClient = makeQueryClient();

  await queryClient.prefetchQuery({
    queryKey: postKeys.list({}),
    queryFn: fetchPosts,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PostList />
    </HydrationBoundary>
  );
}
```

Multiple `HydrationBoundary` instances merge — inner boundaries override outer for conflicting keys.

---

## Prefetching infinite queries

```tsx
await queryClient.prefetchInfiniteQuery({
  queryKey: postKeys.infinite({}),
  queryFn: ({ pageParam }) => fetchPostsPage({ cursor: pageParam }),
  initialPageParam: null,
  pages: 1,   // prefetch only first page
});
```

---

## Error handling in prefetch

`prefetchQuery` swallows errors (it won't throw — the client will handle the error state). If you need server-side error handling:

```tsx
try {
  await queryClient.fetchQuery({
    queryKey: postKeys.detail(id),
    queryFn: () => fetchPost(id),
  });
} catch (error) {
  // Can return 404 page or redirect here
  notFound();
}
```

Use `fetchQuery` (throws) instead of `prefetchQuery` (swallows) when you need server-side error handling.

---

## QueryClient in Client Components

Client Components can call `useQueryClient()` to access the client. The instance comes from the nearest `QueryClientProvider` in the tree (set up in the root layout).

```tsx
// app/layout.tsx — root layout wraps everything in QueryClientProvider
'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { makeQueryClient } from '@/lib/query-client';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

The `HydrationBoundary` in Server Components injects dehydrated state into this same client.
