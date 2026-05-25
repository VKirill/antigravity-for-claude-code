# TanStack Query 5 — Cache Management

## staleTime vs gcTime

These are the two most misunderstood options:

| Option | Default | What it controls |
|---|---|---|
| `staleTime` | `0` ms | When data transitions from "fresh" to "stale". Fresh data: no background refetch. Stale data: refetch on mount/focus/reconnect. |
| `gcTime` | `300_000` ms (5 min) | How long **unused** cache entries live before garbage collection. An entry is "unused" when all observers (components using it) have unmounted. |

**Rule**: `gcTime >= staleTime` always. If gcTime < staleTime, entries are garbage collected before they ever go stale — the data appears to vanish on unmount/remount.

```
Query runs → data is FRESH (staleTime countdown starts)
  ↓ staleTime passes
Data becomes STALE → background refetch on next trigger
  ↓ all components using this query unmount (gcTime countdown starts)
  ↓ gcTime passes
Entry is GARBAGE COLLECTED from cache
```

### Production baselines

```ts
// Most API data — refetch at most once per minute
queries: { staleTime: 60_000, gcTime: 5 * 60_000 }

// Slow-changing data (user profile, settings)
queries: { staleTime: 5 * 60_000, gcTime: 30 * 60_000 }

// Immutable (JWT decoded info, feature flags from config)
queries: { staleTime: Infinity, gcTime: Infinity }

// Real-time data (prices, live status)
queries: { staleTime: 0, refetchInterval: 5_000 }
```

---

## Invalidation strategies

### Exact key invalidation

```ts
// Invalidate exactly this key
queryClient.invalidateQueries({
  queryKey: todoKeys.list({ status: 'active' }),
  exact: true,     // default false — exact: true prevents matching sub-keys
});
```

### Hierarchical invalidation

Without `exact: true`, invalidation matches the key as a prefix:

```ts
// Invalidates ALL todo queries (lists + details)
queryClient.invalidateQueries({ queryKey: todoKeys.all });

// Invalidates all todo list queries (not details)
queryClient.invalidateQueries({ queryKey: todoKeys.lists() });

// Invalidates only this specific filtered list
queryClient.invalidateQueries({ queryKey: todoKeys.list({ userId: '123' }) });
```

This is why the factory pattern matters — the hierarchy enables targeted invalidation.

### Predicate invalidation

For complex patterns that don't fit the key hierarchy:

```ts
// Invalidate all queries modified more than 5 minutes ago
queryClient.invalidateQueries({
  predicate: (query) => {
    return (
      query.queryKey[0] === 'todos' &&
      query.state.dataUpdatedAt < Date.now() - 5 * 60 * 1000
    );
  },
});

// Invalidate all queries for a specific user across features
queryClient.invalidateQueries({
  predicate: (query) =>
    Array.isArray(query.queryKey) &&
    query.queryKey.some((segment) =>
      typeof segment === 'object' && segment !== null && 'userId' in segment && segment.userId === userId
    ),
});
```

---

## setQueryData — manual cache writes

Update cache without a network request. Useful after mutations to avoid a refetch round-trip.

```ts
// Set a specific entry
queryClient.setQueryData<Todo>(
  todoKeys.detail(updatedTodo.id),
  updatedTodo,               // replaces entire cache entry
);

// Merge update using updater function
queryClient.setQueryData<Todo>(todoKeys.detail(id), (old) =>
  old ? { ...old, done: true } : old
);

// Update an item inside a list
queryClient.setQueryData<Todo[]>(todoKeys.list({}), (old) =>
  old?.map((t) => (t.id === id ? { ...t, done: true } : t)) ?? []
);
```

`setQueryData` with an updater function receives `undefined` if the key doesn't exist — always handle this case.

---

## removeQueries — hard eviction

Removes entries from cache immediately. Unlike invalidation (which triggers refetch), `removeQueries` deletes the data completely.

```ts
// Remove a specific entry
queryClient.removeQueries({ queryKey: todoKeys.detail(id) });

// Remove all user data on logout
queryClient.removeQueries({ queryKey: ['user'] });
queryClient.removeQueries({ queryKey: ['todos'] });

// Or clear the entire cache on logout
queryClient.clear();
```

Use `removeQueries` on logout to prevent data leakage between sessions.

---

## getQueryData — read cache synchronously

```ts
// Read current cache value (synchronous — no fetch)
const todos = queryClient.getQueryData<Todo[]>(todoKeys.list({}));

// Read and ensure fresh (fetches if stale)
const todos = await queryClient.ensureQueryData({
  queryKey: todoKeys.list({}),
  queryFn: fetchTodos,
});
```

`ensureQueryData` is useful in router loaders and action handlers where you need data but may not have a component-level `useQuery`.

---

## cancelQueries — abort in-flight requests

```ts
// Cancel a specific query (triggers AbortSignal in queryFn)
await queryClient.cancelQueries({ queryKey: todoKeys.list({}) });

// Cancel all in-flight queries (e.g., on page unmount)
await queryClient.cancelQueries();
```

Always `await` cancelQueries before `setQueryData` in optimistic update `onMutate` — see `optimistic-updates.md`.

---

## persistQueryClient — offline-first

Persist the cache to localStorage/IndexedDB so it survives page refreshes.

```ts
// Installation
npm install @tanstack/query-persist-client-core @tanstack/query-sync-storage-persister

// src/lib/persisted-query-client.ts
import { QueryClient } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/query-persist-client-core';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

export function createPersistedQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 24 * 60 * 60 * 1000, // 24h — keep cache alive for offline use
        staleTime: 5 * 60 * 1000,
        networkMode: 'offlineFirst', // serve from cache even when offline
      },
    },
  });

  persistQueryClient({
    queryClient,
    persister: createSyncStoragePersister({
      storage: window.localStorage,
      key: 'app-query-cache',
      throttleTime: 1000,      // write at most once per second
    }),
    maxAge: 24 * 60 * 60 * 1000,  // expire persisted cache after 24h
    buster: process.env.NEXT_PUBLIC_DEPLOY_ID,  // bust cache on deploy
  });

  return queryClient;
}
```

### Network mode options

| Mode | Behavior |
|---|---|
| `'online'` | Default. Queries pause when offline; resume when connection returns. |
| `'offlineFirst'` | Always attempt fetch; serve cache if fetch fails. Best for PWA/offline-first. |
| `'always'` | Never pauses — for non-network data sources (IndexedDB, localStorage). |

---

## Query observers and refetch triggers

Background refetch fires when data is stale AND one of these triggers occurs:

| Trigger | Controlled by |
|---|---|
| Component mounts | `refetchOnMount` (default: `true`) |
| Window regains focus | `refetchOnWindowFocus` (default: `true`) |
| Network reconnects | `refetchOnReconnect` (default: `true`) |
| Interval | `refetchInterval` |
| Manual | `queryClient.invalidateQueries()` or `refetch()` |

Disable aggressive refetching for data that rarely changes:

```ts
useQuery({
  queryKey: ['config'],
  queryFn: fetchConfig,
  staleTime: Infinity,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
});
```
