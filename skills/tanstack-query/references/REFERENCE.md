# TanStack Query 5 — Reference Index

> TanStack Query 5.78.x · React 19.x · TypeScript 5.9.x · Updated: 2026-05-15

Split into focused files. Read only the file relevant to your task.

| File | Coverage |
|---|---|
| `queries.md` | Query key factories, useQuery options (enabled, select, placeholderData, refetchInterval) |
| `mutations.md` | useMutation lifecycle, onMutate/onError/onSettled, mutation variables typing |
| `optimistic-updates.md` | setQueryData rollback pattern, cancel in-flight, context snapshot |
| `infinite-query.md` | useInfiniteQuery, getNextPageParam, fetchNextPage, cursor vs page-number |
| `ssr-prefetch.md` | Next.js App Router, prefetchQuery, dehydrate, HydrationBoundary, per-request QueryClient |
| `cache-management.md` | staleTime vs gcTime, invalidation strategies, persistQueryClient, network mode |
| `suspense-mode.md` | useSuspenseQuery, useSuspenseQueries, ErrorBoundary pairing, React 19 patterns |
| `eval-cases.md` | Routing eval prompts (positive + negative), SemVer, CHANGELOG |

---

## Quick Patterns

### Provider Setup

```tsx
// src/providers/query.tsx
'use client'; // Next.js App Router

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // useState ensures per-component-tree instance (never module-level singleton)
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,        // 1 min — never rely on default 0
        gcTime: 5 * 60 * 1000,       // 5 min — default, explicit for clarity
        retry: (failureCount, error) => {
          // Never retry client errors
          if (error instanceof Response && error.status < 500) return false;
          return failureCount < 3;
        },
        refetchOnWindowFocus: true,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

### Query Key Factory (single feature)

```ts
// src/features/todos/query-keys.ts
export const todoKeys = {
  all: ['todos'] as const,
  lists: () => [...todoKeys.all, 'list'] as const,
  list: (filters: TodoFilters) => [...todoKeys.lists(), filters] as const,
  details: () => [...todoKeys.all, 'detail'] as const,
  detail: (id: string) => [...todoKeys.details(), id] as const,
};
```

### Basic useQuery

```ts
const { data, isPending, isError, error } = useQuery({
  queryKey: todoKeys.detail(id),
  queryFn: ({ signal }) => fetchTodo(id, signal), // signal for cancellation
  enabled: !!id,                                   // disable when id is falsy
  staleTime: 5 * 60 * 1000,                       // 5 min for detail views
  select: (data) => data.items,                    // subscribe to slice only
});
```

### Basic useMutation with invalidation

```ts
const mutation = useMutation({
  mutationFn: (newTodo: CreateTodoInput) => createTodo(newTodo),
  onSettled: () => {
    // Always invalidate — runs after success AND error
    queryClient.invalidateQueries({ queryKey: todoKeys.lists() });
  },
});
```
