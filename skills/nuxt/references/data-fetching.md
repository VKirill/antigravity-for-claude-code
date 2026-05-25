# Nuxt 4 — Data Fetching

## Composable selection guide

| Composable | Best for | Deduplication | Reactive | SSR |
|---|---|---|---|---|
| `useFetch(url)` | URL-based, shorthand | yes (`cancel` default) | yes (url auto-watched) | yes |
| `useAsyncData(key, fn)` | Custom async, full control | yes (`cancel` default) | manual refresh | yes |
| `$fetch(url)` | Server handlers, fire-once | no | no | yes (untracked) |
| `createUseAsyncData(opts)` | Factory for typed composables | yes (inherits) | yes | yes |

## `useAsyncData` — Nuxt 4 defaults

```ts
const { data, pending, error, refresh, execute } = await useAsyncData(
  'unique-key',           // required — must be unique per page
  () => fetchSomething(),
  {
    dedupe: 'cancel',     // NEW default in Nuxt 4 — cancels in-flight on duplicate call
    deep: false,          // NEW default in Nuxt 4 — shallow reactive, better perf
    lazy: false,          // true = don't block navigation (use with pending spinner)
    server: true,         // false = skip server-side fetch
    default: () => null,  // default value before data arrives
    transform: (d) => d,  // transform response before storing
    pick: ['id', 'name'], // pick specific keys (shallow)
    watch: [dep1, dep2],  // auto-refresh when these change
    getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key], // read from SSR payload
  }
)
```

### `dedupe: 'cancel'` explained

When the same key is called multiple times (e.g., component re-mount during navigation), Nuxt 4 cancels the previous in-flight request and starts fresh. Nuxt 3 default was `'defer'` (re-use the existing promise). `'cancel'` is safer for stale data but generates more requests. Override to `'defer'` if you want the Nuxt 3 behavior:

```ts
const { data } = await useAsyncData('users', fetchUsers, { dedupe: 'defer' })
```

### `deep: false` explained

Nuxt 4 wraps returned data in a `shallowRef` by default. The value itself is not deeply reactive — mutating nested properties won't trigger updates. If you need deep reactivity (e.g., you mutate `data.value.user.name`), set `deep: true`:

```ts
const { data } = await useAsyncData('user', fetchUser, { deep: true })
```

Prefer building derived state with `computed` over mutating `data.value` directly.

## `useFetch` — shorthand pattern

`useFetch(url, opts)` = `useAsyncData(url, () => $fetch(url, opts), opts)`.

```ts
// Simplest form — GET request
const { data, pending, error } = await useFetch('/api/users')

// With query params (reactive — refreshes when filter changes)
const filter = ref('active')
const { data } = await useFetch('/api/users', {
  query: { status: filter },  // auto-watched, triggers refresh on change
})

// POST with body
const { data } = await useFetch('/api/users', {
  method: 'POST',
  body: { name: 'Alice', role: 'admin' },
})

// Typed response
interface User { id: string; name: string }
const { data } = await useFetch<User[]>('/api/users')
```

### Key deduplication in `useFetch`

The URL is used as the key. If two components call `useFetch('/api/users')` simultaneously, they share the same dedup bucket. Use `key` option to override:

```ts
const { data } = await useFetch('/api/users', { key: 'users-list-admin' })
```

## `$fetch` — fire-and-forget

`$fetch` is `ofetch` — an enhanced `fetch` with automatic JSON parsing, error throwing, and base URL support. Use it in:
- `defineEventHandler` (server routes) — not a composable, just a utility
- Event handlers (`@click`, form submit) — triggered by user, not SSR lifecycle
- Inside `useAsyncData` fn — `() => $fetch('/api/data')`

```ts
// In a Vue component event handler (not SSR lifecycle)
async function handleSubmit(payload: FormData) {
  const result = await $fetch('/api/save', {
    method: 'POST',
    body: payload,
  })
}

// With error handling
try {
  const data = await $fetch('/api/protected', {
    headers: { Authorization: `Bearer ${token.value}` }
  })
} catch (err) {
  if (err.status === 401) navigateTo('/login')
}
```

## `createUseAsyncData` — typed factory

New in Nuxt 4. Creates a composable factory with shared defaults and key namespace:

```ts
// app/composables/useApi.ts
const useApi = createUseAsyncData({
  dedupe: 'cancel',
  $fetch: useRequestFetch(),    // forward cookies in SSR
})

// Usage — key must still be unique
const { data: users } = await useApi('users', () => $fetch('/api/users'))
const { data: user } = await useApi('user-detail', () => $fetch(`/api/users/${id}`))
```

## Patterns

### Blocking vs non-blocking navigation

```ts
// Blocking — waits for data before showing page (default)
const { data } = await useFetch('/api/users')

// Non-blocking — shows page immediately, spinner while loading
const { data, pending } = useFetch('/api/users', { lazy: true })
```

```vue
<template>
  <div v-if="pending">Loading...</div>
  <UserList v-else :users="data" />
</template>
```

### Server-only fetch

```ts
// Only runs on server — result is serialized into SSR payload
const { data } = await useAsyncData('server-only', fetchPrivateData, {
  server: true,
  lazy: false,
  getCachedData: (key, nuxt) => nuxt.payload.data[key],
})
```

### Refresh on demand

```ts
const { data, refresh } = await useFetch('/api/users')

// Later — after mutation
await $fetch('/api/users', { method: 'POST', body: newUser })
await refresh()           // refetch and update `data`
```

### Dependent fetches (sequential)

```ts
// First fetch
const { data: userId } = await useFetch('/api/me')

// Second fetch — uses result of first
const { data: profile } = await useFetch(
  () => `/api/profile/${userId.value}`,  // reactive URL — re-fetches when userId changes
  { watch: [userId] }
)
```

### Error handling

```ts
const { data, error } = await useFetch('/api/users')

// Template
// <p v-if="error">{{ error.statusCode }}: {{ error.message }}</p>

// Or throw to error.vue
if (error.value) throw createError({ statusCode: 404, message: 'Not found' })
```

## Anti-patterns

| Anti-pattern | Problem | Fix |
|---|---|---|
| Duplicate keys: `useAsyncData('users', fn)` in two components | Throws in Nuxt 4 dev | Use unique keys per page/component scope |
| `data.value.user.name = x` with `deep: false` | Mutation doesn't trigger reactivity | Use `deep: true` or replace whole `data.value` |
| `useFetch` inside `defineEventHandler` | Not a composable — not available in server context | Use `$fetch` or `useStorage` |
| `await $fetch(url)` at top of `<script setup>` | Blocks render without dedup | Use `useAsyncData` / `useFetch` instead |
| Forgetting `await` before `useFetch` | Data may be undefined during SSR hydration | Always `await` at the composable call site |
