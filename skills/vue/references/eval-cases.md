# vue — Eval Cases

v3 format: user-voice phrasing + Expected behavior + How to verify.

## Positive — should activate (10)

| User-voice prompt | Expected behavior |
|---|---|
| "defineModel для v-model в компоненте" | Load `sfc-and-script-setup.md`; show `defineModel<T>()` + named models |
| "Vue 3.5 — destructure props и сохранить reactivity" | Load `sfc-and-script-setup.md`; reactive props destructure section |
| "useTemplateRef вместо ref(null)" | Load `composition-api.md` `useTemplateRef` section |
| "ref vs reactive — что выбрать" | Load `reactivity.md` + `wrong-vs-right.md` (destructure case) |
| "watch vs watchEffect — когда какой" | Load `reactivity.md` + `troubleshooting.md` (timing section) |
| "Pinia setup-style store с storeToRefs" | Load `pinia.md`; show setup-function pattern |
| "provide/inject с типизацией" | Load `composition-api.md`; `InjectionKey<T>` pattern |
| "composable с MaybeRefOrGetter параметром" | Load `composables.md`; show `toValue()` pattern |
| "Suspense с async setup" | Load `composition-api.md` Suspense section |
| "Vue Router navigation guard для auth" | Load `vue-router.md` guards section |

## Negative — should NOT activate (10)

| User-voice prompt | Should route to | Why |
|---|---|---|
| "useAsyncData в Nuxt" | `nuxt` | Nuxt API |
| "Nuxt 4 server route" | `nuxt` | Nuxt-specific |
| "TS conditional types" | `typescript` | Type system |
| "Vite library mode" | `vite` | Build config |
| "Tailwind v4 CSS vars" | `tailwind` | Styling |
| "React useState" | `react` | Wrong framework |
| "Vue 2 mixin" | (legacy) | EOL, out of scope |
| "Vitest mock util" | `vitest` | Test runner |
| "zod transform" | `zod` | Validation |
| "Playwright trace viewer" | `playwright` | E2E only |

## Edge cases — 5

| User-voice prompt | Resolution |
|---|---|
| "Vue component testing с Vitest" | Both **vue** (component patterns) + **vitest** (mount/setup) load |
| "tsconfig для Vue проекта" | **vue** primary (SFC TS config); cross-link `typescript` for deep type system |
| "Pinia vs Vuex" | **vue** primary (Pinia is covered here; Vuex sunset) |
| "useAsyncData в Vue" | Ambiguous — `useAsyncData` is Nuxt-only; ask user; default to **nuxt** |
| "Vue + Tailwind class composition" | **vue** for component structure + **tailwind** for utility classes |

## How to verify (manual)

1. Open a fresh session with `vue` loaded.
2. Paste each Positive → confirm system reminder lists `vue` and response cites expected files.
3. Paste each Negative → confirm `vue` does NOT appear and fallback is mentioned.
4. Edge: confirm cross-link is called out explicitly.

If wrong: Negative→Positive tightens SKIP rules; Positive→Negative adds missing trigger; edge to one skill needs Related Skills enrichment.
