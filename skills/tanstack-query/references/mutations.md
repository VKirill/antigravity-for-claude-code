# TanStack Query 5 — Mutations

## useMutation

Mutations change server state. `useMutation` does not run automatically — call `mutate()` or `mutateAsync()` to trigger.

### Lifecycle

```
mutate(variables)
  → onMutate(variables)          [optional — optimistic updates, return context]
  → mutationFn(variables)        [the actual async operation]
    ↓ success path               ↓ error path
  → onSuccess(data, vars, ctx)   → onError(error, vars, ctx)
  → onSettled(data, err, vars, ctx)  [always runs]
```

### Core pattern

```ts
const queryClient = useQueryClient();

const createTodo = useMutation({
  mutationFn: (input: CreateTodoInput) =>
    fetch('/api/todos', {
      method: 'POST',
      body: JSON.stringify(input),
      headers: { 'Content-Type': 'application/json' },
    }).then((r) => {
      if (!r.ok) throw new Error('Create failed');
      return r.json() as Promise<Todo>;
    }),

  onSuccess: (newTodo) => {
    // Optional: set cache immediately to avoid refetch lag
    queryClient.setQueryData(todoKeys.detail(newTodo.id), newTodo);
  },

  onError: (error, variables) => {
    console.error('Failed to create todo:', error.message, variables);
  },

  onSettled: () => {
    // Runs after success AND error — always invalidate
    queryClient.invalidateQueries({ queryKey: todoKeys.lists() });
  },
});

// Usage
createTodo.mutate({ title: 'Buy groceries', priority: 'high' });
```

Rule: **always use `onSettled` for invalidation**, not `onSuccess` alone. If the mutation succeeds but the invalidation refetch fails, using `onSettled` ensures the refetch is still attempted. If you put invalidation in `onSuccess` only, it won't run after optimistic rollbacks.

---

## mutate vs mutateAsync

| | `mutate` | `mutateAsync` |
|---|---|---|
| Return | void | `Promise<TData>` |
| Error handling | via `onError` callback | `try/catch` at callsite |
| Typical use | fire-and-forget form submission | sequential operations, chained mutations |

```ts
// mutate — errors handled in onError
createTodo.mutate(input);

// mutateAsync — errors handled inline
try {
  const todo = await createTodo.mutateAsync(input);
  await router.push(`/todos/${todo.id}`); // can use the result immediately
} catch (error) {
  toast.error('Failed to create');
}
```

When using `mutateAsync`, still provide `onError` in the mutation config — unhandled promise rejections from `mutateAsync` can cause issues if the component unmounts mid-flight.

---

## Typing mutations

```ts
useMutation<
  TData,       // Return type of mutationFn
  TError,      // Error type (default: Error)
  TVariables,  // Input type passed to mutate()
  TContext     // Context type returned by onMutate and passed to onError/onSettled
>
```

```ts
const updateTodo = useMutation<Todo, ApiError, UpdateTodoInput, { previousTodo: Todo | undefined }>({
  mutationFn: (input) => api.updateTodo(input),
  onMutate: async (input) => {
    await queryClient.cancelQueries({ queryKey: todoKeys.detail(input.id) });
    const previousTodo = queryClient.getQueryData<Todo>(todoKeys.detail(input.id));
    queryClient.setQueryData(todoKeys.detail(input.id), (old) =>
      old ? { ...old, ...input } : old
    );
    return { previousTodo };
  },
  onError: (_error, input, context) => {
    queryClient.setQueryData(todoKeys.detail(input.id), context?.previousTodo);
  },
  onSettled: (_data, _error, input) => {
    queryClient.invalidateQueries({ queryKey: todoKeys.detail(input.id) });
  },
});
```

---

## Mutation state

```ts
const {
  mutate,           // (variables) => void
  mutateAsync,      // (variables) => Promise<TData>
  isPending,        // true while mutation is in flight
  isSuccess,        // true after successful mutation
  isError,          // true after failed mutation
  isIdle,           // true before first mutate() call
  data,             // TData | undefined — last successful result
  error,            // TError | null
  reset,            // () => void — clear state (isError → isIdle)
  variables,        // last variables passed to mutate()
  status,           // 'idle' | 'pending' | 'success' | 'error'
} = useMutation({ ... });
```

Use `isPending` to disable submit buttons. Use `reset()` to clear error state when the user edits the form.

---

## Global mutation side effects

v5 removed per-query `onSuccess`/`onError`/`onSettled` options from `useMutation` in the `QueryCache`. Use `MutationCache` for global handlers:

```ts
const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error, variables, context, mutation) => {
      // Global error toast — only for mutations that don't handle their own
      if (mutation.meta?.suppressGlobalError) return;
      toast.error(`Error: ${error.message}`);
    },
    onSuccess: (_data, _variables, _context, mutation) => {
      if (mutation.meta?.successMessage) {
        toast.success(mutation.meta.successMessage as string);
      }
    },
  }),
});

// Per-mutation meta opt-out
useMutation({
  mutationFn: deletePost,
  meta: { suppressGlobalError: true },   // handle locally
  onError: (error) => { /* custom handling */ },
});
```

---

## Dependent mutations (sequential)

```ts
async function publishPost(input: PublishInput) {
  // Create draft → upload media → publish — all must succeed
  const draft = await createDraft.mutateAsync(input.content);
  const media = await uploadMedia.mutateAsync({ postId: draft.id, files: input.files });
  await publishDraft.mutateAsync({ postId: draft.id, mediaIds: media.ids });
  queryClient.invalidateQueries({ queryKey: postKeys.lists() });
}
```

Use `mutateAsync` for sequential mutations. The outer function should have its own error handling — individual mutation `onError` callbacks fire per-mutation.

---

## Mutation key (deduplication)

```ts
// Same mutationKey = shared state (isPending, data, error) across components
const createComment = useMutation({
  mutationKey: ['comments', 'create'],
  mutationFn: createCommentFn,
});
```

Mutation keys are optional. Use when multiple components trigger the same mutation and need shared loading state.
