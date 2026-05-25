---
name: vue
description: "Vue 3.5 — Composition API with script setup, reactivity, SFC, TypeScript. Use when: vue, vue 3, vue 3.5, composition api, script setup, ref, reactive, computed, watch, watchEffect, useTemplateRef, defineProps, defineEmits, defineModel, defineSlots, defineExpose, provide/inject, Teleport, Suspense, KeepAlive, custom directives, plugins, Pinia, Vue Router. SKIP: Nuxt-specific SSR/file routing (→nuxt), Vue 2 (legacy)."
stacks:
  - frontend
  - vue
packages:
  - vue
  - pinia
  - vue-router
  - vite
  - "@vitejs/plugin-vue"
tags:
  - vue
  - vue3
  - composition-api
  - sfc
  - typescript
  - frontend
  - pinia
  - vue-router
source: created-2026-05-15
risk: medium-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- Vue: `3.5.x`
- TypeScript: `6.0.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->

## Usage

Loaded automatically when its description matches the active task. Read only the section you need.

## Use this skill when

- Building Vue 3 components with `<script setup>` + Composition API
- Typed props (`defineProps`), emits (`defineEmits`), two-way binding (`defineModel`)
- Reactivity: `ref`, `reactive`, `shallowRef`, `computed`, `watch`, `watchEffect`
- Vue 3.5 features: reactive props destructure (stable), `useTemplateRef`, deferred Teleport, lazy hydration
- Composables (reusable stateful logic in `use*` functions)
- Pinia stores (`defineStore`, actions, getters, `storeToRefs`)
- Vue Router 4: typed routes, navigation guards, route meta, dynamic imports
- `provide`/`inject` with `InjectionKey` for type safety
- Suspense + async `setup()`
- Custom directives and plugins
- Scoped styles, CSS modules, CSS vars bound to state

## Do not use this skill when

- Nuxt-specific (SSR, file routing, server routes, `useAsyncData`, `useFetch`) → `nuxt`
- Vue 2 (Options API only, `Vue.component`, mixins) — Vue 2 is EOL; the path is migration to Vue 3
- TS type-system design → `typescript`
- Tailwind config / utility classes → `tailwind`
- Vite build config unrelated to Vue → `vite`
- Vitest setup not Vue-specific → `vitest`

## Purpose

Vue 3.5 is the stable production baseline. It ships reactive props destructure as stable (no more `toRefs` on props), `useTemplateRef` as the clean replacement for template refs, deferred Teleport for SSR safety, and lazy hydration strategies. Composition API with `<script setup>` is the idiomatic pattern — not Options API.

This skill covers SFC structure, all reactivity primitives, typed component contracts (`defineProps`, `defineEmits`, `defineModel`, `defineSlots`, `defineExpose`), composables, Pinia, Vue Router 4, and advanced APIs (Suspense, Teleport, KeepAlive, provide/inject, custom directives). Hands off to `nuxt` for SSR/file routing and `typescript` for deep type-system work.

## Capabilities

- **SFC & `<script setup>`** — canonical SFC block, compiler macros, file conventions. → [references/sfc-and-script-setup.md](references/sfc-and-script-setup.md)
- **Reactivity** — `ref`, `reactive`, `shallowRef`, `computed`, `watch`, `watchEffect`, `onWatcherCleanup`, `toRef`/`toRefs`. → [references/reactivity.md](references/reactivity.md)
- **Composition API & lifecycle** — `onMounted`/etc., `useTemplateRef` (Vue 3.5), provide/inject. → [references/composition-api.md](references/composition-api.md)
- **Props, emits, model, slots** — `defineProps<T>()`, `withDefaults`, reactive props destructure (Vue 3.5), `defineEmits<T>()` tuple syntax, `defineModel`, `defineSlots`, `defineExpose`. → [references/sfc-and-script-setup.md](references/sfc-and-script-setup.md)
- **Composables** — `use*` naming, `MaybeRefOrGetter<T>` + `toValue()`, cleanup, testing. → [references/composables.md](references/composables.md)
- **Provide / Inject** — `InjectionKey<T>` for type safety. → [references/composition-api.md](references/composition-api.md)
- **Teleport, Suspense, KeepAlive** — `<Teleport defer>` (Vue 3.5), async `setup()`, `<KeepAlive>` cache. → [references/composition-api.md](references/composition-api.md)
- **Pinia** — setup-function `defineStore`, `storeToRefs`, persistence. → [references/pinia.md](references/pinia.md)
- **Vue Router 4** — typed routes, guards, lazy `import()`. → [references/vue-router.md](references/vue-router.md)
- **Custom directives & plugins** — `Directive`, `app.use(plugin)`. → [references/composition-api.md](references/composition-api.md)
- **Troubleshooting** — `ref` unwrap surprises, reactivity loss after destructure, `watch` vs `watchEffect` timing. → [references/troubleshooting.md](references/troubleshooting.md)
- **Wrong vs right** — `reactive()` destructure vs `toRefs()`, raw props mutation vs `defineModel`, untyped provide/inject vs `InjectionKey`. → [references/wrong-vs-right.md](references/wrong-vs-right.md)

## Behavioral Traits

- Uses `<script setup lang="ts">` for every new component — never Options API
- Prefers `ref` over `reactive` as default — explicit `.value` prevents silent loss on destructure
- Uses Vue 3.5 reactive props destructure over `toRefs(props)` — less boilerplate, same reactivity
- Uses `useTemplateRef` over `ref<HTMLElement | null>(null)` for template refs
- Types all `defineProps` / `defineEmits` with generics — no runtime objects
- Uses `defineModel` for two-way binding — no manual `modelValue` + `update:modelValue`
- Extracts logic >30 lines into a composable named `use*`
- Cleans up watchers, listeners, timers in `onUnmounted` or `onWatcherCleanup`
- Uses `InjectionKey<T>` for every provide/inject pair
- Scopes CSS with `<style scoped>` by default; CSS modules when class collisions matter
- Uses `storeToRefs` when destructuring Pinia state — never raw destructure
- Lazy-loads route components with dynamic `import()`

## Important Constraints

- NEVER use Options API (`data()`, `methods`, `computed` object) for new components
- NEVER mutate props directly — emit events or use `defineModel`
- NEVER call composables inside `if`/`for`/nested functions — always at top level of `setup`
- NEVER wrap a `ref` in `reactive()` — it auto-unwraps and confuses
- NEVER use `v-html` with untrusted user content — XSS vector
- NEVER import Vuex — sunset; use Pinia
- ALWAYS use `onWatcherCleanup` or `onUnmounted` to clear side effects
- ALWAYS use `InjectionKey<T>` symbols — untyped string keys break type inference
- ALWAYS use `storeToRefs` when destructuring Pinia store reactive state

## Related Skills

✓ marks **active** skills; unmarked are **cascade markers**.

### Language & meta-framework
- ✓ `typescript` — TS 5.9
- ✓ `nuxt` — Nuxt 4 (dominant Vue SSR/full-stack)

### Build, styling, validation, testing
- ✓ `vite` — Vite 6
- ✓ `tailwind` — Tailwind CSS 4
- ✓ `zod` — Zod 4
- ✓ `vitest` — Vitest 4
- ✓ `playwright` — Playwright 1.60

Pinia is covered in this skill — no separate cascade.

## API Reference

| Topic | File |
|---|---|
| Index + decision map | [references/REFERENCE.md](references/REFERENCE.md) |
| Composition API: lifecycle, `useTemplateRef`, provide/inject, Teleport, Suspense, directives | [references/composition-api.md](references/composition-api.md) |
| Reactivity: ref, reactive, computed, watch, watchEffect, onWatcherCleanup, shallowRef | [references/reactivity.md](references/reactivity.md) |
| SFC structure, script setup, defineProps, defineEmits, defineModel, defineSlots, style scoped | [references/sfc-and-script-setup.md](references/sfc-and-script-setup.md) |
| Composables: pattern, typing, `MaybeRefOrGetter`, cleanup, testing | [references/composables.md](references/composables.md) |
| Pinia: defineStore, storeToRefs, actions, getters, persistence, testing | [references/pinia.md](references/pinia.md) |
| Vue Router 4: createRouter, useRoute, useRouter, guards, meta, lazy loading | [references/vue-router.md](references/vue-router.md) |
| **Troubleshooting** — ref unwrap, reactivity loss, watch timing | [references/troubleshooting.md](references/troubleshooting.md) |
| **Wrong vs right** — destructure, prop mutation, untyped provide/inject | [references/wrong-vs-right.md](references/wrong-vs-right.md) |
| Eval cases | [references/eval-cases.md](references/eval-cases.md) |

### Templates

| Template | File |
|---|---|
| Typed SFC component with script setup, props, emits, scoped styles | [templates/component.vue](templates/component.vue) |
| Typed composable with `MaybeRefOrGetter` input, cleanup, return type | [templates/composable.ts.template](templates/composable.ts.template) |

### Examples

| Scenario | File |
|---|---|
| Typed events with defineEmits: payload types, emit patterns | [examples/typed-events-with-emits.md](examples/typed-events-with-emits.md) |
| Composable pattern: `use*` naming, reactive inputs, cleanup | [examples/composable-pattern.md](examples/composable-pattern.md) |
| Pinia store: setup-function style, storeToRefs, actions, cross-store usage | [examples/pinia-store.md](examples/pinia-store.md) |

**How to use**: navigate to the specific file. Don't read all references — look up only what's relevant.
