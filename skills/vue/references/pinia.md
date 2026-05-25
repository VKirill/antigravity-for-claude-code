# Pinia — defineStore, storeToRefs, Actions, Getters, Persistence

## Setup

```bash
npm install pinia
```

```ts
// main.ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
```

## defineStore — Setup Function Style (preferred)

Setup-function style mirrors Composition API: `ref()` = state, `computed()` = getters, plain functions = actions.

```ts
// stores/user.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useUserStore = defineStore('user', () => {
  // State
  const id = ref<string | null>(null)
  const name = ref('')
  const email = ref('')
  const loading = ref(false)

  // Getters
  const isLoggedIn = computed(() => id.value !== null)
  const displayName = computed(() => name.value || 'Guest')

  // Actions
  async function login(credentials: { email: string; password: string }) {
    loading.value = true
    try {
      const user = await authApi.login(credentials)
      id.value = user.id
      name.value = user.name
      email.value = user.email
    } finally {
      loading.value = false
    }
  }

  function logout() {
    id.value = null
    name.value = ''
    email.value = ''
  }

  return { id, name, email, loading, isLoggedIn, displayName, login, logout }
})
```

**Why setup style over options style?**
- Uses the same reactive primitives as components — no new API to learn
- Works naturally with TypeScript generics
- Can use other composables and lifecycle hooks inside the store
- Cleaner tree shaking

## defineStore — Options Style (alternative)

When you prefer structured separation of state/getters/actions:

```ts
export const useCounterStore = defineStore('counter', {
  state: () => ({ count: 0, name: 'Counter' }),
  getters: {
    double: (state) => state.count * 2,
    // this-typed getter:
    doubleWithName(): string { return `${this.double} (${this.name})` }
  },
  actions: {
    increment() { this.count++ },
    async fetchCount() {
      this.count = await api.getCount()
    }
  }
})
```

## Using a Store in Components

```ts
// <script setup>
import { useUserStore } from '@/stores/user'
import { storeToRefs } from 'pinia'

const store = useUserStore()

// Extract reactive state and getters WITHOUT losing reactivity:
const { name, email, isLoggedIn, loading } = storeToRefs(store)

// Actions can be destructured directly (they don't need reactivity):
const { login, logout } = store
```

**Why `storeToRefs`?**

Destructuring a store directly loses reactivity because Pinia stores are reactive objects:

```ts
// WRONG — name and email are plain strings, not reactive
const { name, email } = store

// RIGHT — name and email are reactive refs
const { name, email } = storeToRefs(store)
```

`storeToRefs` only wraps state and getters — not actions. Actions can be destructured freely.

## Store-to-Store Interaction

Stores can call each other. In setup-function style, just import and call:

```ts
import { useAuthStore } from './auth'

export const useUserProfileStore = defineStore('userProfile', () => {
  const authStore = useAuthStore()

  const profile = computed(() =>
    authStore.isLoggedIn ? fetchProfile(authStore.userId) : null
  )

  return { profile }
})
```

## Resetting Store State

Setup-function stores don't have auto `$reset()`. Implement explicitly:

```ts
export const useCounterStore = defineStore('counter', () => {
  const count = ref(0)
  const name = ref('Counter')

  function $reset() {
    count.value = 0
    name.value = 'Counter'
  }

  return { count, name, $reset }
})
```

Options-style stores have `$reset()` automatically.

## Subscribing to State Changes

```ts
store.$subscribe((mutation, state) => {
  // mutation.type: 'direct' | 'patch object' | 'patch function'
  // state: current full state
  console.log(mutation.type, state)
}, { detached: true }) // detached: keeps subscription alive after component unmounts
```

Subscribing to actions:

```ts
store.$onAction(({ name, args, after, onError }) => {
  console.log(`Action ${name} called with`, args)
  after((result) => console.log('Result:', result))
  onError((error) => console.error('Error:', error))
})
```

## Persistence (pinia-plugin-persistedstate)

```bash
npm install pinia-plugin-persistedstate
```

```ts
// main.ts
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)
app.use(pinia)
```

```ts
// In the store:
export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null)
  return { token }
}, {
  persist: {
    key: 'auth',
    storage: localStorage,
    pick: ['token']  // only persist these fields
  }
})
```

Options-style:

```ts
export const useAuthStore = defineStore('auth', {
  state: () => ({ token: null as string | null }),
  persist: true  // persists all state to localStorage
})
```

## TypeScript Patterns

### Typed state with complex types

```ts
interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
}

export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])

  const total = computed(() =>
    items.value.reduce((sum, item) => sum + item.price * item.quantity, 0)
  )

  function addItem(item: CartItem) {
    const existing = items.value.find(i => i.id === item.id)
    if (existing) {
      existing.quantity += item.quantity
    } else {
      items.value.push(item)
    }
  }

  function removeItem(id: string) {
    const idx = items.value.findIndex(i => i.id === id)
    if (idx !== -1) items.value.splice(idx, 1)
  }

  return { items: readonly(items), total, addItem, removeItem }
})
```

## Testing Pinia Stores

```ts
import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach } from 'vitest'
import { useCounterStore } from './counter'

describe('useCounterStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('increments count', () => {
    const store = useCounterStore()
    expect(store.count).toBe(0)
    store.increment()
    expect(store.count).toBe(1)
  })

  it('exposes double getter', () => {
    const store = useCounterStore()
    store.count = 5
    expect(store.double).toBe(10)
  })
})
```

**Testing with mocked actions**:

```ts
import { vi } from 'vitest'

it('shows loading while fetching', async () => {
  const store = useUserStore()
  vi.spyOn(store, 'fetchUser').mockResolvedValue({ id: '1', name: 'Alice' })
  // ...
})
```

## Common Anti-Patterns

**Direct reactive state from store without storeToRefs**:

```ts
// WRONG:
const { count } = useCounterStore()  // count is not reactive

// RIGHT:
const { count } = storeToRefs(useCounterStore())
```

**Calling a store outside setup/lifecycle (outside Vue context)**:

```ts
// WRONG — no active Pinia instance
const store = useCounterStore()

// RIGHT — in component setup or after app.use(createPinia()):
onMounted(() => {
  const store = useCounterStore()
})
// or import the store outside and call it inside setup
```

**Mutating store state directly from a component (should go through actions)**:

```ts
// Works but bypasses action logging/subscriptions:
store.count++

// Better — define and call an action:
store.increment()
```
