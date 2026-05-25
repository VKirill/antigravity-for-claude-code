# SFC Structure, script setup, defineProps, defineEmits, defineModel, defineSlots

## SFC Structure

Single-file component layout (order by convention):

```html
<script setup lang="ts">
// Logic
</script>

<template>
  <!-- Markup -->
</template>

<style scoped>
/* Component-scoped CSS */
</style>
```

Optional blocks: `<style module>`, bare `<style>` (global), multiple `<style>` blocks.

**What `<script setup>` does**:
- All top-level declarations (variables, imports, functions, classes) are available in the template
- Compiler macros (`defineProps`, `defineEmits`, `defineModel`, `defineSlots`, `defineExpose`, `withDefaults`) are available without importing
- No `return` statement needed
- Components imported are auto-registered for use in the template

## defineProps

**Generic type syntax** (Vue 3.3+, preferred):

```ts
const props = defineProps<{
  title: string
  count?: number
  items: string[]
  config: { maxItems: number }
}>()
```

**With defaults** (when using generic syntax):

```ts
const { title, count = 0 } = withDefaults(
  defineProps<{ title: string; count?: number }>(),
  { count: 0 }
)
```

**Vue 3.5 reactive props destructure** (stable — preferred over `withDefaults`):

```ts
// Reactive AND has default — no withDefaults needed
const { title, count = 0 } = defineProps<{
  title: string
  count?: number
}>()
// count is reactive here — changing parent prop re-renders this component
```

**Gotcha with destructure**: before Vue 3.5, destructured props were NOT reactive. In Vue 3.5+, the compiler transforms them into getter-based reactive bindings.

**Accessing props object** (when you need the full props ref):

```ts
const props = defineProps<{ title: string }>()
watch(() => props.title, ...)  // watch via getter — reactive
```

**Runtime declaration** (fallback when generic syntax not available, e.g., JS without TS):

```ts
const props = defineProps({
  title: { type: String, required: true },
  count: { type: Number, default: 0 }
})
```

## defineEmits

**Typed with tuple syntax** (Vue 3.3+, preferred):

```ts
const emit = defineEmits<{
  change: [value: string]        // one payload
  close: []                      // no payload
  select: [item: Item, index: number]  // multiple payloads
}>()

// Usage:
emit('change', 'new value')
emit('close')
emit('select', selectedItem, 0)
```

**Runtime declaration**:

```ts
const emit = defineEmits(['change', 'close'])
```

**Naming convention**: emits are `camelCase` in defineEmits, `kebab-case` in parent template (`@change-item`). Vue handles the mapping.

**Validation** (rarely needed with TypeScript, but available):

```ts
const emit = defineEmits({
  change: (value: string) => value.length > 0  // returns boolean
})
```

## defineModel (Vue 3.4+)

`defineModel()` creates a two-way binding ref. It replaces the pattern of defining a `modelValue` prop + `update:modelValue` emit.

**Default v-model**:

```ts
// In child component:
const value = defineModel<string>()
// Equivalent to:
// const props = defineProps<{ modelValue: string }>()
// const emit = defineEmits<{ 'update:modelValue': [string] }>()

// Use it like a ref:
value.value = 'new value'  // automatically emits update:modelValue
```

```html
<!-- Parent uses v-model -->
<MyInput v-model="text" />
```

**Named v-model** (for multiple two-way bindings):

```ts
const visible = defineModel<boolean>('visible', { default: false })
const title = defineModel<string>('title')
```

```html
<!-- Parent: -->
<MyDialog v-model:visible="show" v-model:title="dialogTitle" />
```

**With options**:

```ts
const count = defineModel<number>('count', {
  default: 0,
  get(value) { return Math.max(0, value) },   // transform on get
  set(value) { return Math.floor(value) }      // transform on set
})
```

**Gotcha**: `defineModel` requires Vue 3.4+. In 3.3 and below, use the manual `modelValue` + `update:modelValue` pattern.

## defineSlots

Types slot props for child-to-parent slot communication.

```ts
defineSlots<{
  default(props: { item: Item; index: number }): any
  header(props: {}): any
  footer?: (props: {}): any  // optional slot
}>()
```

This is for documentation and type-checking only — it doesn't generate runtime code. The parent can then get typed slot props:

```html
<MyList>
  <template #default="{ item, index }">
    {{ index }}: {{ item.name }}
  </template>
</MyList>
```

## defineExpose

By default, `<script setup>` components are closed — parent cannot access their internals via template refs. `defineExpose` selectively exposes properties.

```ts
const count = ref(0)
function increment() { count.value++ }

defineExpose({
  count,      // parent reads ref.value.count (auto-unwrapped)
  increment   // parent calls ref.value.increment()
})
```

```ts
// Parent component:
const childRef = useTemplateRef<{ count: number; increment: () => void }>('child')
// or:
const childRef = useTemplateRef<InstanceType<typeof MyChild>>('child')
```

**Expose only what consumers actually need** — minimal public API principle.

## Style Blocks

### Scoped styles

`<style scoped>` — each rule gets a unique data attribute applied, preventing leakage.

```html
<style scoped>
.button {
  background: blue;  /* only applies to .button in THIS component */
}

/* Style a child component's root element */
:deep(.child-class) { color: red; }

/* Style slotted content */
:slotted(.slot-content) { margin: 0; }

/* Apply globally even from scoped */
:global(.always-blue) { color: blue; }
</style>
```

### CSS Modules

`<style module>` — generates unique class names, accessed via `$style` (or custom name).

```html
<template>
  <div :class="$style.wrapper">
    <p :class="[$style.text, isActive && $style.active]">Hello</p>
  </div>
</template>

<style module>
.wrapper { padding: 1rem; }
.text { font-size: 1rem; }
.active { color: blue; }
</style>
```

Named CSS module (for using multiple):

```html
<style module="ui">
.button { ... }
</style>
<!-- Access via ui.button -->
```

### CSS vars bound to reactive state (v-bind in style)

```html
<script setup lang="ts">
const color = ref('red')
const fontSize = ref(16)
</script>

<template>
  <p class="text">Hello</p>
</template>

<style scoped>
.text {
  color: v-bind(color);           /* reactive CSS variable */
  font-size: v-bind('fontSize + "px"');  /* expression supported */
}
</style>
```

Vue injects inline CSS variables scoped to the component — zero performance overhead vs. JS style binding.

## Component Registration

In `<script setup>`, components are auto-registered simply by importing them:

```ts
import MyButton from './MyButton.vue'
// Now <MyButton /> works in template — no explicit components: {} needed
```

**Dynamic components**:

```ts
import ComponentA from './A.vue'
import ComponentB from './B.vue'
const current = ref<typeof ComponentA | typeof ComponentB>(ComponentA)
```

```html
<component :is="current" />
```

**Async components** (lazy-loaded):

```ts
import { defineAsyncComponent } from 'vue'
const AsyncModal = defineAsyncComponent(() => import('./Modal.vue'))
```

With loading/error states:

```ts
const AsyncModal = defineAsyncComponent({
  loader: () => import('./Modal.vue'),
  loadingComponent: Spinner,
  errorComponent: ErrorDisplay,
  delay: 200,   // ms before showing loading component
  timeout: 5000 // ms before error
})
```

## TypeScript: ComponentProps and ComponentEmits helpers

Extract types from a component without importing its internals:

```ts
import type { ComponentProps, ComponentEmits } from 'vue'
import MyButton from './MyButton.vue'

type ButtonProps = ComponentProps<typeof MyButton>
type ButtonEmits = ComponentEmits<typeof MyButton>
```

Useful in wrapper components that forward props.
