# React 19 — Hooks

Covers: custom hooks patterns, built-in hooks (useId, useImperativeHandle, useSyncExternalStore, useDeferredValue, useInsertionEffect), debounce, callback refs, derived state.

---

## Rules of Hooks (enforced by ESLint)

1. Call hooks only at the top level — not inside conditionals, loops, or nested functions
2. Call hooks only from React function components or custom hooks
3. Exception (React 19): `use()` can be called inside conditionals and loops

---

## Custom Hook Patterns

Custom hooks are the primary unit of reusable React logic. Each hook should have a single responsibility.

### Naming and file structure

```
src/features/users/
├── hooks/
│   ├── useUserForm.ts          # form state for user editing
│   ├── useUserSearch.ts        # search state + debounce
│   └── useUserPermissions.ts   # permission checks
└── UserForm.tsx
```

### Basic custom hook

```tsx
// hooks/useLocalStorage.ts
import { useState, useEffect } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`useLocalStorage[${key}]:`, error);
    }
  };

  return [storedValue, setValue] as const;
}
```

### Hook that returns stable actions

Return `[state, actions]` where actions are stable references — don't return plain functions from the top level (they get recreated every render).

```tsx
// hooks/useCounter.ts
import { useState, useCallback } from 'react';

interface CounterActions {
  increment: () => void;
  decrement: () => void;
  reset: () => void;
  set: (value: number) => void;
}

export function useCounter(initial = 0): [number, CounterActions] {
  const [count, setCount] = useState(initial);

  const actions = {
    increment: useCallback(() => setCount(c => c + 1), []),
    decrement: useCallback(() => setCount(c => c - 1), []),
    reset: useCallback(() => setCount(initial), [initial]),
    set: useCallback((value: number) => setCount(value), []),
  };

  return [count, actions];
}
```

### Composition: hooks calling hooks

```tsx
// hooks/useUserSearch.ts
import { useState, useDeferredValue } from 'react';
import { useDebounce } from './useDebounce';

export function useUserSearch() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const deferredQuery = useDeferredValue(debouncedQuery);

  return { query, setQuery, deferredQuery };
}
```

---

## Debounce Hook

Debounce delays applying a value until the user stops changing it. Useful for search inputs, resize handlers, and form validation.

```tsx
// hooks/useDebounce.ts
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
```

### Debounced callback (React 19 pattern)

For debouncing a function rather than a value, use `useMemo` to avoid re-creating the debounced function:

```tsx
import { useMemo, useCallback } from 'react';

function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
}

export function useDebounceCallback<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number,
): T {
  // Stable reference to fn via useCallback
  const stableFn = useCallback(fn, [fn]);
  return useMemo(() => debounce(stableFn, delay), [stableFn, delay]);
}
```

---

## useId

Generates a stable ID that's consistent between server and client rendering. Use for accessibility attributes (`htmlFor`, `aria-labelledby`, `aria-describedby`).

```tsx
function FormField({ label, error }: { label: string; error?: string }) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? 'true' : undefined}
      />
      {error && <p id={errorId} role="alert">{error}</p>}
    </div>
  );
}
```

Do NOT use `useId` for:
- List item keys (use stable data IDs)
- CSS class names (use a CSS module or Tailwind)
- Dynamic IDs that change between renders

---

## useSyncExternalStore

Safely subscribes to external (non-React) state stores. Required for concurrent-mode correctness — avoids tearing.

```tsx
// hooks/useWindowSize.ts
import { useSyncExternalStore } from 'react';

function subscribe(callback: () => void) {
  window.addEventListener('resize', callback);
  return () => window.removeEventListener('resize', callback);
}

function getSnapshot() {
  return { width: window.innerWidth, height: window.innerHeight };
}

function getServerSnapshot() {
  return { width: 0, height: 0 };
}

export function useWindowSize() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
```

### When to reach for useSyncExternalStore

- Subscribing to browser APIs (scroll position, window size, online/offline)
- Integrating third-party stores (Zustand, Redux, XState) — these libraries handle it internally
- Reading from localStorage on the client while supporting SSR

---

## useInsertionEffect

Runs synchronously before DOM mutations, before `useLayoutEffect`. Intended for CSS-in-JS libraries to inject `<style>` tags. **Not for application code.**

```tsx
// Library authors only — injecting CSS rules
useInsertionEffect(() => {
  const style = document.createElement('style');
  style.textContent = `.generated-${hash} { color: red; }`;
  document.head.appendChild(style);
  return () => document.head.removeChild(style);
}, [hash]);
```

---

## useImperativeHandle

Exposes an imperative API from a component to its parent via ref. Use sparingly — prefer declarative props.

```tsx
interface SearchHandle {
  focus: () => void;
  clear: () => void;
}

interface SearchBoxProps {
  ref?: React.Ref<SearchHandle>;
  onSearch: (query: string) => void;
}

function SearchBox({ ref, onSearch }: SearchBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    clear: () => {
      setQuery('');
      inputRef.current?.focus();
    },
  }));

  return (
    <input
      ref={inputRef}
      value={query}
      onChange={e => setQuery(e.target.value)}
      onKeyDown={e => e.key === 'Enter' && onSearch(query)}
    />
  );
}
```

Valid use cases:
- `focus()`, `scrollIntoView()`, `play()` — imperative DOM triggers
- Animated component: `animateOut()` before unmounting
- Video/audio player: `seek(time)`, `pause()`

Avoid: using it to read or set state from outside — that's a state management problem.

---

## Derived State (never useEffect for this)

Computing values from existing state should happen during render, not in effects.

```tsx
// Bad — unnecessarily complex effect just to derive state
const [items, setItems] = useState<Item[]>([]);
const [filteredItems, setFilteredItems] = useState<Item[]>([]);

useEffect(() => {
  setFilteredItems(items.filter(item => item.active));
}, [items]);

// Good — compute during render
const [items, setItems] = useState<Item[]>([]);
const filteredItems = items.filter(item => item.active);

// Good — memoize only if the filter is expensive
const filteredItems = useMemo(
  () => items.filter(item => item.active),
  [items]
);
```

---

## Hook Testing Patterns (Vitest)

```tsx
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useCounter } from './useCounter';

describe('useCounter', () => {
  it('initializes with 0 by default', () => {
    const { result } = renderHook(() => useCounter());
    expect(result.current[0]).toBe(0);
  });

  it('increments count', () => {
    const { result } = renderHook(() => useCounter());
    act(() => result.current[1].increment());
    expect(result.current[0]).toBe(1);
  });

  it('resets to initial value', () => {
    const { result } = renderHook(() => useCounter(5));
    act(() => {
      result.current[1].increment();
      result.current[1].reset();
    });
    expect(result.current[0]).toBe(5);
  });
});
```

---

## Anti-patterns

**Infinite loop**: `useEffect` with a missing or mutable dependency that changes every render.

```tsx
// Bad — object literal changes reference each render
useEffect(() => fetchData(options), [options]); // options = { page: 1 } inline

// Good — stable reference
const options = useMemo(() => ({ page }), [page]);
useEffect(() => fetchData(options), [options]);
```

**Synchronous data in useEffect**: fetching data synchronously inside effects causes waterfall loading. Use RSC, `use()` + Suspense, or TanStack Query.

**Stale closure**: forgetting to include state in effect deps.

```tsx
// Bad — count is stale inside the closure
useEffect(() => {
  const timer = setInterval(() => console.log(count), 1000);
  return () => clearInterval(timer);
}, []); // missing count

// Good — functional update or include count
useEffect(() => {
  const timer = setInterval(() => setCount(c => c + 1), 1000);
  return () => clearInterval(timer);
}, []); // no stale ref needed
```
