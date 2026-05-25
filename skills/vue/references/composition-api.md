# Composition API — Lifecycle, useTemplateRef, provide/inject, Advanced APIs

## Lifecycle Hooks

All lifecycle hooks are called inside `<script setup>` (or inside `setup()` for non-SFC usage). They register callbacks synchronously — do not call them inside conditions or async paths.

| Hook | When it fires | Common use |
|---|---|---|
| `onMounted` | After component DOM is inserted | DOM refs, third-party lib init |
| `onUpdated` | After reactive update re-renders DOM | DOM inspection after update |
| `onUnmounted` | After component is removed from DOM | Cleanup: listeners, timers, subscriptions |
| `onBeforeMount` | Before first render | Rarely needed |
| `onBeforeUpdate` | Before a reactive update re-renders | Capture pre-update DOM state |
| `onBeforeUnmount` | Before teardown begins | Same as onUnmounted but earlier |
| `onErrorCaptured` | When descendant throws during render | Error boundary logic |
| `onActivated` | When KeepAlive component enters | Refresh data in cached component |
| `onDeactivated` | When KeepAlive component leaves | Pause timers in cached component |

```ts
import { onMounted, onUnmounted } from 'vue'

onMounted(() => {
  window.addEventListener('resize', onResize)
})
onUnmounted(() => {
  window.removeEventListener('resize', onResize)
})
```

## useTemplateRef (Vue 3.5)

`useTemplateRef<T>(key)` is the canonical way to bind template refs in Vue 3.5. The `key` string must match the `ref=""` attribute in the template.

```ts
// <script setup>
import { useTemplateRef, onMounted } from 'vue'

const inputEl = useTemplateRef<HTMLInputElement>('myInput')
onMounted(() => inputEl.value?.focus())
```

```html
<!-- template -->
<input ref="myInput" type="text" />
```

For component refs:

```ts
import MyChild from './MyChild.vue'
const childRef = useTemplateRef<InstanceType<typeof MyChild>>('child')
// template: <MyChild ref="child" />
// Call: childRef.value?.exposedMethod()
```

**Why useTemplateRef over `ref<HTMLElement | null>(null)`?**
- The key string creates an explicit binding visible in templates
- TypeScript infers the element type from the generic
- Works correctly with Vue's compiler transforms

**Gotcha**: `useTemplateRef` returns a readonly ref; the `.value` is `null` until `onMounted` fires.

## provide / inject

Use `InjectionKey<T>` (a typed Symbol) for type-safe provide/inject across component trees.

```ts
// keys.ts — define once, import everywhere
import type { InjectionKey, Ref } from 'vue'

export const UserKey: InjectionKey<Ref<User>> = Symbol('user')
export const ThemeKey: InjectionKey<'light' | 'dark'> = Symbol('theme')
```

```ts
// Provider component (ancestor)
import { provide, ref } from 'vue'
import { UserKey } from './keys'

const user = ref<User>({ name: 'Alice' })
provide(UserKey, user)
```

```ts
// Consumer component (descendant, any depth)
import { inject } from 'vue'
import { UserKey } from './keys'

const user = inject(UserKey) // Ref<User> | undefined
const user2 = inject(UserKey, ref({ name: 'Guest' })) // Ref<User> — has default
```

**App-level provide** (for plugins/global state):

```ts
// main.ts
app.provide(ThemeKey, 'dark')
```

**Rules**:
- Always use `InjectionKey<T>` symbols — never raw strings (loses type information)
- `inject` without default returns `T | undefined` — handle the undefined case
- Providing a `ref` lets the consumer react to changes; providing a plain value doesn't

## Teleport

`<Teleport to>` renders its slot at a different DOM node while keeping the component tree relationship.

```html
<Teleport to="body">
  <div class="modal-overlay">
    <slot />
  </div>
</Teleport>
```

**Vue 3.5 deferred Teleport**: add `defer` to wait until after the parent component is mounted. Required when `to` targets a DOM element rendered by another component.

```html
<Teleport to="#modal-root" defer>
  <Modal />
</Teleport>
```

**Disable conditionally** (e.g., render inline in tests):

```html
<Teleport to="body" :disabled="isTest">
  <Modal />
</Teleport>
```

**Multiple Teleports to same target**: rendered in append order. Use `:order` prop (Vue 3.5) to control stacking.

## Suspense

`<Suspense>` coordinates async `setup()` in descendant components. While any async component in the subtree is pending, it renders the `#fallback` slot.

```html
<Suspense>
  <template #default>
    <AsyncUserProfile />   <!-- has async setup() -->
  </template>
  <template #fallback>
    <LoadingSpinner />
  </template>
</Suspense>
```

**Async setup example**:

```ts
// AsyncUserProfile.vue
const user = await fetchUser(props.id)  // top-level await in <script setup>
```

**onErrorCaptured** on a parent component catches errors thrown during async setup.

**Nested Suspense**: each boundary resolves independently. Inner Suspense resolves first; then outer.

**`suspensible` prop on async components**: allows parent Suspense to control their loading state.

## KeepAlive

Caches component instances to preserve state between route changes or conditional renders.

```html
<KeepAlive :include="['UserList', 'Dashboard']" :max="5">
  <component :is="currentComponent" />
</KeepAlive>
```

- `:include` — array of component names to cache (or RegExp)
- `:exclude` — names to never cache
- `:max` — LRU limit; oldest entry evicted when exceeded

**Lifecycle hooks for cached components**:

```ts
onActivated(() => {
  // Component re-entered the view; refresh stale data
  refreshData()
})
onDeactivated(() => {
  // Component left the view; pause animations/polling
  pausePolling()
})
```

**Gotcha**: KeepAlive only works with `<component :is>` or inside router-view. It does NOT work with `v-if`.

## Custom Directives

In `<script setup>`, a directive named `vFocus` (camelCase starting with `v`) is auto-available as `v-focus` in the template.

```ts
import type { Directive } from 'vue'

const vFocus: Directive<HTMLInputElement> = {
  mounted(el) {
    el.focus()
  }
}
```

```html
<input v-focus />
```

**Directive lifecycle hooks** (mirror component lifecycle):

| Hook | When |
|---|---|
| `created` | Before element's attrs/listeners are applied |
| `beforeMount` | Before element is inserted into DOM |
| `mounted` | After element is inserted (and children) |
| `beforeUpdate` | Before parent VNode updates |
| `updated` | After VNode update |
| `beforeUnmount` | Before element is removed |
| `unmounted` | After element is removed |

**Directive with value and modifiers**:

```ts
const vHighlight: Directive<HTMLElement, string> = {
  mounted(el, binding) {
    el.style.backgroundColor = binding.value  // v-highlight="'yellow'"
    if (binding.modifiers.bold) {
      el.style.fontWeight = 'bold'            // v-highlight.bold="'yellow'"
    }
  }
}
```

**Global directive registration** (for directives used across many components):

```ts
// main.ts
app.directive('highlight', vHighlight)
```

## Plugins

A plugin is an object with an `install(app, options)` method.

```ts
// plugins/i18n.ts
import type { App, Plugin } from 'vue'

export interface I18nOptions {
  locale: string
  messages: Record<string, Record<string, string>>
}

export const i18nPlugin: Plugin<I18nOptions> = {
  install(app, options) {
    app.config.globalProperties.$t = (key: string) =>
      options.messages[options.locale]?.[key] ?? key
    app.provide('i18n', options)
  }
}
```

```ts
// main.ts
app.use(i18nPlugin, { locale: 'en', messages: { en: { hello: 'Hello' } } })
```

**Use provide over globalProperties** when possible — `provide` is type-safe and works with Composition API; `globalProperties` is only accessible in templates and Options API.
