# react — Troubleshooting

Symptom-indexed.

## Hydration mismatch

**Symptom:** "Hydration failed because the server rendered HTML didn't match the client."

**Common causes (in order):**
1. `Date.now()` / `Math.random()` / `new Date()` rendered without `suppressHydrationWarning`
2. Locale formatting (`.toLocaleString()`) on dates/numbers without specifying locale
3. `typeof window !== 'undefined'` branching in render
4. Browser-only APIs (`localStorage`) read during render — should be `useEffect`
5. Browser extension injecting nodes (Grammarly, password managers) — add `suppressHydrationWarning` on `<body>`
6. Whitespace inside `<table>`/`<ul>` from formatter — explicit `{' '}` or `{null}`

**Fix:** Move browser-only reads to `useEffect`. For inherently dynamic content render `null` on first render:

```tsx
function ClientOnly({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted ? children : null
}
```

## `useEffect` runs twice in dev (StrictMode)

**Symptom:** Effect logs appear twice; setup/cleanup runs setup-cleanup-setup.

**Cause:** Correct behavior. `<React.StrictMode>` intentionally double-invokes effects to surface bugs in cleanup logic. Production builds run effects once.

**Fix:** Don't disable StrictMode — fix the effect. Common offenders:
- Missing cleanup — return a function that undoes setup
- API call without cancellation — use `AbortController` and abort in cleanup
- Subscription without unsubscribe — return the unsubscribe function

```tsx
useEffect(() => {
  const controller = new AbortController()
  fetch(url, { signal: controller.signal }).then(...)
  return () => controller.abort()
}, [url])
```

For data fetching, prefer `use(promise)` + Suspense or TanStack Query — they handle this correctly out of the box.

## `useState` lazy initializer keeps running

**Symptom:** Expensive function passed to `useState(expensive())` runs on every render.

**Cause:** Calling `expensive()` instead of passing the function reference.

**Fix:**
```tsx
// Wrong — expensive() called every render
const [data, setData] = useState(expensive())

// Right — function passed, called once
const [data, setData] = useState(() => expensive())
```

## `useMemo` not memoizing

**Symptom:** Memoized value recomputes on every render despite "stable" deps.

**Causes:**
1. Dependency is a new object/array every render: `useMemo(..., [{ x: 1 }])` — new object literal each call
2. Dependency is a function recreated each render (no `useCallback`)
3. Component itself remounts due to changing `key` — `useMemo` cache is per-instance

**Fix:** Stabilize the dependency, or skip memo if the work is cheap. With React Compiler enabled, drop manual `useMemo` entirely.

```tsx
// Wrong — `options` is new every render
return <Chart options={{ color: 'red' }} />

// Right — stable reference
const options = useMemo(() => ({ color: 'red' }), [])
return <Chart options={options} />

// Better with Compiler: write naturally; Compiler memoizes
return <Chart options={{ color: 'red' }} />
```

## Infinite render loop with `useEffect`

**Symptom:** "Maximum update depth exceeded" or the page hangs.

**Cause:** `useEffect` deps include a value that the effect itself updates.

```tsx
// Wrong — effect updates `data`, which is in the deps
const [data, setData] = useState([])
useEffect(() => {
  setData([...data, 'new'])   // loop
}, [data])

// Right — functional update, no `data` in deps
useEffect(() => {
  setData(prev => [...prev, 'new'])
}, [])
```

## Stale closure in event handler

**Symptom:** Handler reads old state inside `useEffect` or `setTimeout`.

**Cause:** Captured the closed-over variable, not the latest state.

**Fix:** Functional update OR ref pattern:

```tsx
// Functional setter — gets latest state at call time
setCount(prev => prev + 1)

// Ref pattern when you need to read latest in a callback that survives
const stateRef = useRef(state)
useEffect(() => { stateRef.current = state }, [state])
const onClick = () => doSomething(stateRef.current)
```

## `useContext` value changes don't re-render children

**Symptom:** `Provider value` updates but consumers don't react.

**Causes:**
1. Provider value is a primitive (string/number) but the actual data inside is a deeply mutated object — same reference, no re-render
2. Wrong `Context` reference — multiple `createContext` calls in different modules
3. `value={...}` passes a literal object each render — that *should* re-render consumers; if it doesn't, check for mutation

**Fix:** Always create a new object/array reference when state changes. With React 19 `use(MyContext)` works identically — same semantics.

## Server Components import error

**Symptom:** "Cannot use [hook] in a Server Component" or `useState` is undefined.

**Cause:** Trying to use client-only features (hooks, event handlers, browser APIs) in an RSC.

**Fix:** Add `'use client'` to the top of the file, or split the client-only piece into a separate component imported by the RSC.

## `useImperativeHandle` not exposing methods

**Symptom:** Parent calls `ref.current.focus()` and gets `undefined`.

**Cause:** Either the ref isn't attached, or `useImperativeHandle` deps array prevents the methods from being current.

**Fix:**
```tsx
function Input({ ref }: { ref: React.Ref<{ focus: () => void }> }) {
  const inputRef = useRef<HTMLInputElement>(null)
  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }), [])
  return <input ref={inputRef} />
}
```

In React 19, ref is just a prop — no `forwardRef`.

## See also

- [hooks.md](hooks.md), [state.md](state.md), [server-components.md](server-components.md), [wrong-vs-right.md](wrong-vs-right.md)
