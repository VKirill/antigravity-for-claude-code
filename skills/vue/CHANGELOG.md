# vue skill — CHANGELOG

All notable changes to this skill follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and SemVer.

## [Unreleased]

## [2.0.0] — 2026-05-16

### Changed

- SKILL.md compressed 261 → ~150 lines per v3 standard (Pattern 2)
- `references/eval-cases.md` migrated to v3 format: user-voice + Expected behavior + How to verify (10/10/5)
- Added `risk: medium-stakes` frontmatter
- Verified Vue 3.5 surface clean: `useTemplateRef`, `defineModel`, `defineSlots` against vue-docs MCP

### Added

- `references/troubleshooting.md` — `ref` unwrap surprises, reactivity loss after destructure, `watch` vs `watchEffect` timing, props mutation warning, composable conditional call, provide/inject undefined, `useTemplateRef` null, computed over-runs, Pinia raw destructure
- `references/wrong-vs-right.md` — reactive destructure vs `toRefs`, prop mutation vs `defineModel`, untyped vs `InjectionKey`, `ref(null)` vs `useTemplateRef`, Pinia store destructure, `watchEffect` async vs `watch`, Options API vs `<script setup>`

## [1.0.0] — 2026-05-15

### Added

- `SKILL.md` — Pattern 2 navigator with version block, full capabilities, behavioral traits, constraints, related skills, and API reference table
- `references/REFERENCE.md` — decision map + quick-lookup table for all Vue 3.5 APIs
- `references/composition-api.md` — lifecycle hooks, useTemplateRef, provide/inject, Teleport (incl. defer), Suspense, KeepAlive, custom directives, plugins
- `references/reactivity.md` — ref, reactive, shallowRef, computed, watch, watchEffect, watchPostEffect, onWatcherCleanup, reactivity gotchas
- `references/sfc-and-script-setup.md` — SFC structure, defineProps (incl. Vue 3.5 reactive destructure), defineEmits, defineModel, defineSlots, defineExpose, scoped styles, CSS modules, v-bind in style
- `references/composables.md` — composable pattern, MaybeRefOrGetter/toValue, TypeScript typing, async composables, cleanup patterns, effectScope, testing
- `references/pinia.md` — defineStore (setup + options style), storeToRefs, cross-store usage, persistence, TypeScript patterns, testing
- `references/vue-router.md` — createRouter, useRoute/useRouter, history modes, typed routes, navigation guards, route meta typing, lazy loading, nested routes, RouterLink
- `references/eval-cases.md` — positive/negative/edge routing tests
- `templates/component.vue` — typed SFC boilerplate with placeholder markers
- `templates/composable.ts.template` — typed composable boilerplate with MaybeRefOrGetter
- `examples/typed-events-with-emits.md` — defineEmits tuple syntax, parent consumption, gotchas
- `examples/composable-pattern.md` — useIntersectionObserver end-to-end: MaybeRefOrGetter, watch cleanup, onUnmounted, Vitest test with withSetup
- `examples/pinia-store.md` — two-store setup (auth + cart), storeToRefs usage, cross-store watch, component integration
