# Composable Pattern — use* Naming, Reactive Inputs, Cleanup, TypeScript

## Scenario

Build a `useIntersectionObserver` composable that observes when an element enters/leaves the viewport, accepts a ref or getter for the target element, and cleans up automatically.

## Step 1: Define the interface

```ts
// composables/useIntersectionObserver.ts
import {
  ref,
  watch,
  onUnmounted,
  readonly,
  toValue,
  type MaybeRefOrGetter,
  type Ref
} from 'vue'

export interface UseIntersectionObserverOptions {
  /** IntersectionObserver threshold (0–1, or array). Default: 0 */
  threshold?: number | number[]
  /** Root element. Default: browser viewport */
  root?: MaybeRefOrGetter<Element | null>
  /** Margin around root. Default: '0px' */
  rootMargin?: string
  /** Stop observing after first intersection. Default: false */
  once?: boolean
}

export interface UseIntersectionObserverReturn {
  isVisible: Readonly<Ref<boolean>>
  intersectionRatio: Readonly<Ref<number>>
  stop: () => void
}
```

## Step 2: Implement with MaybeRefOrGetter and cleanup

```ts
export function useIntersectionObserver(
  target: MaybeRefOrGetter<Element | null>,
  options: UseIntersectionObserverOptions = {}
): UseIntersectionObserverReturn {
  const {
    threshold = 0,
    root,
    rootMargin = '0px',
    once = false
  } = options

  const isVisible = ref(false)
  const intersectionRatio = ref(0)

  let observer: IntersectionObserver | null = null

  function stop() {
    observer?.disconnect()
    observer = null
  }

  // Watch for target changes — element might not exist on first render
  watch(
    () => toValue(target),
    (el, prevEl) => {
      // Disconnect previous observer when target changes
      stop()

      if (!el) return

      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0]
          isVisible.value = entry.isIntersecting
          intersectionRatio.value = entry.intersectionRatio

          if (once && entry.isIntersecting) {
            stop()
          }
        },
        {
          threshold,
          root: root ? toValue(root) : undefined,
          rootMargin
        }
      )

      observer.observe(el)
    },
    { immediate: true }
  )

  // Always clean up when component unmounts
  onUnmounted(stop)

  return {
    isVisible: readonly(isVisible),
    intersectionRatio: readonly(intersectionRatio),
    stop
  }
}
```

## Step 3: Use in a component

```vue
<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { useIntersectionObserver } from '@/composables/useIntersectionObserver'

const cardEl = useTemplateRef<HTMLDivElement>('card')

// Pass the ref directly — MaybeRefOrGetter accepts Ref<Element | null>
const { isVisible } = useIntersectionObserver(cardEl, {
  threshold: 0.5,
  once: true
})
</script>

<template>
  <div ref="card" :class="{ 'fade-in': isVisible }">
    I animate when 50% visible
  </div>
</template>
```

## Step 4: Use with a dynamic target

```ts
// The composable accepts a getter — runs when the getter's result changes
const activeTab = ref('tab-1')

const { isVisible } = useIntersectionObserver(
  () => document.getElementById(activeTab.value),  // getter
  { threshold: 0.1 }
)
```

## Key Patterns Illustrated

### MaybeRefOrGetter enables flexible calling conventions

```ts
// All three work:
useIntersectionObserver(myRef)           // Ref<Element>
useIntersectionObserver(() => el.value)  // getter
useIntersectionObserver(document.body)  // plain value
```

`toValue()` resolves all three:

```ts
import { toValue } from 'vue'
const element = toValue(target)  // always returns Element | null
```

### Watch cleans up previous observer on target change

Without the `stop()` call inside the watch, changing the target would leave the old observer attached. The pattern `watch(source, (new, old) => { cleanup(old); setup(new) })` is standard.

### onUnmounted guarantees cleanup

Even if the watch's cleanup runs on target change, `onUnmounted` handles the final cleanup when the component unmounts. Always have both.

### readonly on returned refs

Expose state as `readonly(ref)` — prevents consumers from mutating state they don't own. They use your returned methods (like `stop()`) to influence state.

## Testing the Composable

```ts
// useIntersectionObserver.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick, defineComponent, createApp } from 'vue'
import { useIntersectionObserver } from './useIntersectionObserver'

// Mock IntersectionObserver
const observeMock = vi.fn()
const disconnectMock = vi.fn()
let observerCallback: IntersectionObserverCallback

vi.stubGlobal('IntersectionObserver', vi.fn().mockImplementation((cb) => {
  observerCallback = cb
  return { observe: observeMock, disconnect: disconnectMock }
}))

function withSetup<T>(composable: () => T) {
  let result: T
  const app = createApp(defineComponent({
    setup() { result = composable(); return () => null }
  }))
  app.mount(document.createElement('div'))
  return { result: result!, app }
}

describe('useIntersectionObserver', () => {
  it('is not visible by default', () => {
    const el = document.createElement('div')
    const { result } = withSetup(() => useIntersectionObserver(el))
    expect(result.isVisible.value).toBe(false)
  })

  it('becomes visible on intersection', async () => {
    const el = document.createElement('div')
    const { result } = withSetup(() => useIntersectionObserver(el))

    observerCallback(
      [{ isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry],
      {} as IntersectionObserver
    )

    expect(result.isVisible.value).toBe(true)
  })

  it('disconnects on unmount', () => {
    const el = document.createElement('div')
    const { app } = withSetup(() => useIntersectionObserver(el))
    app.unmount()
    expect(disconnectMock).toHaveBeenCalled()
  })
})
```
