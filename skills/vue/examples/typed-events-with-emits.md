# Typed Events with defineEmits

## Scenario

A reusable `SearchBar` component emits search queries, selection events, and a clear action. The parent needs compile-time checking for payload types.

## Approach

Use the tuple-style generic syntax for `defineEmits` (Vue 3.3+). Each event is a key; the tuple defines payload types.

## Step 1: Define typed emits

```ts
// SearchBar.vue <script setup lang="ts">
const emit = defineEmits<{
  // Single payload — the search string
  search: [query: string]
  // Multiple payloads — item and its source
  select: [item: SearchResult, source: 'keyboard' | 'mouse']
  // No payload
  clear: []
  // Optional: emit with state
  focus: [isFocused: boolean]
}>()
```

Tuple label (`query:`, `item:`) is optional but documents intent — show it in IDE hover.

## Step 2: Call emit with type enforcement

```ts
function handleInput(e: Event) {
  const query = (e.target as HTMLInputElement).value
  emit('search', query)        // TypeScript enforces string
  // emit('search', 123)       // Error: number not assignable to string
}

function handleSelect(item: SearchResult, via: 'keyboard' | 'mouse') {
  emit('select', item, via)    // both payloads required
}

function handleClear() {
  emit('clear')                 // no payload — correct
  // emit('clear', 'extra')    // Error: too many arguments
}
```

## Step 3: Parent receives with full type inference

```html
<!-- Parent.vue template -->
<SearchBar
  @search="onSearch"
  @select="onSelect"
  @clear="clearResults"
/>
```

```ts
// Parent <script setup>
function onSearch(query: string) {           // typed automatically
  results.value = search(query)
}

function onSelect(item: SearchResult, source: 'keyboard' | 'mouse') {
  console.log('Selected via', source)
  selected.value = item
}

function clearResults() {
  results.value = []
}
```

## Full Component

```vue
<script setup lang="ts">
import { ref } from 'vue'

interface SearchResult {
  id: string
  title: string
  url: string
}

const emit = defineEmits<{
  search: [query: string]
  select: [item: SearchResult, source: 'keyboard' | 'mouse']
  clear: []
  focus: [isFocused: boolean]
}>()

const query = ref('')
const selectedIndex = ref(-1)

function handleInput() {
  if (query.value.length >= 2) {
    emit('search', query.value)
  }
}

function handleKeydown(e: KeyboardEvent, results: SearchResult[]) {
  if (e.key === 'Enter' && results[selectedIndex.value]) {
    emit('select', results[selectedIndex.value], 'keyboard')
  }
}

function handleClear() {
  query.value = ''
  selectedIndex.value = -1
  emit('clear')
}
</script>

<template>
  <div class="search-bar">
    <input
      v-model="query"
      type="search"
      placeholder="Search..."
      @input="handleInput"
      @focus="emit('focus', true)"
      @blur="emit('focus', false)"
    />
    <button v-if="query" @click="handleClear" type="button">
      Clear
    </button>
  </div>
</template>
```

## Patterns and Gotchas

**Event naming**: `defineEmits` keys are camelCase. Vue maps `@select` in parent to `select` emit. Multi-word: `update:modelValue` (v-model), `item-selected` (kebab in parent). Prefer camelCase in defineEmits.

**Emitting update:* for manual v-model** (before `defineModel`):

```ts
const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
// In template: :value="modelValue" @input="emit('update:modelValue', $event.target.value)"
```

Now use `defineModel` instead — it handles this automatically.

**Emit validation** (runtime, not TypeScript):

```ts
const emit = defineEmits({
  search: (query: string) => {
    if (!query) {
      console.warn('Empty search query')
      return false  // invalid — Vue will warn but still emit
    }
    return true
  }
})
```

Validation runs at runtime and warns in development. Does not prevent the emit.

**Forwarding emits from a wrapper component**:

```ts
// Wrapper that forwards child emits
import ChildComponent from './ChildComponent.vue'
import type { ComponentEmits } from 'vue'

// Re-declare to forward:
const emit = defineEmits<ComponentEmits<typeof ChildComponent>>()
```
