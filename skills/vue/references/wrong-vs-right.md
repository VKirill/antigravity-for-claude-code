# vue — Wrong vs Right

Pattern pairs. Left column is what new code accidentally produces; right is canonical Vue 3.5.

## 1. `reactive()` destructure vs `toRefs()`

```ts
// ❌ Wrong — destructure loses reactivity
const state = reactive({ count: 0, name: 'Alice' })
const { count, name } = state
// count, name are plain frozen values now

// ✅ Right — toRefs preserves
const { count, name } = toRefs(state)
// count: Ref<number>, name: Ref<string>

// ✅ Better when starting fresh — use ref() per piece
const count = ref(0)
const name = ref('Alice')
```

## 2. Props mutation vs `defineModel`

```vue
<!-- ❌ Wrong — mutating props triggers readonly warning -->
<script setup lang="ts">
const props = defineProps<{ count: number }>()
function increment() {
  props.count++   // warning + does not work
}
</script>

<!-- ✅ Right — defineModel for two-way binding -->
<script setup lang="ts">
const count = defineModel<number>({ required: true })
function increment() {
  count.value++   // works; parent v-model receives update
}
</script>
```

Parent uses `<Child v-model="parentCount" />`.

## 3. Untyped provide/inject vs `InjectionKey`

```ts
// ❌ Wrong — string keys, no type inference
provide('theme', 'dark')
const theme = inject('theme')   // unknown type, no autocomplete

// ✅ Right — InjectionKey<T> ties type to key
// keys.ts
import type { InjectionKey } from 'vue'
export const ThemeKey: InjectionKey<string> = Symbol('theme')

// parent
provide(ThemeKey, 'dark')

// child
const theme = inject(ThemeKey, 'light')   // typed as string (default makes it non-undefined)
```

## 4. Template ref via `ref(null)` vs `useTemplateRef`

```vue
<!-- ❌ Wrong (Vue ≤3.4 style; verbose, prone to type mismatch) -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
const inputEl = ref<HTMLInputElement | null>(null)
onMounted(() => inputEl.value?.focus())
</script>
<template><input ref="inputEl" /></template>

<!-- ✅ Right (Vue 3.5) -->
<script setup lang="ts">
import { useTemplateRef, onMounted } from 'vue'
const inputEl = useTemplateRef<HTMLInputElement>('input')
onMounted(() => inputEl.value?.focus())
</script>
<template><input ref="input" /></template>
```

## 5. Pinia store destructure

```ts
// ❌ Wrong — raw destructure loses reactivity
const { count, increment } = useCounterStore()
// count is plain number now; increment is fine (function)

// ✅ Right — storeToRefs for state + getters; raw destructure for actions
const store = useCounterStore()
const { count, doubled } = storeToRefs(store)
const { increment } = store
```

## 6. `watchEffect` for async fetch vs explicit `watch`

```ts
// ❌ Wrong — tracking broken by await
watchEffect(async () => {
  const data = await fetch(`/api/${props.id}`)
  // props.id only tracked if accessed before await
})

// ✅ Right — watch a getter, then await inside the callback
watch(
  () => props.id,
  async (id) => {
    const data = await fetch(`/api/${id}`)
  },
  { immediate: true }
)
```

## 7. Options API vs `<script setup>`

```vue
<!-- ❌ Wrong (Vue 2 / Options API style; no Compiler ergonomics) -->
<script lang="ts">
import { defineComponent } from 'vue'
export default defineComponent({
  props: { count: { type: Number, required: true } },
  data() { return { multiplier: 2 } },
  computed: { result(): number { return this.count * this.multiplier } },
})
</script>

<!-- ✅ Right (Vue 3 idiomatic) -->
<script setup lang="ts">
const { count } = defineProps<{ count: number }>()
const multiplier = ref(2)
const result = computed(() => count * multiplier.value)
</script>
```

## See also

- [reactivity.md](reactivity.md), [composition-api.md](composition-api.md), [pinia.md](pinia.md), [troubleshooting.md](troubleshooting.md)
