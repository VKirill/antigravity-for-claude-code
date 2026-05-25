# Nuxt 3 → 4 Migration Checklist

## Pre-flight — before you start

- [ ] Read the full migration guide: [references/migration-3-to-4.md](../references/migration-3-to-4.md)
- [ ] Run the test suite on the Nuxt 3 app and record the baseline pass rate
- [ ] Commit all outstanding work — start migration from a clean branch
- [ ] Check current Nuxt version: `npx nuxt version`

## Step 1 — Upgrade Nuxt

```bash
npx nuxi upgrade --force
```

- [ ] `package.json` shows `"nuxt": "^4.x.x"` after upgrade
- [ ] Lock file updated

## Step 2 — Add `compatibilityDate`

- [ ] `nuxt.config.ts` includes `compatibilityDate: '2024-11-01'`

## Step 3 — Enable Nuxt 4 layout (optional for incremental migration)

```ts
// nuxt.config.ts
future: {
  compatibilityVersion: 4,
}
```

- [ ] Decide: incremental (opt-in via `future`) or full migration now

## Step 4 — Move app code to `app/`

For each item below, verify the directory was moved AND the old root-level dir no longer exists:

- [ ] `pages/` → `app/pages/`
- [ ] `layouts/` → `app/layouts/`
- [ ] `components/` → `app/components/`
- [ ] `composables/` → `app/composables/`
- [ ] `middleware/` → `app/middleware/` (client/universal only)
- [ ] `plugins/` → `app/plugins/`
- [ ] `utils/` → `app/utils/`
- [ ] `app.vue` → `app/app.vue`
- [ ] `error.vue` → `app/error.vue`

Stays at root (do NOT move):

- [ ] `server/` — still at project root
- [ ] `public/` — still at project root
- [ ] `content/` — still at project root (if using @nuxt/content)
- [ ] `nuxt.config.ts` — still at project root
- [ ] `package.json` — still at project root

## Step 5 — Fix `useAsyncData` key collisions

```bash
# Find all useAsyncData calls
grep -rn "useAsyncData(" app/
```

- [ ] No two calls use the same string key
- [ ] Keys are page-scoped (e.g., `'blog-post-detail'` not just `'post'`)

## Step 6 — Audit `deep` reactivity usage

```bash
# Find direct mutations of useAsyncData/useFetch data
grep -rn "\.value\." app/ | grep -v "//.*\.value"
```

For each mutation of `data.value.*`, decide:

- [ ] Add `deep: true` to the composable options, OR
- [ ] Replace with full `data.value = { ...data.value, ...changes }`, OR
- [ ] Derive the value with `computed` instead of mutating

## Step 7 — Audit `dedupe` behavior

If you relied on Nuxt 3's `'defer'` behavior (multiple callers sharing the same in-flight promise):

```bash
grep -rn "dedupe" app/
```

- [ ] Calls that need Nuxt 3 `'defer'` behavior have `dedupe: 'defer'` explicitly set
- [ ] All other calls accept the new `'cancel'` default (recommended)

## Step 8 — Fix `$fetch` usage in SSR context

```bash
grep -rn "\$fetch(" app/ | grep -v "//.*\$fetch"
```

- [ ] `$fetch` calls at `<script setup>` top level (not inside event handlers) are wrapped in `useAsyncData` or `useFetch`
- [ ] `$fetch` in event handlers (`@click`, `@submit`) remains unchanged — correct usage

## Step 9 — Build verification

```bash
nuxt build
```

- [ ] Build completes with exit 0 and no errors
- [ ] No "pages/ found at root" warnings in build output

## Step 10 — Runtime verification

```bash
nuxt dev
```

- [ ] `nuxt dev` starts without errors
- [ ] All routes render correctly in browser
- [ ] Dynamic routes (`/users/[id]`) render with correct params
- [ ] Catch-all routes (`/[...slug]`) work
- [ ] Server API routes respond at `/api/*`
- [ ] Layouts apply correctly
- [ ] Route middleware fires (check auth redirect)
- [ ] `runtimeConfig` values accessible (test in a component with `useRuntimeConfig()`)
- [ ] No hydration mismatch warnings in browser console

## Step 11 — Test suite

- [ ] Unit/component tests pass
- [ ] E2E tests pass (if you have them)
- [ ] Pass rate equals or exceeds the pre-migration baseline

## Acceptance criteria

All items above checked. No console errors in browser. No errors in server terminal. Build exits 0.

## Rollback

If migration fails: `git checkout main` — the migration branch is isolated. Do not push until all acceptance criteria pass.
