# vue — Troubleshooting

Symptom-indexed.

## `ref` unwrap surprises

**Symptom:** `someRef.value` in template prints `[object Object]` or `.value` shows up where it shouldn't.

**Cause:** Refs auto-unwrap in templates BUT only when they are top-level properties. Nested refs inside reactive objects unwrap; refs inside plain objects do not.

```ts
// Template top-level → auto-unwrap
const count = ref(0)
// {{ count }} works (no .value)

// Inside reactive → auto-unwrap
const state = reactive({ count: ref(0) })
// state.count is 0, not Ref<number>

// Inside plain object → NO unwrap
const obj = { count: ref(0) }
// obj.count.value to read; templates show obj.count as ref
```

**Fix:** Either move the ref to top-level setup binding, wrap in `reactive`, or use `toRefs` deliberately.

## Reactivity loss after destructure

**Symptom:** `const { count } = state` — updates to `state.count` don't propagate.

**Cause:** Destructuring a `reactive` object pulls out plain values, severing reactivity.

**Fix:**
```ts
// Wrong
const state = reactive({ count: 0 })
const { count } = state
// count is now a plain number, frozen

// Right — toRefs preserves reactivity
const { count } = toRefs(state)
// count is Ref<number>, reactive
```

For Pinia stores use `storeToRefs(store)` — same idea, store-aware.

## `watch` vs `watchEffect` timing confusion

**Symptom:** `watchEffect` runs unexpectedly on first render, or doesn't track a dependency.

**Cause:** `watchEffect` runs immediately AND auto-tracks deps accessed synchronously. `watch` is explicit and lazy by default.

**Decision rule:**

| Want | Use |
|---|---|
| Run only when a specific source changes | `watch(source, cb)` |
| Run immediately + on every dep change | `watchEffect(fn)` |
| Run only on async dep changes | `watch(source, cb)` (no `{ immediate: true }`) |
| DOM-flush timing | `watchPostEffect`, `watchSyncEffect` |

Common bug: `watchEffect(() => { fetchUser(props.id) })` — only tracks `props.id` if accessed sync. If you `await` first, lose tracking.

**Fix:**
```ts
watch(() => props.id, (id) => fetchUser(id), { immediate: true })
```

## Props mutation warning

**Symptom:** "Set operation on key 'count' failed: target is readonly."

**Cause:** Directly mutating a prop. Vue 3 makes props readonly.

**Fix:** Either emit an event for the parent to update, or use `defineModel`:

```ts
// Wrong
defineProps<{ count: number }>()
props.count++

// Right — defineModel for two-way binding
const count = defineModel<number>()
count.value++
```

## Composable called inside `if` or `for`

**Symptom:** "X must be called inside a setup function" or weird ref behavior.

**Cause:** Composables register lifecycle hooks during call; calling conditionally desyncs them.

**Fix:** Always call composables at the top level of `<script setup>`. If conditional behavior is needed, do it inside the composable using `watch` or `computed`.

## `provide`/`inject` returns undefined

**Symptom:** `inject(MyKey)` returns `undefined` despite a provide in ancestor.

**Causes:**
1. Different key instance — two `Symbol('theme')` are distinct
2. Ancestor `provide` ran AFTER descendant `inject` (rare; layout-dependent)
3. Provide is in a sibling tree, not ancestor

**Fix:** Export a single `InjectionKey` from a shared module:

```ts
// keys.ts
import type { InjectionKey } from 'vue'
export const ThemeKey: InjectionKey<string> = Symbol('theme')

// parent.vue
import { ThemeKey } from './keys'
provide(ThemeKey, 'dark')

// child.vue
import { ThemeKey } from './keys'
const theme = inject(ThemeKey, 'light')   // default value typed as string
```

## `useTemplateRef` is null after mount

**Symptom:** `const el = useTemplateRef('input'); onMounted(() => console.log(el.value))` logs `null`.

**Causes:**
1. Key mismatch — `useTemplateRef('input')` but template has `<input ref="inputs">`
2. Ref attached to a `v-if` element that hasn't rendered
3. Ref attached to a component, but `useTemplateRef<ComponentType>` not typed — `.value` is then loose

**Fix:** Match the key string exactly; if conditional, check `el.value` defensively.

## `computed` getter runs too often

**Symptom:** A pure `computed(() => expensive())` recomputes on unrelated state changes.

**Cause:** Reading reactive deps that aren't actually needed for the result, OR the result is an object literal — `===` always fails so consumers re-render.

**Fix:** Make sure the getter only accesses needed reactive deps. For objects, stabilize via `shallowRef` or `markRaw` if mutation isn't needed.

## Pinia store loses reactivity in component

**Symptom:** `const { count } = useCounterStore()` — UI doesn't update on `store.count` change.

**Cause:** Raw destructure pulls out non-reactive copies.

**Fix:** `const { count } = storeToRefs(useCounterStore())` — actions/getters can still be destructured directly.

## See also

- [reactivity.md](reactivity.md), [composition-api.md](composition-api.md), [composables.md](composables.md), [wrong-vs-right.md](wrong-vs-right.md)
