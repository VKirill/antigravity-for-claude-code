# Infinite Scroll with useInfiniteQuery + IntersectionObserver

Full end-to-end: cursor-based infinite scroll with auto-load on scroll.

## API contract

```ts
// GET /api/posts?cursor=<string>&limit=<number>&status=<string>
interface PostsPage {
  items: Post[];
  nextCursor: string | null;   // null = last page
  total: number;
}

interface Post {
  id: string;
  title: string;
  excerpt: string;
  author: string;
  publishedAt: string;
}
```

## hooks/use-infinite-posts.ts

```ts
import { useInfiniteQuery } from '@tanstack/react-query';

export interface PostsFilters {
  status?: 'active' | 'archived';
  authorId?: string;
  limit?: number;
}

export const postKeys = {
  infinite: (filters: PostsFilters) =>
    ['posts', 'infinite', filters] as const,
};

async function fetchPostsPage({
  pageParam,
  filters,
  signal,
}: {
  pageParam: string | null;
  filters: PostsFilters;
  signal: AbortSignal;
}): Promise<PostsPage> {
  const params = new URLSearchParams();
  params.set('limit', String(filters.limit ?? 20));
  if (filters.status) params.set('status', filters.status);
  if (filters.authorId) params.set('authorId', filters.authorId);
  if (pageParam) params.set('cursor', pageParam);

  const res = await fetch(`/api/posts?${params}`, { signal });
  if (!res.ok) throw new Error(`Failed to fetch posts: ${res.status}`);
  return res.json();
}

export function useInfinitePosts(filters: PostsFilters = {}) {
  return useInfiniteQuery({
    queryKey: postKeys.infinite(filters),
    queryFn: ({ pageParam, signal }) =>
      fetchPostsPage({ pageParam, filters, signal }),

    // v5 required — the first page param (no cursor = first page)
    initialPageParam: null as string | null,

    // Return the next cursor from last page; undefined = no more pages
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,

    staleTime: 2 * 60 * 1000,      // 2 min — don't refetch aggressively
    gcTime: 10 * 60 * 1000,        // 10 min — keep pages in cache
    maxPages: 10,                   // memory safety — drop oldest pages
  });
}
```

## hooks/use-intersection-observer.ts

Reusable hook for scroll-to-load sentinel pattern:

```ts
import { useRef, useEffect, useCallback } from 'react';

interface UseIntersectionObserverOptions extends IntersectionObserverInit {
  enabled?: boolean;
}

export function useIntersectionObserver(
  callback: () => void,
  options: UseIntersectionObserverOptions = {},
) {
  const { enabled = true, ...observerOptions } = options;
  const ref = useRef<HTMLDivElement>(null);

  // Stable callback reference
  const stableCallback = useCallback(callback, [callback]);

  useEffect(() => {
    if (!enabled) return;
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) stableCallback();
      },
      {
        threshold: 0.1,   // fire when 10% of sentinel is visible
        rootMargin: '200px', // pre-load 200px before sentinel hits viewport
        ...observerOptions,
      },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled, stableCallback]);

  return ref;
}
```

## components/InfinitePostList.tsx

```tsx
'use client';

import { useInfinitePosts, type PostsFilters } from '../hooks/use-infinite-posts';
import { useIntersectionObserver } from '../hooks/use-intersection-observer';

interface InfinitePostListProps {
  filters?: PostsFilters;
}

export function InfinitePostList({ filters = {} }: InfinitePostListProps) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending,
    isError,
    error,
  } = useInfinitePosts(filters);

  // Sentinel ref — fires fetchNextPage when visible
  const sentinelRef = useIntersectionObserver(
    () => {
      if (hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    {
      enabled: hasNextPage && !isFetchingNextPage,
      rootMargin: '300px', // start loading 300px before bottom
    },
  );

  if (isPending) {
    return <PostListSkeleton count={5} />;
  }

  if (isError) {
    return (
      <div role="alert">
        <p>Failed to load posts: {error.message}</p>
        <button onClick={() => fetchNextPage()}>Retry</button>
      </div>
    );
  }

  // Flatten all pages into a single array
  const posts = data.pages.flatMap((page) => page.items);
  const totalCount = data.pages[0]?.total ?? 0;

  if (posts.length === 0) {
    return <p>No posts found.</p>;
  }

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        Showing {posts.length} of {totalCount} posts
      </p>

      <ul className="space-y-4">
        {posts.map((post) => (
          <li key={post.id}>
            <article>
              <h2>{post.title}</h2>
              <p>{post.excerpt}</p>
              <footer>
                {post.author} · {new Date(post.publishedAt).toLocaleDateString()}
              </footer>
            </article>
          </li>
        ))}
      </ul>

      {/* Sentinel — IntersectionObserver target */}
      <div ref={sentinelRef} style={{ height: 1 }} aria-hidden />

      {/* Loading indicator */}
      {isFetchingNextPage && (
        <div className="text-center py-4">
          <span className="animate-spin">⏳</span> Loading more...
        </div>
      )}

      {/* End of list */}
      {!hasNextPage && posts.length > 0 && (
        <p className="text-center text-gray-400 py-4">
          All {posts.length} posts loaded
        </p>
      )}
    </div>
  );
}

function PostListSkeleton({ count }: { count: number }) {
  return (
    <ul className="space-y-4" aria-label="Loading posts">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="h-20 bg-gray-100 animate-pulse rounded" />
      ))}
    </ul>
  );
}
```

## Filter changes

When filters change (e.g., user switches to archived posts), the query key changes and `useInfiniteQuery` starts fresh — no stale pages from the previous filter:

```tsx
function PostsPage() {
  const [filters, setFilters] = useState<PostsFilters>({});

  return (
    <div>
      <button onClick={() => setFilters({ status: 'archived' })}>
        Show archived
      </button>
      {/* Query key changes → fresh infinite query starts */}
      <InfinitePostList filters={filters} />
    </div>
  );
}
```

## Key points

- `initialPageParam: null` is required in v5 (was implicit in v4)
- `getNextPageParam` returns `undefined` (not `null`) to signal no more pages
- `maxPages: 10` prevents unbounded memory growth in long sessions
- The `rootMargin: '300px'` on IntersectionObserver pre-loads before the user sees the bottom
- `enabled: hasNextPage && !isFetchingNextPage` prevents triggering when already loading or at end
- Flatten `data.pages` with `flatMap` for rendering — don't access `data.pages[n].items` directly
