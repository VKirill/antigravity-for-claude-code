# Nuxt 4 — Modules & Configuration

## `nuxt.config.ts` anatomy

```ts
export default defineNuxtConfig({
  // --- App metadata ---
  compatibilityDate: '2024-11-01',   // required in Nuxt 4

  // --- Development tools ---
  devtools: { enabled: true },

  // --- Modules ---
  modules: [
    '@nuxt/ui',
    '@pinia/nuxt',
    '@nuxtjs/tailwindcss',
    '@nuxt/content',
    '@nuxt/image',
  ],

  // --- Runtime config (env vars) ---
  runtimeConfig: {
    // Server-only — NOT exposed to client
    apiSecret: '',          // overridden by NUXT_API_SECRET env var
    databaseUrl: '',        // overridden by NUXT_DATABASE_URL env var
    public: {
      // Exposed to both client and server
      apiBase: '/api',      // overridden by NUXT_PUBLIC_API_BASE
      siteUrl: '',          // overridden by NUXT_PUBLIC_SITE_URL
    }
  },

  // --- Route rules (server-side) ---
  routeRules: {
    '/admin/**':        { ssr: false },                  // SPA for admin
    '/api/**':          { cors: true },                  // enable CORS on API
    '/blog/**':         { swr: 3600 },                   // stale-while-revalidate 1hr
    '/static/**':       { static: true },                // full static
    '/**':              { headers: { 'X-Frame-Options': 'DENY' } },
  },

  // --- Nitro (server build) ---
  nitro: {
    preset: 'node-server',           // deployment target
    storage: {
      cache: { driver: 'memory' },   // or 'redis', 'fs', etc.
    },
    experimental: {
      websocket: true,
    },
  },

  // --- Vite (client build) ---
  vite: {
    plugins: [],
    optimizeDeps: {
      include: ['some-package'],
    },
  },

  // --- TypeScript ---
  typescript: {
    strict: true,
    typeCheck: true,               // run tsc at build time
  },

  // --- App head defaults ---
  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      title: 'My App',
      meta: [
        { name: 'description', content: 'Default meta description' },
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon.png' },
      ],
    },
    pageTransition: { name: 'page', mode: 'out-in' },
  },

  // --- Hooks ---
  hooks: {
    'pages:extend'(pages) {
      // Add programmatic routes
      pages.push({ name: 'custom', path: '/custom', file: '~/app/pages/index.vue' })
    },
  },
})
```

## `runtimeConfig` — secrets and public env

The env var naming convention: `NUXT_` prefix + snake_case → camelCase path.

| Config key | Env var |
|---|---|
| `runtimeConfig.apiSecret` | `NUXT_API_SECRET` |
| `runtimeConfig.public.apiBase` | `NUXT_PUBLIC_API_BASE` |
| `runtimeConfig.public.siteUrl` | `NUXT_PUBLIC_SITE_URL` |

Access in Vue components and composables:

```ts
// app/composables/useConfig.ts
const config = useRuntimeConfig()
// config.public.apiBase  ← available on client
// config.apiSecret       ← UNDEFINED on client, server-only
```

Access in server routes:

```ts
// server/api/protected.get.ts
export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)  // pass event for server context
  const secret = config.apiSecret        // server-only ✓
})
```

## Validate env at startup with Zod

```ts
// server/plugins/config.ts
import { z } from 'zod'

const ConfigSchema = z.object({
  apiSecret:   z.string().min(32, 'API secret must be at least 32 chars'),
  databaseUrl: z.string().url('DATABASE_URL must be a valid URL'),
})

export default defineNitroPlugin(() => {
  const config = useRuntimeConfig()
  const result = ConfigSchema.safeParse({
    apiSecret:   config.apiSecret,
    databaseUrl: config.databaseUrl,
  })
  if (!result.success) {
    throw new Error(`Invalid server config:\n${result.error.message}`)
  }
})
```

## `routeRules` — hybrid rendering

Route rules let different routes use different rendering strategies:

```ts
routeRules: {
  '/':             { prerender: true },           // generate at build time
  '/blog/**':      { swr: 3600 },                 // ISR — stale 1hr
  '/docs/**':      { static: true },              // fully static
  '/dashboard/**': { ssr: false },                // client SPA
  '/api/**':       { cors: true, cache: false },  // CORS, no cache
}
```

## Nuxt hooks

```ts
export default defineNuxtConfig({
  hooks: {
    // Pages
    'pages:extend'(pages) { /* add/remove routes */ },
    'pages:routerOptions'({ files }) { /* modify router opts */ },

    // Build
    'build:before'() { /* pre-build hook */ },
    'build:done'() { /* post-build hook */ },

    // Nitro
    'nitro:config'(nitroConfig) { /* modify nitro config */ },

    // Vite
    'vite:extendConfig'(viteConfig) { /* modify vite config */ },
  }
})
```

## Key modules

### `@pinia/nuxt`

```ts
// nuxt.config.ts
modules: ['@pinia/nuxt'],

// app/stores/user.ts
export const useUserStore = defineStore('user', () => {
  const user = ref<User | null>(null)
  const isLoggedIn = computed(() => user.value !== null)

  async function fetchUser(id: string) {
    user.value = await $fetch(`/api/users/${id}`)
  }

  return { user, isLoggedIn, fetchUser }
})

// In component — SSR-safe
const store = useUserStore()
```

### `@nuxt/ui`

```ts
modules: ['@nuxt/ui'],
// Provides UButton, UInput, UCard, UModal, etc. — all auto-imported
// Theming via app.config.ts:
```

```ts
// app.config.ts
export default defineAppConfig({
  ui: {
    primary: 'blue',
    gray: 'slate',
  }
})
```

### `@nuxtjs/tailwindcss`

```ts
modules: ['@nuxtjs/tailwindcss'],
// tailwind.config.ts is read automatically
// PostCSS integration handled internally
```

## Layers

Layers share configuration, components, and composables across multiple Nuxt apps:

```ts
// nuxt.config.ts
extends: [
  '../shared-layer',              // local layer
  'github:my-org/nuxt-layer',    // remote layer
],
```

A layer is just another directory with a `nuxt.config.ts`. Components, composables, and pages in the layer are merged with the consuming app. Lower layers can be overridden by the consuming app (consuming app wins).
