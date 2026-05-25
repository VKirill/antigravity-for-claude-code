# Optimistic List Example: useOptimistic + useActionState + Form Action

End-to-end walkthrough of an optimistic UI pattern where items appear instantly on add and are rolled back on error.

---

## Scenario

A todo list where clicking "Add" shows the new item immediately (optimistic) while the server request is in-flight. If the server returns an error, the optimistic item disappears and an error message is shown.

---

## Types

```tsx
// types/todo.ts
export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  pending?: boolean; // true while optimistically added
}

export interface AddTodoState {
  todos: Todo[];
  error?: string;
}
```

---

## Server Action (or client async function)

```tsx
// actions/todo.ts
import { nanoid } from 'nanoid'; // or crypto.randomUUID()

export async function addTodoAction(
  prevState: AddTodoState,
  formData: FormData,
): Promise<AddTodoState> {
  const text = (formData.get('text') as string).trim();

  if (!text) {
    return { ...prevState, error: 'Todo text cannot be empty' };
  }

  try {
    // Simulate server request (replace with real API call)
    const newTodo = await api.createTodo({ text });
    return {
      todos: [...prevState.todos, newTodo],
      error: undefined,
    };
  } catch (error) {
    return {
      ...prevState,
      error: error instanceof Error ? error.message : 'Failed to add todo',
    };
  }
}
```

---

## Component

```tsx
// components/TodoList.tsx
"use client"; // Required in Next.js App Router; omit in Vite+React

import { useActionState, useOptimistic, useRef } from 'react';
import { nanoid } from 'nanoid';
import type { AddTodoState, Todo } from '@/types/todo';
import { addTodoAction } from '@/actions/todo';

interface TodoListProps {
  initialTodos: Todo[];
}

export function TodoList({ initialTodos }: TodoListProps) {
  const formRef = useRef<HTMLFormElement>(null);

  // Action state: tracks server response + isPending
  const [state, dispatch, isPending] = useActionState(addTodoAction, {
    todos: initialTodos,
  });

  // Optimistic state: mirrors state.todos with instant additions
  const [optimisticTodos, addOptimisticTodo] = useOptimistic(
    state.todos,
    (currentTodos: Todo[], newText: string) => [
      ...currentTodos,
      {
        id: `optimistic-${nanoid()}`,
        text: newText,
        completed: false,
        pending: true, // visual indicator
      },
    ],
  );

  async function handleSubmit(formData: FormData) {
    const text = (formData.get('text') as string).trim();
    if (!text) return;

    // 1. Instant optimistic update
    addOptimisticTodo(text);

    // 2. Clear form immediately for next entry
    formRef.current?.reset();

    // 3. Fire actual server action
    dispatch(formData);
  }

  return (
    <div>
      <ul aria-label="Todo list" aria-busy={isPending}>
        {optimisticTodos.map(todo => (
          <li
            key={todo.id}
            style={{
              opacity: todo.pending ? 0.6 : 1,
              fontStyle: todo.pending ? 'italic' : 'normal',
            }}
            aria-label={todo.pending ? `${todo.text} (saving...)` : todo.text}
          >
            <span>{todo.text}</span>
            {todo.pending && (
              <span aria-hidden="true" style={{ marginLeft: 8 }}>
                ⏳
              </span>
            )}
          </li>
        ))}
      </ul>

      {/* Error shown when server rejects — optimistic item has been removed */}
      {state.error && (
        <p role="alert" style={{ color: 'red' }}>
          {state.error}
        </p>
      )}

      <form ref={formRef} action={handleSubmit}>
        <input
          name="text"
          placeholder="Add a todo..."
          disabled={isPending}
          autoComplete="off"
          aria-label="New todo text"
          required
        />
        <button type="submit" disabled={isPending}>
          {isPending ? 'Adding...' : 'Add'}
        </button>
      </form>
    </div>
  );
}
```

---

## Parent (provides initial data)

```tsx
// app/page.tsx (Next.js) or pages/Todos.tsx (Vite+React)
import { TodoList } from '@/components/TodoList';

// In Next.js App Router (Server Component):
async function TodoPage() {
  const todos = await fetchTodos(); // server-side fetch
  return <TodoList initialTodos={todos} />;
}

// In Vite+React (client-only):
function TodoPage() {
  const [todos] = useState<Todo[]>([]); // start empty, load via TanStack Query
  return <TodoList initialTodos={todos} />;
}
```

---

## How the optimistic flow works

```
User types "Buy milk" → clicks Add
│
├─ addOptimisticTodo("Buy milk")
│   └─ optimisticTodos immediately gets [...todos, { text: "Buy milk", pending: true }]
│   └─ UI shows the new item at once (greyed out)
│
├─ formRef.current.reset() → input cleared
│
└─ dispatch(formData)
    │
    ├─ [SUCCESS] server returns new Todo with real ID
    │   └─ state.todos updated with real item
    │   └─ optimisticTodos reconciles → pending flag gone, opacity back to 1
    │
    └─ [ERROR] server returns error
        └─ optimisticTodos resets to state.todos (optimistic item removed)
        └─ state.error shown in UI
```

---

## Extending the pattern: optimistic delete

```tsx
// Add to useOptimistic reducer:
const [optimisticTodos, applyOptimistic] = useOptimistic(
  state.todos,
  (currentTodos: Todo[], action: { type: 'add'; text: string } | { type: 'delete'; id: string }) => {
    if (action.type === 'add') {
      return [...currentTodos, { id: `opt-${nanoid()}`, text: action.text, completed: false, pending: true }];
    }
    if (action.type === 'delete') {
      return currentTodos.filter(t => t.id !== action.id);
    }
    return currentTodos;
  },
);

// For delete:
async function handleDelete(id: string) {
  applyOptimistic({ type: 'delete', id }); // instant removal
  const formData = new FormData();
  formData.set('id', id);
  formData.set('_action', 'delete');
  dispatch(formData);
}
```

---

## Verification checklist

- [ ] New item appears in the list before server responds (no spinner)
- [ ] Item has reduced opacity / italic style while `pending: true`
- [ ] Input clears immediately after submit
- [ ] On success: pending item replaced by server-confirmed item (opacity restored)
- [ ] On error: pending item disappears and `state.error` shown
- [ ] Form submit button disabled while `isPending`
- [ ] `aria-busy` on list communicates loading state to screen readers
- [ ] Works with multiple rapid submissions (each gets its own optimistic entry)
