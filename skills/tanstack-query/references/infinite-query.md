# TanStack Query 5 — Infinite Query

## useInfiniteQuery

`useInfiniteQuery` is `useQuery` for paginated data. It accumulates pages instead of replacing them.

### Key differences from useQuery

| | `useQuery` | `useInfiniteQuery` |
|---|---|---|
| Data shape | `TData` | `{ pages: TData[], pageParams: unknown[] }` |
| Load trigger | automatic on mount | `fetchNextPage()` / `fetchPreviousPage()` |
| Cache key | same structure | same structure (compatible) |
| `select` | transforms flat data | transforms `InfiniteData<TData>` |

---

## Cursor-based pagination

Most modern APIs return a cursor (not page numbers). Use this pattern:

```ts
interface PostsPage {
  items: Post[];
  nextCursor: string | null;  // null = no more pages
}

interface PostsQueryParams {
  limit?: number;
  status?: 'active' | 'archived';
}

// Query key includes all params that affect results
const postKeys = {
  infinite: (params: PostsQueryParams) => ['posts', 'infinite', params] as const,
};

function useInfinitePosts(params: PostsQueryParams = {}) {
  return useInfiniteQuery({
    queryKey: postKeys.infinite(params),
    queryFn: async ({ pageParam, signal }) => {
      const url = new URL('/api/posts', window.location.origin);
      url.searchParams.set('limit', String(params.limit ?? 20));
      if (params.status) url.searchParams.set('status', params.status);
      if (pageParam) url.searchParams.set('cursor', pageParam as string);

      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error('Failed to fetch posts');
      return res.json() as Promise<PostsPage>;
    },

    initialPageParam: null as string | null,  // v5: required, replaces no default cursor

    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    // undefined = no more pages (stops fetchNextPage from firing)

    // Optional: bidirectional pagination
    // getPreviousPageParam: (firstPage) => firstPage.previousCursor ?? undefined,

    staleTime: 2 * 60 * 1000,
  });
}
```

### Accessing data

```tsx
function PostList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending,
    isError,
    error,
  } = useInfinitePosts({ status: 'active' });

  if (isPending) return <Spinner />;
  if (isError) return <ErrorMessage error={error} />;

  // data.pages is an array of page results
  // Flatten for rendering
  const posts = data.pages.flatMap((page) => page.items);

  return (
    <div>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  );
}
```

---

## Page-number pagination

For offset/page-number APIs:

```ts
interface PaginatedPosts {
  items: Post[];
  page: number;
  totalPages: number;
}

function usePagedPosts(params: { status?: string } = {}) {
  return useInfiniteQuery({
    queryKey: ['posts', 'paged', params],
    queryFn: async ({ pageParam, signal }) => {
      const res = await fetch(
        `/api/posts?page=${pageParam}&status=${params.status ?? ''}`,
        { signal },
      );
      return res.json() as Promise<PaginatedPosts>;
    },

    initialPageParam: 1,

    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
  });
}
```

---

## IntersectionObserver for scroll-to-load

Auto-trigger `fetchNextPage` when a sentinel element enters the viewport:

```tsx
import { useRef, useEffect } from 'react';

function useIntersectionObserver(
  callback: () => void,
  options: IntersectionObserverInit = {},
) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) callback(); },
      { threshold: 0.1, ...options },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [callback]);

  return ref;
}

function InfinitePostList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending,
  } = useInfinitePosts();

  const loadMoreRef = useIntersectionObserver(
    () => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); },
  );

  if (isPending) return <Spinner />;

  const posts = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}

      {/* Sentinel — becomes visible when user scrolls to bottom */}
      <div ref={loadMoreRef} style={{ height: 1 }} />

      {isFetchingNextPage && <Spinner />}
      {!hasNextPage && posts.length > 0 && (
        <p>All posts loaded</p>
      )}
    </div>
  );
}
```

---

## select with infinite data

`select` on infinite queries receives `InfiniteData<TPage>`:

```ts
const { data: totalCount } = useInfiniteQuery({
  queryKey: postKeys.infinite({}),
  queryFn: fetchPostsPage,
  initialPageParam: null,
  getNextPageParam: (page) => page.nextCursor ?? undefined,
  select: (data) => data.pages.reduce((sum, page) => sum + page.items.length, 0),
});
// data is number — only the count
```

---

## Refetch behavior

`useInfiniteQuery` refetches **all currently loaded pages** when the query becomes stale. If the user has loaded 10 pages, a background refetch fires 10 requests. Mitigate with a reasonable `staleTime`:

```ts
staleTime: 5 * 60 * 1000   // 5 min — don't refetch on every window focus
```

For bi-directional infinite lists (chat, timeline), `refetchPage` lets you target specific pages:

```ts
queryClient.invalidateQueries({
  queryKey: postKeys.infinite({}),
  refetchPage: (_page, index) => index === 0,  // only refetch first page
});
```

---

## maxPages — limit loaded pages

Prevent unbounded memory growth:

```ts
useInfiniteQuery({
  queryKey: postKeys.infinite({}),
  queryFn: fetchPostsPage,
  initialPageParam: null,
  getNextPageParam: (page) => page.nextCursor ?? undefined,
  maxPages: 5,               // keep only last 5 pages in cache
});
```

When `maxPages` is set and a new page loads, the oldest page is dropped from `data.pages`. Pair with bidirectional pagination (`getPreviousPageParam`) to navigate back.

---

## Return value

```ts
const {
  data,                    // InfiniteData<TPage> | undefined
  // data.pages            // TPage[] — all loaded pages
  // data.pageParams       // unknown[] — all page params (cursors/page numbers)

  fetchNextPage,           // () => Promise — load next page
  fetchPreviousPage,       // () => Promise — load previous page

  hasNextPage,             // true if getNextPageParam returned non-undefined
  hasPreviousPage,         // true if getPreviousPageParam returned non-undefined

  isFetchingNextPage,      // true while fetchNextPage in flight
  isFetchingPreviousPage,  // true while fetchPreviousPage in flight

  isPending,
  isFetching,
  isError,
  error,
} = useInfiniteQuery({ ... });
```
