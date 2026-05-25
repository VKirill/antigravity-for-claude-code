# Composables — Pattern, Typing, MaybeRefOrGetter, Cleanup

## What is a Composable

A composable is a function prefixed with `use` that leverages the Composition API to encapsulate and reuse stateful logic.

Core properties:
- Named `use*` (convention, not enforced)
- Called at the top level of `<script setup>` or `setup()` — never inside conditions/loops
- Returns reactive state and/or methods
- Manages its own side-effect cleanup

```ts
// useCounter.ts
import { ref, readonly } from 'vue'

export function useCounter(initial = 0) {
  const count = ref(initial)
  function increment() { count.value++ }
  function decrement() { count.value-- }
  function reset() { count.value = initial }
  return { count: readonly(count), increment, decrement, reset }
}
```

```ts
// In <script setup>:
const { count, increment } = useCounter(10)
```

## When to Extract a Composable

- Logic that is used in 2+ components
- A component's `<script setup>` exceeds ~60 lines of logic
- Logic has its own lifecycle (sets up and tears down event listeners, timers, subscriptions)
- Logic has a clear single responsibility that can be named

**Do not extract** for logic that is tightly coupled to one component's template or that is so simple it adds no readability benefit.

## MaybeRefOrGetter — Flexible Inputs

Make composables accept both reactive refs, reactive getters, and plain values:

```ts
import { toValue, type MaybeRefOrGetter } from 'vue'

// MaybeRefOrGetter<T> = T | Ref<T> | (() => T)
export function useDouble(input: MaybeRefOrGetter<number>) {
  return computed(() => toValue(input) * 2)
}
```

Usage:

```ts
const plain = useDouble(5)             // plain value
const fromRef = useDouble(count)       // Ref<number>
const fromGetter = useDouble(() => count.value + 1)  // getter
```

`toValue(maybeRefOrGetter)` evaluates all three forms to the current value:
- If it's a function, calls it
- If it's a ref, returns `.value`
- Otherwise returns the value directly

**This is the recommended pattern** for composables that react to changing inputs.

## TypeScript Typing Patterns

### Return type annotation

Always annotate the return type explicitly for public composables:

```ts
export interface UseCounterReturn {
  count: Readonly<Ref<number>>
  increment: () => void
  reset: () => void
}

export function useCounter(initial: MaybeRefOrGetter<number> = 0): UseCounterReturn {
  const count = ref(toValue(initial))
  return {
    count: readonly(count),
    increment: () => count.value++,
    reset: () => { count.value = toValue(initial) }
  }
}
```

### Generic composables

```ts
export function useLocalStorage<T>(key: string, defaultValue: T): Ref<T> {
  const stored = localStorage.getItem(key)
  const value = ref<T>(stored ? JSON.parse(stored) : defaultValue) as Ref<T>

  watch(value, (val) => {
    localStorage.setItem(key, JSON.stringify(val))
  }, { deep: true })

  return value
}
```

### Async composables

Composables can contain async logic but cannot be `async` themselves (that would make the function return a Promise, not a value). Use refs for async state:

```ts
export function useFetch<T>(url: MaybeRefOrGetter<string>) {
  const data = ref<T | null>(null)
  const error = ref<Error | null>(null)
  const loading = ref(false)

  watch(
    () => toValue(url),
    async (resolvedUrl, _, onCleanup) => {
      const controller = new AbortController()
      onCleanup(() => controller.abort())

      loading.value = true
      error.value = null

      try {
        const res = await fetch(resolvedUrl, { signal: controller.signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        data.value = await res.json() as T
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          error.value = e as Error
        }
      } finally {
        loading.value = false
      }
    },
    { immediate: true }
  )

  return { data: readonly(data), error: readonly(error), loading: readonly(loading) }
}
```

## Cleanup Patterns

### onUnmounted

For event listeners, timers, and manual subscriptions:

```ts
export function useWindowEvent<K extends keyof WindowEventMap>(
  event: K,
  handler: (e: WindowEventMap[K]) => void
) {
  onMounted(() => window.addEventListener(event, handler))
  onUnmounted(() => window.removeEventListener(event, handler))
}
```

### onWatcherCleanup (Vue 3.5)

Cleanup tied to a watch cycle — runs before the next invocation:

```ts
import { watch, onWatcherCleanup } from 'vue'

export function useSubscription(topic: MaybeRefOrGetter<string>) {
  const messages = ref<string[]>([])

  watch(
    () => toValue(topic),
    (topicName) => {
      const sub = subscribe(topicName, (msg) => messages.value.push(msg))
      onWatcherCleanup(() => sub.unsubscribe())
    },
    { immediate: true }
  )

  return { messages: readonly(messages) }
}
```

### effectScope (for composables managing many effects)

`effectScope()` groups multiple reactive effects (watchers, computed) so they can be stopped together:

```ts
import { effectScope, onUnmounted } from 'vue'

export function useHeavyFeature() {
  const scope = effectScope()

  scope.run(() => {
    // All watchEffect and watch calls here are grouped
    watchEffect(() => { ... })
    watch(source, handler)
  })

  onUnmounted(() => scope.stop()) // stops all effects in scope

  return { ... }
}
```

Use `effectScope` in composables that are instantiated at the app level (not inside components) or need explicit lifecycle control.

## Composable File Organization

```
src/
└── composables/
    ├── useAuth.ts          # authentication state
    ├── useBreakpoint.ts    # responsive breakpoints
    ├── useFetch.ts         # data fetching utility
    ├── useLocalStorage.ts  # localStorage sync
    └── useMediaQuery.ts    # CSS media queries
```

- One composable per file
- File name matches function name: `useCounter.ts` exports `useCounter`
- Re-export from `composables/index.ts` if needed for discoverability

## Common Patterns

### Share state globally (singleton composable)

Create state outside the composable function — shared across all callers:

```ts
// Singleton: shared state across all components
const globalCount = ref(0)

export function useSharedCounter() {
  return { count: readonly(globalCount), increment: () => globalCount.value++ }
}
```

**Contrast with non-singleton**: state inside the function is created fresh per call:

```ts
export function useLocalCounter() {
  const count = ref(0)  // new ref per component
  return { count, increment: () => count.value++ }
}
```

### Composable combining other composables

```ts
export function useUserProfile(userId: MaybeRefOrGetter<string>) {
  const { data: user, loading, error } = useFetch<User>(() => `/api/users/${toValue(userId)}`)
  const { data: posts } = useFetch<Post[]>(() => `/api/users/${toValue(userId)}/posts`)

  const displayName = computed(() =>
    user.value ? `${user.value.first} ${user.value.last}` : 'Loading...'
  )

  return { user, posts, displayName, loading, error }
}
```

## Testing Composables

Test composables with `@vue/test-utils` or plain Vitest — they don't require a component:

```ts
import { describe, it, expect } from 'vitest'
import { useCounter } from './useCounter'

describe('useCounter', () => {
  it('starts at initial value', () => {
    const { count } = useCounter(5)
    expect(count.value).toBe(5)
  })

  it('increments', () => {
    const { count, increment } = useCounter(0)
    increment()
    expect(count.value).toBe(1)
  })
})
```

For composables with lifecycle hooks (`onMounted`, `onUnmounted`), wrap in `withSetup`:

```ts
import { createApp, defineComponent } from 'vue'

function withSetup<T>(composable: () => T): [T, ReturnType<typeof createApp>] {
  let result: T
  const app = createApp(defineComponent({
    setup() { result = composable(); return () => null }
  }))
  app.mount(document.createElement('div'))
  return [result!, app]
}

it('cleans up on unmount', () => {
  const [{ count }, app] = withSetup(() => useCounter())
  app.unmount()
  // verify cleanup
})
```
