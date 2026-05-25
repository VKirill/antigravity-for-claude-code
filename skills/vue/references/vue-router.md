# Vue Router 4 — createRouter, useRoute, useRouter, Guards, Meta, Lazy Loading

## Setup

```bash
npm install vue-router
```

```ts
// router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/HomeView.vue')  // lazy-loaded
  },
  {
    path: '/users/:id',
    name: 'UserDetail',
    component: () => import('@/views/UserDetail.vue'),
    props: true,  // route.params passed as component props
    meta: { requiresAuth: true }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue')
  }
]

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    return { top: 0 }
  }
})
```

```ts
// main.ts
app.use(router)
```

## History Modes

| Mode | Function | URL | Requires server config |
|---|---|---|---|
| HTML5 History | `createWebHistory()` | `/users/1` | Yes (fallback to index.html) |
| Hash | `createWebHashHistory()` | `/#/users/1` | No |
| Memory | `createMemoryHistory()` | No URL change | SSR / tests |

## useRoute and useRouter

```ts
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()   // current route (read-only, reactive)
const router = useRouter() // router instance (for navigation)

// Read route data
const id = route.params.id as string        // path param
const page = route.query.page as string     // query param
const meta = route.meta                     // route meta
const name = route.name                     // route name
```

**Programmatic navigation**:

```ts
// Push new history entry
router.push('/users/1')
router.push({ name: 'UserDetail', params: { id: '1' } })
router.push({ path: '/users', query: { page: '2' } })

// Replace current history entry (no back button)
router.replace({ name: 'Home' })

// Go forward/back in history
router.go(-1)  // back
router.go(1)   // forward
router.back()
router.forward()
```

**After navigation**:

```ts
const result = await router.push({ name: 'Home' })
if (result) {
  // NavigationFailure — cancelled, duplicated, or redirected
  console.log(result.type)
}
```

## Route Params as Props

Pass route params directly as component props — decouples component from router:

```ts
// Route definition:
{ path: '/users/:id', component: UserDetail, props: true }

// Or transform params:
{ path: '/users/:id', component: UserDetail, props: (route) => ({ userId: route.params.id }) }
```

```ts
// UserDetail.vue — receives id as prop, not via useRoute()
const props = defineProps<{ id: string }>()
```

## Typed Routes (vue-router 4.4+)

Define typed route names and params for compile-time safety:

```ts
// router/typed-routes.ts
import type { RouteLocationNormalizedLoaded } from 'vue-router'

declare module 'vue-router' {
  interface TypesConfig {
    RouteNamedMap: {
      Home: RouteLocationNormalizedLoaded & { name: 'Home'; params: {} }
      UserDetail: RouteLocationNormalizedLoaded & { name: 'UserDetail'; params: { id: string } }
    }
  }
}
```

With `typed-router` (unplugin-vue-router): auto-generates types from file-based route definitions.

## Navigation Guards

### Global guards

```ts
// Before each navigation
router.beforeEach(async (to, from) => {
  const authStore = useAuthStore()

  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    return { name: 'Login', query: { redirect: to.fullPath } }
    // returning false cancels navigation
    // returning a route location redirects
    // returning nothing / true allows navigation
  }
})

// After each navigation (no cancellation possible)
router.afterEach((to, from, failure) => {
  if (!failure) trackPageView(to.path)
})
```

### Per-route guards

```ts
{
  path: '/admin',
  component: AdminView,
  beforeEnter: (to, from) => {
    if (!isAdmin()) return { name: 'Forbidden' }
  }
}
```

Multiple guards per route:

```ts
{
  path: '/admin',
  beforeEnter: [requireAuth, requireAdmin]
}
```

### In-component guards

```ts
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'

// Confirm before leaving (e.g., unsaved form)
onBeforeRouteLeave((to, from) => {
  if (hasUnsavedChanges.value) {
    return window.confirm('Leave without saving?')
  }
})

// When route params change but same component is reused
onBeforeRouteUpdate(async (to, from) => {
  await fetchUser(to.params.id as string)
})
```

## Route Meta Typing

```ts
// Extend RouteMeta for type safety
import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    title?: string
    layout?: 'default' | 'fullscreen'
  }
}

// Usage in guard:
if (to.meta.requiresAuth) { ... }
// Usage in component:
const { title } = useRoute().meta
```

## Lazy Loading and Code Splitting

Dynamic imports trigger Vite/webpack code splitting automatically:

```ts
// Each view gets its own chunk
const routes = [
  { path: '/', component: () => import('./views/Home.vue') },
  { path: '/about', component: () => import('./views/About.vue') }
]
```

Group components in the same chunk with Vite's named chunks:

```ts
{
  component: () => import(/* @vite-ignore */ './views/UserDetail.vue')
  // Vite handles splitting — no manual chunk naming needed in most cases
}
```

`defineAsyncComponent` with loading/error states for inline use:

```ts
const AsyncComp = defineAsyncComponent({
  loader: () => import('./HeavyComponent.vue'),
  loadingComponent: Spinner,
  errorComponent: ErrorMsg,
  timeout: 10_000
})
```

## Nested Routes

```ts
{
  path: '/dashboard',
  component: DashboardLayout,
  children: [
    { path: '', name: 'DashboardHome', component: DashboardHome },  // /dashboard
    { path: 'analytics', name: 'Analytics', component: Analytics }, // /dashboard/analytics
    { path: 'settings', name: 'Settings', component: Settings }      // /dashboard/settings
  ]
}
```

`DashboardLayout.vue` must include `<RouterView />` to render child routes.

## Named Views (parallel components)

```ts
{
  path: '/dashboard',
  components: {
    default: DashboardMain,
    sidebar: DashboardSidebar,
    header: DashboardHeader
  }
}
```

```html
<!-- Layout template -->
<RouterView />               <!-- default -->
<RouterView name="sidebar" />
<RouterView name="header" />
```

## RouterLink

```html
<!-- Basic link -->
<RouterLink to="/about">About</RouterLink>

<!-- Named route with params -->
<RouterLink :to="{ name: 'UserDetail', params: { id: user.id } }">
  {{ user.name }}
</RouterLink>

<!-- Active class customization -->
<RouterLink to="/home" active-class="nav-active" exact-active-class="nav-exact-active">
  Home
</RouterLink>
```

`exact-active-class` only applies when the route matches exactly; `active-class` applies to parent routes too.

## Redirect and Alias

```ts
{ path: '/home', redirect: '/' }
{ path: '/old-page', redirect: { name: 'NewPage' } }
{ path: '/dynamic/:id', redirect: to => ({ name: 'Target', params: to.params }) }
{ path: '/about', alias: '/company', component: About }
```
