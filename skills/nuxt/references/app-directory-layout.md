# Nuxt 4 — App Directory Layout

## Why the `app/` directory exists

Nuxt 4 moves all user-land application code into `app/`. This separates the Vue application layer from the Nitro server layer and eliminates ambiguity when Nuxt scans for auto-imports. The `server/` directory stays at the project root — it is a distinct Nitro subsystem with its own scope.

## Full project structure

```
my-nuxt-app/
├── app/                          ← all Vue app code lives here
│   ├── app.vue                   ← root component (required)
│   ├── pages/                    ← file-based routing
│   │   ├── index.vue
│   │   ├── about.vue
│   │   ├── users/
│   │   │   ├── index.vue         → /users
│   │   │   └── [id].vue          → /users/:id (dynamic)
│   │   └── [...slug].vue         → catch-all
│   ├── layouts/
│   │   ├── default.vue           ← applied when no layout specified
│   │   └── admin.vue
│   ├── components/               ← auto-imported by PascalCase
│   │   ├── AppHeader.vue
│   │   └── ui/
│   │       └── Button.vue        → <UiButton /> or <Ui:Button />
│   ├── composables/              ← auto-imported (useXxx pattern)
│   │   └── useAuth.ts
│   ├── middleware/               ← client/universal route middleware
│   │   └── auth.ts
│   ├── plugins/                  ← Nuxt plugins (client + server)
│   │   └── sentry.client.ts      ← .client.ts = client-only
│   ├── utils/                    ← auto-imported utilities
│   └── error.vue                 ← custom error page
├── server/                       ← Nitro server (stays at root)
│   ├── api/                      ← /api/* routes
│   │   └── users/
│   │       ├── index.get.ts
│   │       └── [id].get.ts
│   ├── routes/                   ← non-/api/* server routes
│   │   └── sitemap.xml.ts
│   ├── middleware/               ← Nitro server middleware (all reqs)
│   │   └── auth.ts
│   ├── utils/                    ← server-side auto-imports
│   └── plugins/                  ← Nitro plugins
├── public/                       ← static assets (served as-is)
├── content/                      ← @nuxt/content source (optional)
├── nuxt.config.ts
├── package.json
└── tsconfig.json
```

## `app.vue` — root component

The root component must include `<NuxtPage />` (or `<NuxtLayout>` wrapping it):

```vue
<!-- app/app.vue — minimal -->
<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
```

Without `<NuxtPage />`, file-based routing does not render.

## File-based routing — naming rules

| File | Route | Notes |
|---|---|---|
| `pages/index.vue` | `/` | |
| `pages/about.vue` | `/about` | |
| `pages/users/index.vue` | `/users` | |
| `pages/users/[id].vue` | `/users/:id` | `useRoute().params.id` |
| `pages/users/[id]/edit.vue` | `/users/:id/edit` | |
| `pages/[...slug].vue` | `/*` catch-all | `useRoute().params.slug` (array) |
| `pages/[[optional]].vue` | `/` or `/:optional` | optional param |

## Dynamic routes — accessing params

```vue
<!-- app/pages/users/[id].vue -->
<script setup lang="ts">
const route = useRoute()
const id = computed(() => route.params.id as string)

const { data: user } = await useFetch(`/api/users/${id.value}`)
</script>
```

## Layouts

Apply a layout in `definePageMeta` (preferred) or inherit `default.vue`:

```vue
<!-- app/pages/dashboard/index.vue -->
<script setup lang="ts">
definePageMeta({
  layout: 'admin'          // uses app/layouts/admin.vue
})
</script>
```

Switch layouts dynamically:

```vue
<script setup lang="ts">
const { setPageLayout } = useLayout()
setPageLayout('admin')
</script>
```

## `definePageMeta` — full options

```ts
definePageMeta({
  layout: 'admin',                    // layout name
  middleware: ['auth', 'log'],        // route middleware (array or string)
  alias: ['/alt-path'],               // URL aliases
  keepalive: true,                    // wrap in <KeepAlive>
  pageTransition: { name: 'fade' },  // Vue transition
  key: (route) => route.fullPath,    // force re-render key
  validate: (route) => {             // runtime validation
    return /^\d+$/.test(route.params.id as string)
  },
})
```

## Route middleware (client/universal)

```ts
// app/middleware/auth.ts
export default defineNuxtRouteMiddleware((to, from) => {
  const { loggedIn } = useAuth()
  if (!loggedIn.value) {
    return navigateTo('/login')
  }
})
```

Named middleware (above): referenced by filename string in `definePageMeta`.
Global middleware: rename file to `auth.global.ts` — runs on every navigation.

## Auto-imports

Components, composables, and utils under `app/` are auto-imported. Rules:

| Directory | Auto-import rule |
|---|---|
| `app/components/` | PascalCase filename → component name. Nested dirs prefix: `app/components/ui/Button.vue` → `<UiButton />` |
| `app/composables/` | Files must export a function named `use*` → available globally |
| `app/utils/` | Any named export → auto-imported by export name |

Disable per-file: `#imports` to control manually if needed.

## Plugins

```ts
// app/plugins/sentry.client.ts  (client-only)
export default defineNuxtPlugin((nuxtApp) => {
  // setup Sentry
  return {
    provide: {
      sentry: { captureException: (e: Error) => {} }
    }
  }
})
```

Access provided: `const { $sentry } = useNuxtApp()`

Suffixes: `.client.ts` (client-only), `.server.ts` (server-only), no suffix = universal.

## Error page

```vue
<!-- app/error.vue -->
<script setup lang="ts">
const props = defineProps<{ error: { statusCode: number; message: string } }>()
const handleError = () => clearError({ redirect: '/' })
</script>

<template>
  <div>
    <h1>{{ props.error.statusCode }}</h1>
    <p>{{ props.error.message }}</p>
    <button @click="handleError">Go home</button>
  </div>
</template>
```

## Key Nuxt 4 gotchas

1. **No `pages/` at project root** — only inside `app/`. Nuxt 4 will not pick them up.
2. **`server/` stays at root** — never move it inside `app/`.
3. **`public/` stays at root** — static assets are not inside `app/`.
4. **`nuxt.config.ts` stays at root** — not inside `app/`.
5. **`content/` stays at root** — @nuxt/content scans from root, not `app/`.
