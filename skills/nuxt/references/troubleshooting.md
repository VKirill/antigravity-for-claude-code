# nuxt — Troubleshooting

Symptom-indexed.

## `useAsyncData` / `useFetch` double-fetches on client after SSR

**Symptom:** Network tab shows the same endpoint hit twice on first page load — once during SSR, once on client hydration.

**Causes:**
1. Key collision — Nuxt deduplicates by key. Missing or duplicate `key` defeats dedupe of the SSR-serialized payload.
2. `getCachedData` not implemented — SSR payload is serialized but client re-fetches because no cache hit.
3. Calling `$fetch` inside `useAsyncData` handler — Nuxt cannot dedupe arbitrary `$fetch` calls.

**Fix:**
```ts
const { data } = await useFetch('/api/users', {
  key: 'users-list',          // explicit, deterministic
})
```

Or with `useAsyncData`:
```ts
const { data } = await useAsyncData('users-list', () => $fetch('/api/users'))
```

Nuxt automatically transports SSR result via `useNuxtData('users-list')` into the same key on the client — no re-fetch.

## `useState` value resets on navigation

**Symptom:** `useState('counter', () => 0)` reads as `0` after navigating away and back.

**Cause:** This is correct *only if* you pass a different key or no key. Without a key, Nuxt generates a per-call key and the state is per-component instance.

**Fix:** Pass an explicit string key:
```ts
const counter = useState('counter', () => 0)   // shared across all components
```

State persists for the lifetime of the request (SSR) and the lifetime of the SPA session (client).

## Server route returns 404 unexpectedly

**Symptom:** `/api/users/123` returns 404 even though `server/api/users/[id].get.ts` exists.

**Causes:**
1. Method mismatch — file is `.get.ts` but request is POST
2. Filename wrong — `[id].ts` (any method) vs `[id].get.ts` (GET only); typo in brackets
3. File location — anywhere other than `server/api/` doesn't get `/api/` prefix
4. Build cache stale after creating new route — restart `nuxt dev`

**Fix:** Verify filename and `defineEventHandler` are correct; restart dev server; check with `curl -i http://localhost:3000/api/users/123`.

## Wrong Nitro preset on deploy

**Symptom:** `process.env`, `fs`, or `path` errors in production logs on Cloudflare/Netlify.

**Cause:** Default `node-server` preset deployed to an edge runtime. Edge runtimes don't have Node built-ins.

**Fix:** Set preset explicitly:
```ts
// nuxt.config.ts
nitro: { preset: 'cloudflare-pages' }   // or 'netlify', 'vercel-edge', etc.
```

Or via env: `NITRO_PRESET=cloudflare-pages nuxt build`.

## Hydration mismatch

**Symptom:** "Hydration node mismatch" warning in console.

**Common causes (in order):**
1. `Date.now()`, `Math.random()`, `new Date()` in template — server and client produce different values
2. `if (process.client)` / `if (import.meta.client)` branching that differs from SSR
3. Different `useState` initial value between server and client
4. Browser extension injecting nodes

**Fix:** Use `<ClientOnly>` wrapper around inherently client-only content:
```vue
<ClientOnly>
  <p>Time: {{ new Date().toLocaleTimeString() }}</p>
  <template #fallback><p>Loading…</p></template>
</ClientOnly>
```

## `useFetch` data not reactive after Nuxt 4 upgrade

**Symptom:** Updates to nested properties on the fetched object don't trigger re-render.

**Cause:** Nuxt 4 defaults `deep: false` — `data` is a `shallowRef`, not a deep reactive ref.

**Fix:** Either re-fetch via `refresh()` after mutation (recommended), or opt back into deep:
```ts
const { data, refresh } = await useFetch('/api/user', { deep: true })
```

Better: don't mutate cached server data on the client; trigger a server-side mutation then `refresh()`.

## `useAsyncData` key collision throws in dev

**Symptom:** Dev mode error: "Duplicate key 'users' detected in useAsyncData."

**Cause:** Nuxt 4 made duplicate keys a hard error (was a warning in 3).

**Fix:** Use unique keys per call. Common pattern — include params:
```ts
const { data } = await useFetch(`/api/users/${id}`, { key: `user-${id}` })
```

For typed factories use `createUseAsyncData`:
```ts
export const useUser = createUseAsyncData({
  keyPrefix: 'user',
})
```

## `useRuntimeConfig().apiSecret` is undefined on client

**Symptom:** Accessing a server-only config value from a `.vue` component logs `undefined`.

**Cause:** Correct behavior — server-only config never ships to the client.

**Fix:** Either:
- Access from `server/api/*` route, then expose via API
- Move to `runtimeConfig.public.*` if it's truly safe to expose (it usually isn't)

## See also

- [data-fetching.md](data-fetching.md) — full composable semantics
- [server-routes.md](server-routes.md) — h3 handler patterns
- [recommended-defaults.md](recommended-defaults.md) — canonical config
