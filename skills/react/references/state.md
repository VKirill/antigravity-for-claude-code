# React 19 — State Management

Covers: useActionState, useOptimistic, use() for async resources, Context + useReducer, Error Boundaries, Suspense boundaries, state co-location.

---

## State Decision Tree

```
Does state need to persist across page navigation?
  → localStorage / sessionStorage (useLocalStorage hook)

Does state belong to a single component?
  → useState (primitive) or useReducer (object/complex)

Do 2–3 closely-related components share it?
  → Lift state to their closest common ancestor

Does state span a large subtree (theme, auth, locale)?
  → Context + useReducer

Is it async server state (fetches, mutations)?
  → useActionState (mutations) + use() + Suspense (reads)
  → OR TanStack Query if you're already using it

Is it a global client-side store (cross-tree, non-serializable)?
  → Zustand (only after exhausting the above)
```

---

## useActionState

Replaces the `useState + async handleSubmit` pattern for form mutations. Returns `[state, dispatch, isPending]`.

```tsx
// types/user.ts
interface UpdateUserState {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

// actions/user.ts — can be a Server Action or a client async function
async function updateUserAction(
  prevState: UpdateUserState,
  formData: FormData,
): Promise<UpdateUserState> {
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;

  if (!name.trim()) {
    return { fieldErrors: { name: 'Name is required' } };
  }

  try {
    await api.updateUser({ name, email });
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Update failed' };
  }
}

// components/UserForm.tsx
import { useActionState } from 'react';

function UserForm({ user }: { user: User }) {
  const [state, dispatch, isPending] = useActionState(updateUserAction, {});

  return (
    <form action={dispatch}>
      <input
        name="name"
        defaultValue={user.name}
        aria-invalid={!!state.fieldErrors?.name}
      />
      {state.fieldErrors?.name && (
        <p role="alert">{state.fieldErrors.name}</p>
      )}

      <input name="email" defaultValue={user.email} type="email" />

      <button type="submit" disabled={isPending}>
        {isPending ? 'Saving...' : 'Save'}
      </button>

      {state.error && <p role="alert">{state.error}</p>}
      {state.success && <p>Saved!</p>}
    </form>
  );
}
```

### Key points

- `prevState` is the previous return value from the action (not the full form state)
- `dispatch` can be passed directly to `<form action>` — React handles FormData
- `isPending` is true during the async action
- On server rendering, the initial state is used until hydration

---

## useOptimistic

Creates an optimistic mirror of state that applies immediately and is rolled back if the underlying action fails.

```tsx
import { useOptimistic, useActionState } from 'react';

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  pending?: boolean; // true while optimistic
}

async function toggleTodoAction(
  prevState: { todos: Todo[] },
  formData: FormData,
): Promise<{ todos: Todo[] }> {
  const id = formData.get('id') as string;
  await api.toggleTodo(id);
  return {
    todos: prevState.todos.map(t =>
      t.id === id ? { ...t, completed: !t.completed } : t
    ),
  };
}

function TodoList({ initialTodos }: { initialTodos: Todo[] }) {
  const [state, dispatch, isPending] = useActionState(toggleTodoAction, {
    todos: initialTodos,
  });

  const [optimisticTodos, applyOptimistic] = useOptimistic(
    state.todos,
    (current, id: string) =>
      current.map(t =>
        t.id === id ? { ...t, completed: !t.completed, pending: true } : t
      ),
  );

  async function handleToggle(id: string) {
    applyOptimistic(id); // instant UI update
    const formData = new FormData();
    formData.set('id', id);
    dispatch(formData); // actual server call
  }

  return (
    <ul>
      {optimisticTodos.map(todo => (
        <li key={todo.id} style={{ opacity: todo.pending ? 0.7 : 1 }}>
          <button onClick={() => handleToggle(todo.id)}>
            {todo.completed ? '✓' : '○'} {todo.text}
          </button>
        </li>
      ))}
    </ul>
  );
}
```

---

## use() — reading async resources

`use()` suspends a component while reading a Promise, or reads Context (including inside conditionals).

### Async data with Suspense

```tsx
// data/users.ts — create a stable promise (don't create in render)
let usersPromise: Promise<User[]> | null = null;
export function getUsersPromise(): Promise<User[]> {
  if (!usersPromise) {
    usersPromise = fetch('/api/users').then(r => r.json());
  }
  return usersPromise;
}

// components/UserList.tsx — must be wrapped in Suspense by parent
import { use } from 'react';
import { getUsersPromise } from '../data/users';

function UserList() {
  const users = use(getUsersPromise()); // suspends until resolved
  return (
    <ul>
      {users.map(user => <li key={user.id}>{user.name}</li>)}
    </ul>
  );
}

// components/UsersPage.tsx — provides Suspense + ErrorBoundary
function UsersPage() {
  return (
    <ErrorBoundary fallback={<p>Failed to load users.</p>}>
      <Suspense fallback={<Spinner />}>
        <UserList />
      </Suspense>
    </ErrorBoundary>
  );
}
```

### use() for Context in conditionals

```tsx
function ConditionalThemeUser({ applyTheme }: { applyTheme: boolean }) {
  if (applyTheme) {
    const theme = use(ThemeContext); // valid in React 19
    return <div style={{ color: theme.primary }}>Themed</div>;
  }
  return <div>Default</div>;
}
```

---

## Context + useReducer

The right pattern for shared mutable state across a subtree.

```tsx
// contexts/auth.tsx
import { createContext, useContext, useReducer, ReactNode } from 'react';

interface AuthState {
  user: User | null;
  isLoading: boolean;
}

type AuthAction =
  | { type: 'LOGIN'; payload: User }
  | { type: 'LOGOUT' }
  | { type: 'SET_LOADING'; payload: boolean };

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN':
      return { ...state, user: action.payload, isLoading: false };
    case 'LOGOUT':
      return { ...state, user: null, isLoading: false };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    default:
      return state;
  }
}

interface AuthContextValue {
  state: AuthState;
  dispatch: React.Dispatch<AuthAction>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, {
    user: null,
    isLoading: true,
  });

  return <AuthContext value={{ state, dispatch }}>{children}</AuthContext>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}

// Consumer
function ProfileMenu() {
  const { state, dispatch } = useAuth();
  if (!state.user) return null;
  return (
    <button onClick={() => dispatch({ type: 'LOGOUT' })}>
      {state.user.name}
    </button>
  );
}
```

### Context performance: splitting state and dispatch

If context value changes on every render, all consumers re-render. Split into two contexts when state changes frequently:

```tsx
const StateContext = createContext<AuthState | null>(null);
const DispatchContext = createContext<React.Dispatch<AuthAction> | null>(null);

// Components that only dispatch don't re-render when state changes
function LogoutButton() {
  const dispatch = useContext(DispatchContext)!;
  return <button onClick={() => dispatch({ type: 'LOGOUT' })}>Logout</button>;
}
```

---

## Error Boundaries

Error boundaries catch render-time errors in their subtree. They must be class components (React 19 still) or a library wrapper.

### Simple class boundary

```tsx
import { Component, ReactNode, ErrorInfo } from 'react';

interface ErrorBoundaryProps {
  fallback: ReactNode | ((error: Error) => ReactNode);
  onError?: (error: Error, info: ErrorInfo) => void;
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      const { fallback } = this.props;
      return typeof fallback === 'function' ? fallback(this.state.error) : fallback;
    }
    return this.props.children;
  }
}
```

### Granular boundary placement

```
App
├── ErrorBoundary (critical app shell)
│   ├── Suspense (page loading)
│   │   ├── ErrorBoundary (feature A — isolated failure)
│   │   │   └── FeatureA
│   │   └── ErrorBoundary (feature B — isolated failure)
│   │       └── FeatureB
│   └── Navigation
```

- Root boundary: catches catastrophic failures, shows a "try refreshing" page
- Feature boundary: isolates individual features; one failing widget doesn't kill the app

### Reset after error (with key prop)

```tsx
function RecoverableWidget({ userId }: { userId: string }) {
  return (
    // key change resets the ErrorBoundary + remounts children
    <ErrorBoundary key={userId} fallback={<p>Failed to load user data.</p>}>
      <Suspense fallback={<Spinner />}>
        <UserWidget userId={userId} />
      </Suspense>
    </ErrorBoundary>
  );
}
```

---

## Suspense

Suspense shows a `fallback` while child components are suspended (waiting for `use(promise)` or lazy imports).

### Nesting rules

- Place Suspense as close to the suspended content as possible — not at the root
- Every `use(promise)` call must have a Suspense ancestor
- Every Suspense should have an ErrorBoundary sibling above it (errors don't respect Suspense)

```tsx
// Bad — one loading spinner for the whole page
<Suspense fallback={<PageSpinner />}>
  <Header />    {/* suspends on user data */}
  <Sidebar />   {/* suspends on nav data */}
  <Content />   {/* suspends on page data */}
</Suspense>

// Good — independent loading states
<>
  <Suspense fallback={<HeaderSkeleton />}><Header /></Suspense>
  <Suspense fallback={<SidebarSkeleton />}><Sidebar /></Suspense>
  <Suspense fallback={<ContentSkeleton />}><Content /></Suspense>
</>
```

### Avoiding Suspense waterfall

If `ComponentA` suspends and `ComponentB` depends on data that could be fetched in parallel:

```tsx
// Waterfall (bad) — B waits for A to finish
function Page() {
  return (
    <Suspense>
      <ComponentA /> {/* fetches user */}
      <ComponentB /> {/* fetches posts — can't start until A resolves */}
    </Suspense>
  );
}

// Parallel (good) — kick off both promises before rendering
const userPromise = getUser(userId);
const postsPromise = getPosts(userId);

function Page() {
  return (
    <>
      <Suspense><UserCard promise={userPromise} /></Suspense>
      <Suspense><PostList promise={postsPromise} /></Suspense>
    </>
  );
}
```
