# React 19 — Reference Index

> React 19.1.x · TypeScript 5.9.x · Updated: 2026-05-15

Split into focused files. Read only the file relevant to your task.

| File | Coverage |
|---|---|
| `composition.md` | Compound components, render props, polymorphic, ref as prop, forwardRef migration |
| `hooks.md` | Custom hooks, useId, useImperativeHandle, useSyncExternalStore, callback refs, debounce |
| `state.md` | useActionState, useOptimistic, use(), Context + useReducer, error boundaries, Suspense |
| `performance.md` | React Compiler, memo/useMemo/useCallback, useTransition, useDeferredValue, virtualization |
| `server-components.md` | RSC vs Client, async components, Suspense streaming, boundary placement, composition rules |
| `react-19-features.md` | Actions, Document Metadata, Asset Loading, ref prop, use() for Context, error hooks |
| `eval-cases.md` | Routing eval cases (positive/negative/edge) + CHANGELOG |

---

## Decision Map

**"I need to share state between sibling components"**
→ `state.md` → Context + useReducer section

**"I'm building a multi-part UI component (Tabs, Accordion, Select)"**
→ `composition.md` → Compound components

**"My form needs optimistic updates"**
→ `state.md` → useActionState + useOptimistic

**"Component re-renders too often"**
→ `performance.md` → React Compiler section first, then manual memo

**"I need to fetch data in a component"**
→ `server-components.md` → RSC pattern OR `state.md` → use() + Suspense for client

**"React 19 migration: forwardRef, legacy context, string refs"**
→ `react-19-features.md` → Migration section

**"My server component needs interactivity"**
→ `server-components.md` → Composition across boundary

---

## Quick Patterns

### Compound Component (Context pattern)

```tsx
// TabsContext.tsx
interface TabsContextValue {
  activeTab: string;
  setActiveTab: (id: string) => void;
}
const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('useTabs must be used within <Tabs>');
  return ctx;
}
```

### useActionState — form mutation

```tsx
async function saveUser(prev: State, formData: FormData): Promise<State> {
  const name = formData.get('name') as string;
  const result = await api.updateUser({ name });
  if (!result.ok) return { error: result.message };
  return { success: true };
}

function UserForm() {
  const [state, dispatch, isPending] = useActionState(saveUser, {});
  return (
    <form action={dispatch}>
      <input name="name" />
      <button disabled={isPending}>Save</button>
      {state.error && <p>{state.error}</p>}
    </form>
  );
}
```

### useOptimistic — instant feedback

```tsx
const [optimisticItems, addOptimistic] = useOptimistic(
  items,
  (state, newItem: Item) => [...state, { ...newItem, pending: true }],
);
```

### use() — read context anywhere

```tsx
// Inside a conditional or loop — valid in React 19
if (needsTheme) {
  const theme = use(ThemeContext);
  // ...
}
```

### ref as prop (React 19)

```tsx
// No forwardRef needed
function Input({ ref, ...props }: React.ComponentProps<'input'> & { ref?: React.Ref<HTMLInputElement> }) {
  return <input ref={ref} {...props} />;
}
```
