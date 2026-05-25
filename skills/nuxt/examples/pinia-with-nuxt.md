# Pinia with Nuxt 4 (SSR-safe, hydration)

End-to-end: define a Pinia store, use it in SSR-rendered pages, and handle hydration correctly.

## Setup — `nuxt.config.ts`

```ts
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  modules: ['@pinia/nuxt'],
})
```

## Store definition — `app/stores/user.ts`

Use Composition API store (preferred for TypeScript):

```ts
import { defineStore } from 'pinia'

interface User {
  id:    string
  name:  string
  email: string
  role:  'admin' | 'user'
}

export const useUserStore = defineStore('user', () => {
  // State
  const currentUser = ref<User | null>(null)
  const users       = ref<User[]>([])
  const loading     = ref(false)

  // Getters
  const isLoggedIn = computed(() => currentUser.value !== null)
  const isAdmin    = computed(() => currentUser.value?.role === 'admin')

  // Actions
  async function fetchCurrentUser() {
    loading.value = true
    try {
      currentUser.value = await $fetch<User>('/api/auth/me')
    } catch {
      currentUser.value = null
    } finally {
      loading.value = false
    }
  }

  async function fetchUsers() {
    loading.value = true
    try {
      users.value = await $fetch<User[]>('/api/users')
    } finally {
      loading.value = false
    }
  }

  function logout() {
    currentUser.value = null
  }

  return {
    // State
    currentUser,
    users,
    loading,
    // Getters
    isLoggedIn,
    isAdmin,
    // Actions
    fetchCurrentUser,
    fetchUsers,
    logout,
  }
})
```

## Using the store in a page — `app/pages/dashboard.vue`

```vue
<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const store = useUserStore()

// Fetch data server-side — Pinia state is serialized into SSR payload
// and hydrated on client without a second fetch
const { data: users, pending } = await useAsyncData('dashboard-users', async () => {
  await store.fetchUsers()
  return store.users
})
</script>

<template>
  <div>
    <h1>Dashboard</h1>
    <p v-if="pending">Loading...</p>
    <ul v-else>
      <li v-for="user in users" :key="user.id">
        {{ user.name }} — {{ user.role }}
      </li>
    </ul>
  </div>
</template>
```

## SSR hydration — the correct pattern

Pinia + Nuxt `@pinia/nuxt` automatically serializes store state into the SSR payload. When the page hydrates on the client, the store is pre-populated — no second request needed.

**Gotcha**: calling `store.fetchUsers()` directly in `<script setup>` (not inside `useAsyncData`) works but skips deduplication. Always wrap store actions that fetch data inside `useAsyncData`:

```ts
// WRONG — runs twice (server + client), no dedup
await store.fetchUsers()

// CORRECT — runs once server-side, deduped on client via SSR payload
await useAsyncData('users', () => store.fetchUsers())
```

## Auth middleware — `app/middleware/auth.ts`

```ts
export default defineNuxtRouteMiddleware(async (to) => {
  const store = useUserStore()

  // Store may already be populated from SSR — avoid refetch
  if (!store.isLoggedIn) {
    await store.fetchCurrentUser()
  }

  if (!store.isLoggedIn) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
})
```

## Nuxt plugin for initial hydration — `app/plugins/auth.ts`

Load the current user once when the app boots (server-side):

```ts
export default defineNuxtPlugin(async () => {
  const store = useUserStore()

  // Only fetch on server (client gets the serialized state)
  if (import.meta.server) {
    await store.fetchCurrentUser().catch(() => {
      // Silent fail — user is not logged in
    })
  }
})
```

## Accessing store in server routes

Pinia is a client-side concern — you cannot access the Pinia store in `server/api/*` handlers. Server routes have their own context. Instead:

```ts
// server/api/users.get.ts — do NOT import Pinia here
// Read auth from the request directly
export default defineEventHandler(async (event) => {
  const user = event.context.user  // set by server middleware
  if (!user) throw createError({ statusCode: 401 })
  return { users: await getAllUsers() }
})
```
