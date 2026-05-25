# Nuxt 4 — Migration from Nuxt 3

## Breaking changes summary

| Area | Nuxt 3 | Nuxt 4 |
|---|---|---|
| App code location | project root | `app/` directory |
| `useAsyncData` `dedupe` default | `'defer'` | `'cancel'` |
| `useAsyncData` `deep` default | `true` (deep reactive) | `false` (shallow reactive) |
| Key collision behavior | warning in dev | throws error in dev |
| `compatibility` flag | optional | `compatibilityDate` required |

## Step 1 — Update `nuxt.config.ts`

Add `compatibilityDate` (required in Nuxt 4):

```ts
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  // ... rest of config
})
```

## Step 2 — Move app code into `app/` directory

This is the primary structural change. Move these directories from project root into `app/`:

```
# Move from root → app/
pages/        → app/pages/
layouts/      → app/layouts/
components/   → app/components/
composables/  → app/composables/
middleware/   → app/middleware/       (client/universal only — NOT server/middleware/)
plugins/      → app/plugins/
utils/        → app/utils/
app.vue       → app/app.vue
error.vue     → app/error.vue
```

**Do NOT move these** — they stay at the project root:

```
server/           ← stays at root (Nitro)
public/           ← stays at root (static assets)
content/          ← stays at root (@nuxt/content)
nuxt.config.ts    ← stays at root
package.json      ← stays at root
```

Enable the new directory in `nuxt.config.ts` during transition (if using compatibility mode):

```ts
export default defineNuxtConfig({
  future: {
    compatibilityVersion: 4,  // opt into Nuxt 4 dir structure
  }
})
```

## Step 3 — Fix `useAsyncData` `dedupe` changes

Nuxt 4 default is `dedupe: 'cancel'`. If you relied on `'defer'` behavior (re-use in-flight promise), add explicit override:

```ts
// Before (Nuxt 3 behavior implicit)
const { data } = await useAsyncData('users', fetchUsers)

// After (explicit if you need Nuxt 3 behavior)
const { data } = await useAsyncData('users', fetchUsers, { dedupe: 'defer' })

// After (or accept Nuxt 4 default — recommended for new code)
const { data } = await useAsyncData('users', fetchUsers)  // dedupe: 'cancel' now
```

## Step 4 — Fix `useAsyncData` `deep` changes

If you mutate nested properties of `data.value`, you now need `deep: true` or restructure:

```ts
// BROKEN in Nuxt 4 (deep: false by default)
const { data } = await useAsyncData('user', fetchUser)
data.value!.profile.name = 'New Name'  // won't trigger reactivity

// Fix option A — set deep: true
const { data } = await useAsyncData('user', fetchUser, { deep: true })

// Fix option B — replace whole value
const { data } = await useAsyncData('user', fetchUser)
data.value = { ...data.value!, profile: { ...data.value!.profile, name: 'New Name' } }

// Fix option C — derive with computed (preferred)
const { data: rawUser } = await useAsyncData('user', fetchUser)
const userName = computed(() => rawUser.value?.profile.name)
```

## Step 5 — Fix key collisions

Duplicate `useAsyncData` keys now throw in dev. Audit all `useAsyncData` and `useFetch` calls:

```bash
# Find all useAsyncData key arguments across app/
grep -rn "useAsyncData(" app/ | grep -v "//.*useAsyncData"
```

Common collision scenario — two pages both use a generic key:

```ts
// BROKEN — both pages/users.vue and pages/admin/users.vue use 'users'
const { data } = await useAsyncData('users', fetchUsers)

// Fix — scope keys to page/context
// In pages/users.vue:
const { data } = await useAsyncData('users-list', fetchUsers)
// In pages/admin/users.vue:
const { data } = await useAsyncData('admin-users-list', fetchUsers)
```

## Step 6 — Update `$fetch` usage in components

`$fetch` called in the `<script setup>` top-level (not inside a handler) should be wrapped in `useAsyncData` for SSR deduplication:

```ts
// Before (Nuxt 3 — worked but no dedup)
const users = await $fetch('/api/users')

// After (Nuxt 4 — explicit dedup)
const { data: users } = await useAsyncData('users', () => $fetch('/api/users'))
// Or shorter:
const { data: users } = await useFetch('/api/users')
```

## Compatibility flags

Nuxt 4 includes a compatibility layer. Enable incrementally via `future` config to test:

```ts
export default defineNuxtConfig({
  future: {
    compatibilityVersion: 4,   // enable new app/ dir + Nuxt 4 behaviors
  },
  compatibilityDate: '2024-11-01',
})
```

This lets you migrate step by step without fully committing until all tests pass.

## Automated migration tool

```bash
npx nuxi upgrade --force    # update nuxt package
npx codemod nuxt/4          # apply codemods (moves files, updates imports)
```

The codemod handles the directory move but may not cover all `useAsyncData` key conflicts — review manually.

## Verification checklist

After migration:

- [ ] `nuxt build` exits 0 with no errors
- [ ] `app/` directory contains all Vue app code
- [ ] No `pages/`, `components/`, `composables/` at project root
- [ ] `server/` still at project root
- [ ] `compatibilityDate` set in `nuxt.config.ts`
- [ ] No duplicate `useAsyncData` keys (dev mode throws)
- [ ] Deep data mutations replaced with `deep: true` or structural replacements
- [ ] All routes render correctly (check dynamic + catch-all routes)
- [ ] Server routes still resolve at `/api/*`
- [ ] `runtimeConfig` values still accessible correctly
