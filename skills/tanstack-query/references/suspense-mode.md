# TanStack Query 5 — Suspense Mode

## useSuspenseQuery

`useSuspenseQuery` integrates with React's Suspense protocol: it throws a Promise when data is loading. React catches the thrown Promise, shows the `<Suspense fallback>`, and re-renders when the Promise resolves.

**Data is always defined** after the Suspense boundary resolves — no need to check `if (!data)`.

### Core requirement: both Suspense + ErrorBoundary

```tsx
// CORRECT — both boundaries present
<ErrorBoundary fallback={<ErrorUI />}>
  <Suspense fallback={<Spinner />}>
    <PostDetail id={id} />
  </Suspense>
</ErrorBoundary>

// WRONG — missing ErrorBoundary
<Suspense fallback={<Spinner />}>
  <PostDetail id={id} />
</Suspense>
// ^ If query errors, thrown error is unhandled → white screen
```

---

## useSuspenseQuery API

Same options as `useQuery`. Key differences:
- No `isPending` — component doesn't render until data exists
- `data` is always `TData` (not `TData | undefined`)
- Errors propagate to nearest `<ErrorBoundary>` (not returned in `isError`)

```tsx
// src/features/posts/PostDetail.tsx
'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { postKeys } from './query-keys';
import { fetchPost } from './api';

interface PostDetailProps {
  id: string;
}

export function PostDetail({ id }: PostDetailProps) {
  // data is Post — never undefined
  const { data: post } = useSuspenseQuery({
    queryKey: postKeys.detail(id),
    queryFn: () => fetchPost(id),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.body}</p>
    </article>
  );
}

// Usage — Suspense + ErrorBoundary wrap at the call site
function PostPage({ id }: { id: string }) {
  return (
    <ErrorBoundary fallback={<div>Failed to load post</div>}>
      <Suspense fallback={<PostSkeleton />}>
        <PostDetail id={id} />
      </Suspense>
    </ErrorBoundary>
  );
}
```

---

## ErrorBoundary options

React 19 ships a built-in `<ErrorBoundary>` component. For advanced cases (reset on route change, error info display), use `react-error-boundary`:

```tsx
import { ErrorBoundary } from 'react-error-boundary';

function PostPage({ id }: { id: string }) {
  return (
    <ErrorBoundary
      fallback={({ error, resetErrorBoundary }) => (
        <div>
          <p>Error: {error.message}</p>
          <button onClick={resetErrorBoundary}>Retry</button>
        </div>
      )}
      onReset={() => {
        // Optional: reset any state that triggered the error
      }}
    >
      <Suspense fallback={<PostSkeleton />}>
        <PostDetail id={id} />
      </Suspense>
    </ErrorBoundary>
  );
}
```

---

## useSuspenseQueries — parallel suspense

Multiple queries that suspend together. All data is available simultaneously — no waterfall.

```tsx
import { useSuspenseQueries } from '@tanstack/react-query';

function PostWithAuthor({ postId }: { postId: string }) {
  const [postQuery, authorQuery] = useSuspenseQueries({
    queries: [
      {
        queryKey: postKeys.detail(postId),
        queryFn: () => fetchPost(postId),
        staleTime: 5 * 60 * 1000,
      },
      {
        queryKey: userKeys.detail('me'),
        queryFn: fetchCurrentUser,
        staleTime: 10 * 60 * 1000,
      },
    ],
  });

  // Both are resolved here — no pending check needed
  const { data: post } = postQuery;
  const { data: author } = authorQuery;

  return (
    <div>
      <h1>{post.title}</h1>
      <p>By {author.name}</p>
    </div>
  );
}
```

vs `useSuspenseQuery` called twice (waterfall):
```tsx
// WATERFALL — post loads, then author loads sequentially
function PostWithAuthor() {
  const { data: post } = useSuspenseQuery({ queryKey: postKeys.detail(id), ... });
  const { data: author } = useSuspenseQuery({ queryKey: userKeys.detail(post.authorId), ... });
}
```

Use `useSuspenseQueries` when queries are independent. Use sequential `useSuspenseQuery` only when the second query depends on the first (chained).

---

## Suspense with streaming (React 19 + Next.js)

Suspense boundaries in Next.js App Router enable streaming — content above the boundary sends immediately, content inside the boundary streams when ready.

```tsx
// app/posts/[id]/page.tsx
import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

export default function PostPage({ params }: { params: { id: string } }) {
  return (
    <div>
      {/* Above-fold content renders immediately */}
      <header>My Blog</header>

      {/* Post content streams when ready */}
      <ErrorBoundary fallback={<ErrorUI />}>
        <Suspense fallback={<PostSkeleton />}>
          <PostDetail id={params.id} />
        </Suspense>
      </ErrorBoundary>

      {/* Comments stream independently */}
      <ErrorBoundary fallback={<CommentsError />}>
        <Suspense fallback={<CommentsSkeleton />}>
          <CommentsSection postId={params.id} />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
```

Each `<Suspense>` boundary is an independent streaming chunk. Multiple boundaries in parallel = better TTFB vs single boundary waiting for all data.

---

## useSuspenseQuery vs useQuery: when to choose

| Scenario | Use |
|---|---|
| Component must have data to render | `useSuspenseQuery` |
| Component renders meaningfully without data (loading skeleton in-component) | `useQuery` |
| You control the boundary placement | `useSuspenseQuery` |
| Third-party component tree you can't wrap | `useQuery` |
| Server component compatible pattern | prefetch + `useQuery` (see ssr-prefetch.md) |
| Need `isPending`/`isError` in component logic | `useQuery` |

---

## Suspense and transitions (React 19)

Wrap `fetchNextPage` / filter changes in `startTransition` to avoid showing the Suspense fallback during user-initiated updates:

```tsx
import { useTransition } from 'react';

function PostFilters() {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<'active' | 'archived'>('active');

  return (
    <div style={{ opacity: isPending ? 0.5 : 1 }}>
      <button
        onClick={() => startTransition(() => setStatus('archived'))}
      >
        Show archived
      </button>
    </div>
  );
}
```

`startTransition` marks the state update as non-urgent — React keeps showing current content while new content loads, instead of falling back to the Suspense fallback.
