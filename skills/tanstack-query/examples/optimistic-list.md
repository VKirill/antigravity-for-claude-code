# Optimistic List Update with Rollback

Full end-to-end example: toggle a todo's `done` state with instant UI feedback and automatic rollback on failure.

## Setup

```
src/features/todos/
├── query-keys.ts
├── api.ts
├── hooks/use-toggle-todo.ts
└── components/TodoList.tsx
```

## query-keys.ts

```ts
export interface TodoFilters {
  status?: 'all' | 'active' | 'done';
  userId?: string;
}

export const todoKeys = {
  all: ['todos'] as const,
  lists: () => [...todoKeys.all, 'list'] as const,
  list: (filters: TodoFilters) => [...todoKeys.lists(), filters] as const,
  details: () => [...todoKeys.all, 'detail'] as const,
  detail: (id: string) => [...todoKeys.details(), id] as const,
};
```

## api.ts

```ts
export interface Todo {
  id: string;
  title: string;
  done: boolean;
  userId: string;
  updatedAt: string;
}

export async function fetchTodos(filters: TodoFilters = {}): Promise<Todo[]> {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters.userId) params.set('userId', filters.userId);

  const res = await fetch(`/api/todos?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch todos: ${res.status}`);
  return res.json();
}

export async function toggleTodo(id: string, done: boolean): Promise<Todo> {
  const res = await fetch(`/api/todos/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ done }),
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Failed to toggle todo: ${res.status}`);
  return res.json();
}
```

## hooks/use-toggle-todo.ts

The mutation hook — encapsulates optimistic update logic.

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { todoKeys, type TodoFilters } from '../query-keys';
import { toggleTodo, type Todo } from '../api';

interface UseToggleTodoOptions {
  /** Current filter context — ensures we update the right list key */
  filters?: TodoFilters;
}

export function useToggleTodo(options: UseToggleTodoOptions = {}) {
  const queryClient = useQueryClient();
  const filters = options.filters ?? {};

  return useMutation<
    Todo,                                        // TData
    Error,                                       // TError
    { id: string; done: boolean },               // TVariables
    { previousTodos: Todo[] | undefined }        // TContext (for rollback)
  >({
    mutationFn: ({ id, done }) => toggleTodo(id, done),

    onMutate: async ({ id, done }) => {
      const listKey = todoKeys.list(filters);

      // 1. Cancel any in-flight queries to prevent race condition
      //    (background refetch overwriting optimistic update)
      await queryClient.cancelQueries({ queryKey: listKey });

      // 2. Snapshot current state for rollback
      const previousTodos = queryClient.getQueryData<Todo[]>(listKey);

      // 3. Optimistically update — patch the specific item in the list
      queryClient.setQueryData<Todo[]>(listKey, (old) =>
        old?.map((todo) =>
          todo.id === id
            ? { ...todo, done, updatedAt: new Date().toISOString() }
            : todo
        ) ?? []
      );

      // 4. Return context — passed to onError for rollback
      return { previousTodos };
    },

    onError: (error, variables, context) => {
      // Rollback to snapshot
      if (context?.previousTodos !== undefined) {
        queryClient.setQueryData(todoKeys.list(filters), context.previousTodos);
      }
      // Could show a toast here
      console.error(`Failed to toggle todo ${variables.id}:`, error.message);
    },

    onSettled: () => {
      // Always sync with server — whether mutation succeeded or failed
      // This is what makes the cache eventually consistent
      queryClient.invalidateQueries({ queryKey: todoKeys.lists() });
    },
  });
}
```

## components/TodoList.tsx

```tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { todoKeys, type TodoFilters } from '../query-keys';
import { fetchTodos } from '../api';
import { useToggleTodo } from '../hooks/use-toggle-todo';

interface TodoListProps {
  filters?: TodoFilters;
}

export function TodoList({ filters = {} }: TodoListProps) {
  const { data: todos, isPending, isError, error } = useQuery({
    queryKey: todoKeys.list(filters),
    queryFn: () => fetchTodos(filters),
    staleTime: 60 * 1000,
  });

  const toggleTodo = useToggleTodo({ filters });

  if (isPending) {
    return (
      <ul aria-label="Loading todos">
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i} className="h-8 bg-gray-100 animate-pulse rounded mb-2" />
        ))}
      </ul>
    );
  }

  if (isError) {
    return <p role="alert">Failed to load todos: {error.message}</p>;
  }

  return (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id} className="flex items-center gap-2 py-2">
          <input
            type="checkbox"
            id={`todo-${todo.id}`}
            checked={todo.done}
            // Disable while this specific todo is pending
            disabled={
              toggleTodo.isPending &&
              toggleTodo.variables?.id === todo.id
            }
            onChange={(e) =>
              toggleTodo.mutate({ id: todo.id, done: e.target.checked })
            }
          />
          <label
            htmlFor={`todo-${todo.id}`}
            className={todo.done ? 'line-through text-gray-400' : ''}
          >
            {todo.title}
          </label>
        </li>
      ))}
    </ul>
  );
}
```

## What happens step by step

1. User checks a todo checkbox
2. `toggleTodo.mutate({ id, done: true })` fires
3. `onMutate`:
   - Cancels any background refetch for this list key
   - Snapshots current `todos` array
   - Patches the item in cache immediately — UI updates instantly
4. Network request goes out
5. **Success path**: `onSettled` → `invalidateQueries` → background refetch confirms server state
6. **Failure path**:
   - `onError` → restore snapshot — UI reverts to original state
   - `onSettled` → `invalidateQueries` — refetch confirms actual server state
   - Error logged (could show toast)

## Key points

- The `filters` option ensures we update the correct list key when multiple filtered views exist
- `cancelQueries` is awaited — not fire-and-forget — to guarantee cancellation before patch
- `?? []` fallback in `setQueryData` handles missing cache entry safely
- `onSettled` runs regardless of success/failure — the cache eventually converges to server truth
- Per-todo `disabled` check prevents double-toggling while a mutation is in flight
