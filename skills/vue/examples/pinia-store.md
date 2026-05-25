# Pinia Store — Setup-Function Style, storeToRefs, Cross-Store Usage

## Scenario

A shopping cart with authentication-dependent behavior. Two stores: `useAuthStore` and `useCartStore`. The cart store reads from auth; a component uses both.

## Step 1: Auth store

```ts
// stores/auth.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface User {
  id: string
  name: string
  email: string
}

export const useAuthStore = defineStore('auth', () => {
  // State — ref() for all reactive values
  const user = ref<User | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Getters — computed() for derived values
  const isLoggedIn = computed(() => user.value !== null)
  const displayName = computed(() => user.value?.name ?? 'Guest')

  // Actions — plain async functions
  async function login(email: string, password: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const result = await authApi.login({ email, password })
      user.value = result
    } catch (e) {
      error.value = (e as Error).message
      throw e
    } finally {
      loading.value = false
    }
  }

  function logout(): void {
    user.value = null
  }

  return { user, loading, error, isLoggedIn, displayName, login, logout }
})
```

## Step 2: Cart store reading from auth store

```ts
// stores/cart.ts
import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useAuthStore } from './auth'

export interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
}

export const useCartStore = defineStore('cart', () => {
  const authStore = useAuthStore()

  // State
  const items = ref<CartItem[]>([])
  const syncing = ref(false)

  // Getters
  const itemCount = computed(() =>
    items.value.reduce((sum, i) => sum + i.quantity, 0)
  )

  const subtotal = computed(() =>
    items.value.reduce((sum, i) => sum + i.price * i.quantity, 0)
  )

  // Sync with server when auth state changes
  watch(
    () => authStore.isLoggedIn,
    async (loggedIn) => {
      if (loggedIn) {
        await loadFromServer()
      } else {
        items.value = []
      }
    }
  )

  // Actions
  function addItem(item: Omit<CartItem, 'quantity'>, quantity = 1): void {
    const existing = items.value.find(i => i.id === item.id)
    if (existing) {
      existing.quantity += quantity
    } else {
      items.value.push({ ...item, quantity })
    }
  }

  function removeItem(id: string): void {
    const idx = items.value.findIndex(i => i.id === id)
    if (idx !== -1) items.value.splice(idx, 1)
  }

  function updateQuantity(id: string, quantity: number): void {
    const item = items.value.find(i => i.id === id)
    if (item) {
      if (quantity <= 0) {
        removeItem(id)
      } else {
        item.quantity = quantity
      }
    }
  }

  async function loadFromServer(): Promise<void> {
    if (!authStore.user) return
    syncing.value = true
    try {
      items.value = await cartApi.getCart(authStore.user.id)
    } finally {
      syncing.value = false
    }
  }

  return {
    items,
    syncing,
    itemCount,
    subtotal,
    addItem,
    removeItem,
    updateQuantity
  }
})
```

## Step 3: Component using both stores

```vue
<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { storeToRefs } from 'pinia'

const authStore = useAuthStore()
const cartStore = useCartStore()

// Extract reactive state/getters with storeToRefs
// (actions can be destructured directly — no reactivity needed)
const { displayName, isLoggedIn } = storeToRefs(authStore)
const { items, itemCount, subtotal, syncing } = storeToRefs(cartStore)
const { addItem, removeItem, updateQuantity } = cartStore

// ── WRONG (never do this) ─────────────────────────────────────────────────────
// const { displayName, isLoggedIn } = authStore
// ^ These are plain values — not reactive, won't update in template

// ── RIGHT ─────────────────────────────────────────────────────────────────────
// const { displayName } = storeToRefs(authStore)
// ^ This is a Ref<string> — reactive, updates when store changes
</script>

<template>
  <header>
    <span>{{ displayName }}</span>
    <span v-if="isLoggedIn" class="badge">{{ itemCount }} items</span>
  </header>

  <section v-if="syncing">Syncing cart...</section>

  <ul v-else>
    <li v-for="item in items" :key="item.id">
      <span>{{ item.name }} — ${{ item.price }}</span>
      <input
        type="number"
        :value="item.quantity"
        @change="updateQuantity(item.id, +($event.target as HTMLInputElement).value)"
      />
      <button @click="removeItem(item.id)">Remove</button>
    </li>
  </ul>

  <footer v-if="items.length">
    <strong>Subtotal: ${{ subtotal.toFixed(2) }}</strong>
  </footer>
</template>
```

## Verification

After adding/removing items, `itemCount` and `subtotal` update reactively in the template — no manual refresh. On login, the cart syncs from the server automatically via the watch inside the cart store.

## Patterns Illustrated

**storeToRefs separates state from actions**:

```ts
const { count, isLoggedIn } = storeToRefs(store)  // Ref<T> — reactive
const { increment, logout } = store                  // functions — no wrapper needed
```

**Cross-store reads via direct store access** (not via provide/inject):

```ts
// Inside another store's setup:
const otherStore = useOtherStore()
const derived = computed(() => otherStore.someValue)
```

**Watch in store for side effects tied to state changes**:

```ts
// Preferred over watching in component — keeps sync logic colocated with state
watch(() => authStore.isLoggedIn, (loggedIn) => { ... })
```

**$reset equivalent for setup stores** — implement it explicitly:

```ts
const INITIAL_STATE = { items: [] as CartItem[], syncing: false }
function $reset() {
  items.value = [...INITIAL_STATE.items]
  syncing.value = INITIAL_STATE.syncing
}
return { ..., $reset }
```
