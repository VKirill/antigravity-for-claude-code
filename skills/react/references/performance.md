# React 19 — Performance

Covers: React Compiler setup, when to use memo/useMemo/useCallback manually, useTransition, useDeferredValue, virtualization, profiling workflow.

---

## React Compiler (React 19.1+)

The React Compiler automatically applies memoization equivalent to `React.memo`, `useMemo`, and `useCallback` for components that follow the Rules of React. It analyses the code statically and inserts memoization only where beneficial.

### Setup (Vite + Babel)

```bash
npm install -D babel-plugin-react-compiler
```

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ['babel-plugin-react-compiler'],
      },
    }),
  ],
});
```

### Opt-in by directory (recommended for migration)

```ts
// vite.config.ts
react({
  babel: {
    plugins: [
      ['babel-plugin-react-compiler', {
        sources: (filename: string) =>
          filename.includes('src/features/'), // only opt-in features dir
      }],
    ],
  },
}),
```

### What the Compiler handles

The Compiler transforms this:

```tsx
// Before: manual memoization
function ProductCard({ product, onAddToCart }: Props) {
  const price = useMemo(() => formatPrice(product.price), [product.price]);
  const handleAdd = useCallback(() => onAddToCart(product.id), [product.id, onAddToCart]);
  return <Card price={price} onAdd={handleAdd} />;
}
export default memo(ProductCard);
```

Into the equivalent of this (automatically, during build):

```tsx
// After: Compiler inserts memoization
function ProductCard({ product, onAddToCart }: Props) {
  // Compiler adds memo boundaries precisely where needed
  const price = formatPrice(product.price);
  return <Card price={price} onAdd={() => onAddToCart(product.id)} />;
}
```

**When Compiler is enabled**: remove manual `memo()`, `useMemo`, `useCallback` in Compiler-covered code — they add noise and can interfere with Compiler analysis.

### What the Compiler does NOT handle

- Components that violate Rules of React (mutations in render, accessing refs during render)
- Side effects in render
- Code using non-standard React patterns (`getSnapshotBeforeUpdate`, class components)

Check if your component is compilable:

```bash
npx react-compiler-healthcheck
```

---

## Manual Memoization (when Compiler is off or excluded)

Use manual memo only when you have a measured performance problem, not preemptively.

### React.memo — skip re-render if props unchanged

```tsx
interface UserCardProps {
  user: User;
  onSelect: (id: string) => void;
}

// Wrap at the lowest stable boundary
const UserCard = memo(function UserCard({ user, onSelect }: UserCardProps) {
  return (
    <div onClick={() => onSelect(user.id)}>
      {user.name}
    </div>
  );
});

// With custom comparison (use sparingly — easy to get wrong)
const UserCard = memo(UserCard, (prev, next) =>
  prev.user.id === next.user.id && prev.onSelect === next.onSelect
);
```

### useMemo — skip expensive computation

```tsx
// Only worthwhile for genuinely expensive operations
const sortedUsers = useMemo(
  () => [...users].sort((a, b) => a.name.localeCompare(b.name)),
  [users],
);

// NOT worthwhile for simple operations (overhead > savings)
const fullName = useMemo(() => `${first} ${last}`, [first, last]); // bad
const fullName = `${first} ${last}`; // good
```

Rule of thumb: profile in React DevTools Profiler. If the computation doesn't appear in the flamegraph, don't memoize it.

### useCallback — stable function identity

Needed only when passing callbacks to memoized children that would otherwise re-render due to new function reference.

```tsx
// Only useful when child is memoized
const MemoizedList = memo(({ onItemClick }: { onItemClick: (id: string) => void }) => (
  <ul>{items.map(i => <li key={i.id} onClick={() => onItemClick(i.id)}>{i.name}</li>)}</ul>
));

function Parent() {
  const handleClick = useCallback((id: string) => {
    // ...
  }, []); // stable reference

  return <MemoizedList onItemClick={handleClick} />;
}
```

---

## useTransition — non-urgent state updates

Mark a state update as non-urgent. React continues rendering higher-priority updates (user input, visible UI) before applying the transition.

```tsx
import { useState, useTransition } from 'react';

function SearchResults({ query }: { query: string }) {
  // ... expensive rendering
}

function SearchPage() {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInput(e.target.value); // urgent — updates input immediately

    startTransition(() => {
      setQuery(e.target.value); // non-urgent — can be interrupted
    });
  }

  return (
    <>
      <input value={input} onChange={handleChange} />
      {isPending && <Spinner />}
      <SearchResults query={query} />
    </>
  );
}
```

### useTransition with async Actions (React 19)

```tsx
const [isPending, startTransition] = useTransition();

function handleSubmit() {
  startTransition(async () => {
    await saveData(formData);
    router.push('/success');
  });
}
```

---

## useDeferredValue — defer a derived render

Accepts a value and returns a deferred version that lags behind. React renders with the current value first, then schedules a background update with the deferred value.

```tsx
import { useState, useDeferredValue } from 'react';

function SearchPage() {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  const isStale = query !== deferredQuery;

  return (
    <>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      <div style={{ opacity: isStale ? 0.6 : 1 }}>
        <SearchResults query={deferredQuery} />
      </div>
    </>
  );
}
```

**useTransition vs useDeferredValue**:
- `useTransition`: you own the state update — wrap it in `startTransition`
- `useDeferredValue`: you receive a value from somewhere else (prop, URL) and want to defer rendering that value

---

## Virtualization for Long Lists

Never render thousands of DOM nodes. Use virtualization when list > 100 items.

### @tanstack/virtual (headless)

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

function VirtualList({ items }: { items: string[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48, // estimated row height in px
  });

  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map(vItem => (
          <div
            key={vItem.index}
            style={{
              position: 'absolute',
              top: vItem.start,
              left: 0,
              width: '100%',
              height: vItem.size,
            }}
          >
            {items[vItem.index]}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Code Splitting with lazy()

Split large components into separate chunks loaded on demand.

```tsx
import { lazy, Suspense } from 'react';

const HeavyChart = lazy(() => import('./HeavyChart'));
const AdminPanel = lazy(() => import('./AdminPanel'));

function Dashboard() {
  return (
    <Suspense fallback={<Skeleton />}>
      <HeavyChart />
    </Suspense>
  );
}
```

Route-level splitting in Vite:

```tsx
// router.tsx
const routes = [
  {
    path: '/dashboard',
    element: <Suspense fallback={<PageLoader />}><Dashboard /></Suspense>,
    lazy: async () => ({ Component: (await import('./pages/Dashboard')).default }),
  },
];
```

---

## Profiling Workflow

1. Open React DevTools → Profiler tab
2. Record a slow interaction
3. Look at the flamegraph: wide bars = expensive renders
4. Focus on components that render when their props haven't changed
5. Apply `memo()` or enable Compiler for those components
6. Re-record to verify improvement

### What to look for

- **Gray bars** = components that didn't re-render (good)
- **Yellow/orange bars** = components that re-rendered
- **Wide bars with no prop changes** = memoization candidate

### Identifying wasted renders

```tsx
// Temporary debug — add to suspect component
function ExpensiveList({ items }: { items: Item[] }) {
  console.count('ExpensiveList render');
  // ...
}
```

Or use the React DevTools "Why did this render?" feature (enable in DevTools settings).

---

## Performance Anti-patterns

**Creating objects/arrays in render** — new reference on every render breaks memoization:

```tsx
// Bad — new object every render
<Component style={{ color: 'red' }} />

// Good — stable reference (or use className + CSS)
const STYLE = { color: 'red' };
<Component style={STYLE} />
```

**State that triggers cascading renders** — deeply nested state changes propagate through the entire tree. Use context splitting or co-locate state.

**Synchronous heavy computation without memoization** — sort/filter on large arrays in render:

```tsx
// Bad
const filtered = allItems.filter(item => item.active); // runs every render

// Good (with Compiler off)
const filtered = useMemo(() => allItems.filter(item => item.active), [allItems]);
```

**useEffect for synchronous derived values** — causes extra renders. Compute inline or with `useMemo`.
