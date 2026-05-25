# Reactivity — ref, reactive, computed, watch, watchEffect

## Core Primitives

### ref

`ref(value)` wraps any value (primitive or object) in a reactive container. Access/mutate via `.value` in JS; template auto-unwraps refs at the top level.

```ts
import { ref, readonly } from 'vue'

const count = ref(0)
count.value++           // mutate
console.log(count.value) // read

// Typed ref
const user = ref<User | null>(null)

// Readonly ref (expose to consumers without allowing mutation)
const readonlyCount = readonly(count)
```

**Ref unwrapping in templates**: `{{ count }}` — no `.value` needed. Gotcha: nested in plain objects, refs are NOT auto-unwrapped.

**`ref` vs `reactive`**: prefer `ref` by default. It's safe to destructure via `storeToRefs` / `toRefs`, and explicit `.value` prevents silent loss of reactivity.

### reactive

`reactive(obj)` makes a plain object deeply reactive. No `.value` needed.

```ts
import { reactive } from 'vue'

const state = reactive({ count: 0, name: '' })
state.count++     // direct mutation
state.name = 'Alice'
```

**Gotchas**:
- Destructuring a reactive object loses reactivity: `const { count } = state` — `count` is now a plain number
- Reassigning the whole object breaks reactivity: `state = newObject` — reference lost
- Never wrap a `ref` in `reactive` — it gets unwrapped, which can be confusing
- Use `toRefs(state)` to get a destructure-safe version: `const { count, name } = toRefs(state)`

**When to prefer `reactive`**: form state objects where all fields change together; when working with large objects where `.value` everywhere is noisy.

### shallowRef and shallowReactive

`shallowRef(value)` — only the `.value` assignment triggers reactivity. Internal object mutations do NOT trigger updates.

```ts
const bigList = shallowRef<Item[]>([])
// This triggers update:
bigList.value = [...bigList.value, newItem]
// This does NOT trigger update:
bigList.value.push(newItem)  // mutating in place — no reactivity
```

Use `shallowRef` for:
- Large arrays/objects replaced atomically (not mutated in place)
- External library objects that should not be made deeply reactive
- Performance optimization when deep tracking is unnecessary

`shallowReactive(obj)` — only top-level properties are reactive; nested objects are not tracked.

### toRef, toRefs

`toRef(reactiveObj, key)` — creates a single ref linked to a property of a reactive object. Mutating the ref mutates the source.

```ts
const state = reactive({ count: 0 })
const countRef = toRef(state, 'count')
countRef.value++  // also increments state.count
```

`toRefs(reactiveObj)` — converts all properties to refs. Use when you need to destructure a reactive object safely.

```ts
const { count, name } = toRefs(state)
// count and name are now reactive refs linked to state
```

**Most common pattern**: use `storeToRefs(piniaStore)` (same semantics as `toRefs` but for Pinia).

## computed

`computed(() => derivedValue)` creates a lazy, cached reactive value. Recomputes only when its reactive dependencies change.

```ts
import { computed } from 'vue'

const double = computed(() => count.value * 2)
console.log(double.value) // read — computed is also a ref
```

**Writable computed**:

```ts
const fullName = computed({
  get: () => `${first.value} ${last.value}`,
  set: (value: string) => {
    const [f, l] = value.split(' ')
    first.value = f
    last.value = l
  }
})
```

**Rules**:
- Do not trigger side effects inside `computed` — it should be a pure derivation
- Computed is lazy: if nobody reads `.value`, it never runs
- Do not mutate reactive state inside `computed`

## watch

`watch(source, handler, options?)` — explicit side effect on reactive change.

```ts
import { watch, ref } from 'vue'

const id = ref(1)
watch(id, (newVal, oldVal) => {
  fetchUser(newVal)
})

// Watch multiple sources
watch([id, name], ([newId, newName]) => { ... })

// Watch deep (reactive object)
watch(
  () => state.nested,
  (val) => { ... },
  { deep: true }
)

// Immediate: run handler immediately on mount, then on change
watch(id, fetchUser, { immediate: true })

// Once: fire once, then stop
watch(id, fetchUser, { once: true })
```

**Cleanup inside watcher** (cancel previous async operation):

```ts
// Vue 3.4 style — onCleanup parameter
watch(id, async (newId, oldId, onCleanup) => {
  const controller = new AbortController()
  onCleanup(() => controller.abort())
  const data = await fetch(`/api/users/${newId}`, { signal: controller.signal })
})

// Vue 3.5 style — onWatcherCleanup (import from vue)
import { onWatcherCleanup } from 'vue'
watch(id, async (newId) => {
  const controller = new AbortController()
  onWatcherCleanup(() => controller.abort())
  const data = await fetch(`/api/users/${newId}`, { signal: controller.signal })
})
```

**Stopping a watcher**:

```ts
const stop = watch(id, handler)
// Later:
stop()
```

**Watcher flush timing**:

| Option | Behavior |
|---|---|
| `flush: 'pre'` (default) | Before component re-renders |
| `flush: 'post'` | After component re-renders (DOM updated) |
| `flush: 'sync'` | Synchronous, immediately when source changes |

## watchEffect

`watchEffect(fn)` — runs immediately, auto-tracks all reactive dependencies accessed inside `fn`.

```ts
import { watchEffect } from 'vue'

watchEffect(() => {
  console.log('count is:', count.value) // count tracked automatically
  document.title = `Count: ${count.value}`
})
```

**vs `watch`**:

| | `watch` | `watchEffect` |
|---|---|---|
| Source | Explicit | Auto-tracked |
| Old value | Yes | No |
| Immediate | Optional | Always |
| Use case | "when X changes, do Y" | "keep these in sync" |

**watchPostEffect** — same as `watchEffect` but flushes after DOM updates:

```ts
import { watchPostEffect } from 'vue'
watchPostEffect(() => {
  // DOM is updated when this runs
  el.value?.scrollIntoView()
})
```

**watchSyncEffect** — synchronous flush, use sparingly (runs per mutation):

```ts
import { watchSyncEffect } from 'vue'
```

## onWatcherCleanup (Vue 3.5)

`onWatcherCleanup(fn)` registers a cleanup callback that runs before the next watcher execution or when the watcher is stopped. Call it inside any watcher callback.

```ts
import { watch, onWatcherCleanup } from 'vue'

watch(route, () => {
  const token = subscribeToRoute(route.value)
  onWatcherCleanup(() => unsubscribe(token))
})
```

This is equivalent to the `onCleanup` parameter from the watcher callback but can be called from any function invoked inside the watcher.

## Reactivity Gotchas

**1. Losing reactivity on destructure**

```ts
// WRONG — count is a plain number, not reactive
const { count } = reactive({ count: 0 })

// RIGHT — use toRefs
const { count } = toRefs(reactive({ count: 0 }))
```

**2. Replacing reactive object**

```ts
// WRONG — loses reference
let state = reactive({ count: 0 })
state = { count: 1 }  // new plain object, not reactive

// RIGHT — mutate in place, or use ref
const state = ref({ count: 0 })
state.value = { count: 1 }  // ref replacement works
```

**3. Watch on reactive object property — must use getter**

```ts
const state = reactive({ count: 0 })

// WRONG — plain value, not reactive source
watch(state.count, ...)

// RIGHT — wrap in getter
watch(() => state.count, ...)
```

**4. Deep watch performance**

Deep watching large objects tracks every nested property. Prefer:
- `watch(() => state.specific.path, ...)` — precise source
- `shallowRef` + replace atomically — explicit update

**5. Template ref timing**

`useTemplateRef` returns `null` until `onMounted`. Always guard:

```ts
onMounted(() => {
  inputRef.value?.focus()  // safe: mounted
})
// Not safe at script setup level — DOM not yet rendered
```
