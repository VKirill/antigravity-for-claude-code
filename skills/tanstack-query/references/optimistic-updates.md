# TanStack Query 5 — Optimistic Updates

## Overview

Optimistic updates make mutations appear instant by updating the UI before the server confirms. If the mutation fails, the UI rolls back to the previous state. Two strategies:

| Strategy | When to use |
|---|---|
| `setQueryData` in `onMutate` | List/detail mutations — full cache control, automatic rollback |
| `useOptimistic` (React 19) | Simple local state patch, less boilerplate, no cache involvement |

This file covers the `setQueryData` strategy (TanStack Query native). For `useOptimistic` (React 19 API), see the `react` skill.

---

## Full Pattern: setQueryData with Rollback

The canonical 4-step pattern for list mutations:

```ts
const queryClient = useQueryClient();

const toggleTodo = useMutation<
  Todo,                           // TData: server response
  Error,                          // TError
  { id: string; done: boolean },  // TVariables
  { previousTodos: Todo[] | undefined }  // TContext: snapshot for rollback
>({
  mutationFn: ({ id, done }) =>
    fetch(`/api/todos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ done }),
      headers: { 'Content-Type': 'application/json' },
    }).then((r) => r.json()),

  onMutate: async ({ id, done }) => {
    // Step 1: Cancel any in-flight queries for this key
    // Prevents a background refetch from overwriting our optimistic update
    await queryClient.cancelQueries({ queryKey: todoKeys.lists() });

    // Step 2: Snapshot the current cache value for rollback
    const previousTodos = queryClient.getQueryData<Todo[]>(todoKeys.list({}));

    // Step 3: Optimistically update the cache
    queryClient.setQueryData<Todo[]>(todoKeys.list({}), (old) =>
      old?.map((todo) =>
        todo.id === id ? { ...todo, done } : todo
      ) ?? []
    );

    // Step 4: Return context with snapshot (passed to onError)
    return { previousTodos };
  },

  onError: (_error, _variables, context) => {
    // Rollback to snapshot on failure
    if (context?.previousTodos !== undefined) {
      queryClient.setQueryData(todoKeys.list({}), context.previousTodos);
    }
  },

  onSettled: () => {
    // Always sync with server after mutation (success OR error)
    // This ensures the optimistic state eventually converges to truth
    queryClient.invalidateQueries({ queryKey: todoKeys.lists() });
  },
});
```

### Why cancelQueries is critical

Without `cancelQueries`, this race condition is possible:
1. Component renders with `todos = [A, B, C]`
2. User toggles todo A — `onMutate` patches cache optimistically
3. Background refetch was already in-flight from stale check
4. Refetch completes and overwrites cache with `[A, B, C]` (old data)
5. Optimistic update is lost

`await queryClient.cancelQueries(...)` aborts the in-flight request before patching.

---

## Detail View Optimistic Update

For updating a single item (detail view):

```ts
const updatePost = useMutation<
  Post,
  Error,
  UpdatePostInput,
  { previousPost: Post | undefined }
>({
  mutationFn: (input) => api.updatePost(input),

  onMutate: async (input) => {
    const key = postKeys.detail(input.id);

    await queryClient.cancelQueries({ queryKey: key });

    const previousPost = queryClient.getQueryData<Post>(key);

    // Merge patch — only change what's in input
    queryClient.setQueryData<Post>(key, (old) =>
      old ? { ...old, ...input } : old
    );

    return { previousPost };
  },

  onError: (_error, input, context) => {
    queryClient.setQueryData(postKeys.detail(input.id), context?.previousPost);
  },

  onSettled: (_data, _error, input) => {
    // Invalidate both the detail AND any lists that may contain this item
    queryClient.invalidateQueries({ queryKey: postKeys.detail(input.id) });
    queryClient.invalidateQueries({ queryKey: postKeys.lists() });
  },
});
```

---

## Delete Optimistic Update

Removing an item from a list:

```ts
const deleteTodo = useMutation<
  void,
  Error,
  string,                                   // TVariables = id
  { previousTodos: Todo[] | undefined }
>({
  mutationFn: (id) =>
    fetch(`/api/todos/${id}`, { method: 'DELETE' }).then((r) => {
      if (!r.ok) throw new Error('Delete failed');
    }),

  onMutate: async (id) => {
    await queryClient.cancelQueries({ queryKey: todoKeys.lists() });
    const previousTodos = queryClient.getQueryData<Todo[]>(todoKeys.list({}));

    queryClient.setQueryData<Todo[]>(todoKeys.list({}), (old) =>
      old?.filter((t) => t.id !== id) ?? []
    );

    // Also remove the detail cache entry
    queryClient.removeQueries({ queryKey: todoKeys.detail(id) });

    return { previousTodos };
  },

  onError: (_error, _id, context) => {
    queryClient.setQueryData(todoKeys.list({}), context?.previousTodos);
  },

  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: todoKeys.lists() });
  },
});
```

---

## Add Item Optimistic Update

Adding a new item when the server-assigned ID is unknown:

```ts
const createTodo = useMutation<
  Todo,
  Error,
  CreateTodoInput,
  { previousTodos: Todo[] | undefined; tempId: string }
>({
  mutationFn: createTodoFn,

  onMutate: async (input) => {
    await queryClient.cancelQueries({ queryKey: todoKeys.lists() });
    const previousTodos = queryClient.getQueryData<Todo[]>(todoKeys.list({}));

    // Use a temporary ID — server will assign the real one
    const tempId = `temp-${Date.now()}`;

    queryClient.setQueryData<Todo[]>(todoKeys.list({}), (old) => [
      ...(old ?? []),
      {
        id: tempId,
        ...input,
        done: false,
        createdAt: new Date().toISOString(),
      },
    ]);

    return { previousTodos, tempId };
  },

  onError: (_error, _input, context) => {
    queryClient.setQueryData(todoKeys.list({}), context?.previousTodos);
  },

  onSuccess: (serverTodo, _input, context) => {
    // Replace temp item with real server response
    if (context?.tempId) {
      queryClient.setQueryData<Todo[]>(todoKeys.list({}), (old) =>
        old?.map((t) => (t.id === context.tempId ? serverTodo : t)) ?? []
      );
    }
  },

  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: todoKeys.lists() });
  },
});
```

---

## Multiple Cache Keys

When a mutation affects multiple related queries (e.g., a todo list and a stats counter):

```ts
onMutate: async (id) => {
  // Cancel ALL related queries atomically
  await Promise.all([
    queryClient.cancelQueries({ queryKey: todoKeys.lists() }),
    queryClient.cancelQueries({ queryKey: ['stats'] }),
  ]);

  const previousTodos = queryClient.getQueryData<Todo[]>(todoKeys.list({}));
  const previousStats = queryClient.getQueryData<Stats>(['stats']);

  // Update both caches
  queryClient.setQueryData<Todo[]>(todoKeys.list({}), (old) =>
    old?.filter((t) => t.id !== id) ?? []
  );
  queryClient.setQueryData<Stats>(['stats'], (old) =>
    old ? { ...old, total: old.total - 1 } : old
  );

  return { previousTodos, previousStats };
},

onError: (_error, _id, context) => {
  // Restore both
  queryClient.setQueryData(todoKeys.list({}), context?.previousTodos);
  queryClient.setQueryData(['stats'], context?.previousStats);
},
```

---

## Common Mistakes

**Missing cancelQueries**: Skipping `await cancelQueries` causes race conditions where background refetches overwrite optimistic state.

**Missing return in onMutate**: Not returning `{ previousTodos }` means `onError` receives `undefined` as context — rollback silently fails.

**Partial setQueryData**: Forgetting `?? old` fallback in the updater function — if the key doesn't exist yet, the function returns `undefined` and clears the cache.

**Rollback only in onError**: Skipping `onSettled` invalidation means a successful mutation isn't confirmed with server data — optimistic state can diverge from truth permanently.
