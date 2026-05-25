# react — Wrong vs Right

Pattern pairs. Left column is what new code accidentally produces; right is canonical React 19.

## 1. Fetching — `useEffect` vs `use(promise)` / TanStack Query

```tsx
// ❌ Wrong — manual fetch in useEffect, no cancel, no Suspense, no cache
function UserCard({ id }: { id: string }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch(`/api/users/${id}`).then(r => r.json()).then(u => {
      setUser(u); setLoading(false)
    })
  }, [id])
  if (loading) return <Skeleton />
  return <h2>{user?.name}</h2>
}

// ✅ Right (RSC or `use(promise)` + Suspense)
function UserCard({ id }: { id: string }) {
  const user = use(getUser(id))   // suspends; Error Boundary catches throws
  return <h2>{user.name}</h2>
}
// parent wraps in <Suspense fallback={<Skeleton />}>

// ✅ Or with TanStack Query (client cache + retry + revalidation)
function UserCard({ id }: { id: string }) {
  const { data: user } = useSuspenseQuery({
    queryKey: ['user', id],
    queryFn: () => fetch(`/api/users/${id}`).then(r => r.json()),
  })
  return <h2>{user.name}</h2>
}
```

## 2. `forwardRef` vs ref as prop

```tsx
// ❌ Wrong (React 18 style; deprecated in React 19)
const Input = forwardRef<HTMLInputElement, Props>(({ label, ...props }, ref) => {
  return <input ref={ref} {...props} />
})

// ✅ Right (React 19 — ref is just a prop)
function Input({ ref, label, ...props }: Props & { ref?: React.Ref<HTMLInputElement> }) {
  return <input ref={ref} {...props} />
}
```

## 3. Derived state — `useEffect` vs render

```tsx
// ❌ Wrong — useEffect syncs state from prop, extra render, stale risk
function List({ items }: { items: Item[] }) {
  const [filtered, setFiltered] = useState<Item[]>([])
  useEffect(() => {
    setFiltered(items.filter(i => i.active))
  }, [items])
  return <ul>{filtered.map(i => <li key={i.id}>{i.name}</li>)}</ul>
}

// ✅ Right — derive during render; no state, no effect
function List({ items }: { items: Item[] }) {
  const filtered = items.filter(i => i.active)
  return <ul>{filtered.map(i => <li key={i.id}>{i.name}</li>)}</ul>
}
```

If the derivation is expensive AND deps are stable, wrap in `useMemo`. With React Compiler enabled, just write the plain expression.

## 4. Context — `useContext` vs `use()`

```tsx
// ❌ Wrong (still works, but React 19 prefers use())
const theme = useContext(ThemeContext)

// ✅ Right (React 19)
const theme = use(ThemeContext)   // also works inside conditionals/loops
```

`use(Context)` is identical for the simple case and additionally works inside `if` / loops, unlike `useContext`.

## 5. Form submission — `onSubmit` + `useState` vs `useActionState`

```tsx
// ❌ Wrong — manual loading state, no progressive enhancement
function CreateForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    try { await createPost(new FormData(e.currentTarget)) }
    catch (err) { setError((err as Error).message) }
    finally { setIsSubmitting(false) }
  }
  return <form onSubmit={onSubmit}>...</form>
}

// ✅ Right — useActionState + <form action>
function CreateForm() {
  const [state, action, isPending] = useActionState(createPost, { error: null })
  return (
    <form action={action}>
      <input name="title" />
      {state.error && <p>{state.error}</p>}
      <button disabled={isPending}>Create</button>
    </form>
  )
}
```

Free progressive enhancement, automatic pending state, no manual `preventDefault`.

## 6. Memoization — manual `memo`/`useMemo` vs React Compiler

```tsx
// ❌ Wrong (with Compiler enabled — duplicate work)
const ProductCard = memo(function ProductCard({ product }: Props) {
  const formatted = useMemo(() => formatPrice(product.price), [product.price])
  const onClick = useCallback(() => track(product.id), [product.id])
  return <div onClick={onClick}>{formatted}</div>
})

// ✅ Right (Compiler enabled — write plain, Compiler memoizes precisely)
function ProductCard({ product }: Props) {
  const formatted = formatPrice(product.price)
  const onClick = () => track(product.id)
  return <div onClick={onClick}>{formatted}</div>
}
```

Without React Compiler, retain manual memoization at hot boundaries. With Compiler enabled, drop them — Compiler emits more precise memoization.

## See also

- [hooks.md](hooks.md), [state.md](state.md), [performance.md](performance.md), [troubleshooting.md](troubleshooting.md)
