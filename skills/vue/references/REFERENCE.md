# Vue 3.5 — Reference Index

Decision map: if you need X, open Y.

## Decision Map

| If you need... | Open |
|---|---|
| Script setup, defineProps, defineEmits, defineModel, defineSlots, defineExpose, scoped styles | [sfc-and-script-setup.md](sfc-and-script-setup.md) |
| ref, reactive, computed, watch, watchEffect, shallowRef, toRef, toRefs | [reactivity.md](reactivity.md) |
| Lifecycle hooks, useTemplateRef, provide/inject, Teleport, Suspense, KeepAlive, directives | [composition-api.md](composition-api.md) |
| Composable pattern, use* naming, MaybeRefOrGetter, cleanup, TypeScript typing | [composables.md](composables.md) |
| Pinia store, defineStore, storeToRefs, actions, persistence | [pinia.md](pinia.md) |
| Vue Router, createRouter, useRoute, navigation guards, lazy routes | [vue-router.md](vue-router.md) |
| Routing test prompts for this skill | [eval-cases.md](eval-cases.md) |

## Vue 3.5 Key Additions (vs 3.4)

| Feature | Status | Description |
|---|---|---|
| Reactive props destructure | Stable | `const { x = 0 } = defineProps<{ x?: number }>()` — reactive, no `toRefs` |
| `useTemplateRef(key)` | Stable | Replaces `ref<El \| null>(null)` for template refs |
| Deferred Teleport | New | `<Teleport defer>` — mounts after parent, SSR-safe |
| `onWatcherCleanup` | New | Register cleanup inside watcher callback |
| Lazy hydration strategies | New | `hydrateOnIdle`, `hydrateOnVisible`, `hydrateOnInteraction`, `hydrateOnMediaQuery` |
| `useId()` | New | SSR-stable unique IDs for accessibility |

## Quick Lookup

### Reactive state

```ts
const count = ref(0)               // primitive ref
const user = ref<User | null>(null) // typed ref
const state = reactive({ x: 0 })   // reactive object
const double = computed(() => count.value * 2)
```

### Props (Vue 3.5 style)

```ts
const { title, count = 0 } = defineProps<{
  title: string
  count?: number
}>()
```

### Emits

```ts
const emit = defineEmits<{
  change: [value: string]
  close: []
}>()
emit('change', 'new value')
```

### defineModel (two-way binding)

```ts
const modelValue = defineModel<string>()
const visible = defineModel<boolean>('visible', { default: false })
```

### useTemplateRef

```ts
const inputRef = useTemplateRef<HTMLInputElement>('input')
// template: <input ref="input" />
onMounted(() => inputRef.value?.focus())
```

### provide / inject with InjectionKey

```ts
import type { InjectionKey } from 'vue'
const ThemeKey: InjectionKey<string> = Symbol('theme')
provide(ThemeKey, 'dark')
const theme = inject(ThemeKey, 'light')
```

### Watch with cleanup

```ts
watch(source, (val, oldVal, onCleanup) => {
  const controller = new AbortController()
  onCleanup(() => controller.abort())
  fetch(url, { signal: controller.signal })
})
// Vue 3.5 alternative:
watch(source, () => {
  onWatcherCleanup(() => { /* cleanup */ })
})
```

### Composable skeleton

```ts
export function useCounter(initial: MaybeRefOrGetter<number> = 0) {
  const count = ref(toValue(initial))
  function increment() { count.value++ }
  return { count: readonly(count), increment }
}
```

### Pinia store (setup style)

```ts
export const useUserStore = defineStore('user', () => {
  const name = ref('')
  const fullName = computed(() => `${name.value}`)
  function setName(n: string) { name.value = n }
  return { name, fullName, setName }
})
```

### Vue Router

```ts
const router = useRouter()
const route = useRoute()
router.push({ name: 'Home', params: { id: '1' } })
const id = route.params.id as string
```
