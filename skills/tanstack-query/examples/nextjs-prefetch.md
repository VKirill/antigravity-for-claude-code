# Next.js App Router — Server-Side Prefetching

Full end-to-end: prefetch post detail + author on the server, render without loading state on client.

## File structure

```
app/
├── layout.tsx           ← QueryClientProvider (client)
├── posts/
│   └── [id]/
│       ├── page.tsx     ← Server Component — prefetch data
│       └── post-content.tsx  ← Client Component — consume data
src/
├── lib/
│   └── query-client.ts  ← makeQueryClient factory
└── features/
    └── posts/
        ├── query-keys.ts
        └── api.ts
```

## src/lib/query-client.ts

```ts
import { QueryClient, defaultShouldDehydrateQuery } from '@tanstack/react-query';

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1_000,
        gcTime: Infinity,         // server: keep dehydrated data alive through serialization
      },
      dehydrate: {
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === 'pending',
      },
    },
  });
}
```

## src/features/posts/query-keys.ts

```ts
export const postKeys = {
  all: ['posts'] as const,
  details: () => [...postKeys.all, 'detail'] as const,
  detail: (id: string) => [...postKeys.details(), id] as const,
};

export const userKeys = {
  all: ['users'] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
};
```

## src/features/posts/api.ts

```ts
export interface Post {
  id: string;
  title: string;
  body: string;
  authorId: string;
  publishedAt: string;
}

export interface User {
  id: string;
  name: string;
  bio: string;
  avatarUrl: string;
}

export async function fetchPost(id: string): Promise<Post> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/posts/${id}`, {
    next: { revalidate: 60 },   // Next.js fetch cache
  });
  if (!res.ok) throw new Error(`Post not found: ${id}`);
  return res.json();
}

export async function fetchUser(id: string): Promise<User> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${id}`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`User not found: ${id}`);
  return res.json();
}
```

## app/layout.tsx — QueryClientProvider (root)

```tsx
'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { makeQueryClient } from '@/lib/query-client';

let clientQueryClient: QueryClient | null = null;

function getClientQueryClient() {
  // Browser: reuse singleton across renders
  if (!clientQueryClient) clientQueryClient = makeQueryClient();
  return clientQueryClient;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // useState ensures stable reference across server/client reconciliation
  const [queryClient] = useState(() => getClientQueryClient());

  return (
    <html lang="en">
      <body>
        <QueryClientProvider client={queryClient}>
          {children}
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      </body>
    </html>
  );
}
```

## app/posts/[id]/page.tsx — Server Component

```tsx
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import { makeQueryClient } from '@/lib/query-client';
import { postKeys, userKeys } from '@/features/posts/query-keys';
import { fetchPost, fetchUser } from '@/features/posts/api';
import { PostContent } from './post-content';

interface PostPageProps {
  params: Promise<{ id: string }>;   // Next.js 16: params is async
}

export default async function PostPage({ params }: PostPageProps) {
  const { id } = await params;

  // Per-request QueryClient — never module-level singleton
  const queryClient = makeQueryClient();

  // Prefetch post — use fetchQuery (throws) for 404 handling
  let authorId: string;
  try {
    const post = await queryClient.fetchQuery({
      queryKey: postKeys.detail(id),
      queryFn: () => fetchPost(id),
    });
    authorId = post.authorId;
  } catch {
    notFound();   // Return Next.js 404 page
  }

  // Prefetch author in parallel (post is resolved, authorId is known)
  await queryClient.prefetchQuery({
    queryKey: userKeys.detail(authorId),
    queryFn: () => fetchUser(authorId),
  });

  return (
    // dehydrate serializes the populated cache
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PostContent id={id} />
    </HydrationBoundary>
  );
}

// Static metadata from pre-fetched data
export async function generateMetadata({ params }: PostPageProps) {
  const { id } = await params;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/posts/${id}`);
    if (!res.ok) return { title: 'Post not found' };
    const post: { title: string } = await res.json();
    return { title: post.title };
  } catch {
    return { title: 'Post' };
  }
}
```

## app/posts/[id]/post-content.tsx — Client Component

```tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { postKeys, userKeys } from '@/features/posts/query-keys';
import { fetchPost, fetchUser } from '@/features/posts/api';

interface PostContentProps {
  id: string;
}

export function PostContent({ id }: PostContentProps) {
  // Reads from hydrated cache — isPending is false on first render
  const { data: post } = useQuery({
    queryKey: postKeys.detail(id),
    queryFn: () => fetchPost(id),
    staleTime: 60 * 1_000,   // match server staleTime to prevent immediate refetch
  });

  const { data: author } = useQuery({
    queryKey: userKeys.detail(post?.authorId ?? ''),
    queryFn: () => fetchUser(post!.authorId),
    enabled: !!post?.authorId,
    staleTime: 5 * 60 * 1_000,
  });

  // post and author come from hydrated cache — no loading state on initial render
  // isPending can be true after a staleTime expires and window refocuses
  if (!post) return null;

  return (
    <article>
      <header>
        <h1>{post.title}</h1>
        {author && (
          <div>
            <img src={author.avatarUrl} alt={author.name} width={40} height={40} />
            <span>{author.name}</span>
          </div>
        )}
        <time dateTime={post.publishedAt}>
          {new Date(post.publishedAt).toLocaleDateString()}
        </time>
      </header>
      <div dangerouslySetInnerHTML={{ __html: post.body }} />
    </article>
  );
}
```

## What happens

1. User navigates to `/posts/123`
2. Next.js runs `PostPage` Server Component
3. `fetchQuery` fetches the post — throws + `notFound()` if 404
4. `prefetchQuery` fetches the author
5. `dehydrate(queryClient)` serializes both into JSON
6. HTML streams to browser with dehydrated state in `<script>` tag
7. React hydrates — `HydrationBoundary` populates the client `QueryClient`
8. `PostContent` renders — both queries read from cache (`isPending: false`)
9. No loading spinner, no network waterfall on initial render

## staleTime mismatch pitfall

If the server uses `staleTime: 60_000` but the client has `staleTime: 0` (default), the hydrated data is immediately stale. On mount, `useQuery` triggers a background refetch — you get a flash of stale-then-new data and an unnecessary network request.

Always set the same `staleTime` in `makeQueryClient()` defaults, or explicitly on each query.
