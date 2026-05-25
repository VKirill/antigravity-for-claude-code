# nuxt — Eval Cases

v3 format: user-voice phrasing + Expected behavior column + How to verify.

## Positive — should activate (10)

| User-voice prompt | Expected behavior |
|---|---|
| "useAsyncData дублирует запрос на client после SSR" | Load `troubleshooting.md` double-fetch + `data-fetching.md` (dedupe semantics) |
| "server/api/users/[id].get.ts вернуть 404" | Load `server-routes.md`; show `createError({ statusCode: 404 })` |
| "куда положить pages/ в Nuxt 4" | Load `app-directory-layout.md`; explain `app/pages/` requirement |
| "runtimeConfig для секретов и публичных vars" | Load `modules.md`; private vs `public` split, `useRuntimeConfig()` |
| "deploy на Cloudflare Pages" | Load `deployment.md`; `nitro: { preset: 'cloudflare-pages' }` |
| "migrate Nuxt 3 → 4 — что меняется" | Load `checklists/migration-3-to-4.md` + `migration-3-to-4.md` |
| "useState не работает в SSR" | Load `troubleshooting.md` SSR state section |
| "useFetch vs useAsyncData vs $fetch" | Load `data-fetching.md` decision table |
| "routeRules для ISR / SWR" | Load `recommended-defaults.md` routeRules section |
| "definePageMeta middleware auth guard" | Load `app-directory-layout.md`; cite `app/middleware/auth.ts` |

## Negative — should NOT activate (10)

| User-voice prompt | Should route to | Why |
|---|---|---|
| "ref vs reactive в Vue" | `vue` | Pure Vue reactivity |
| "Next.js Server Action" | `nextjs` | Different framework |
| "Astro Islands" | `astro` | Different framework |
| "TS conditional types" | `typescript` | Type system |
| "Tailwind dark mode" | `tailwind` | Pure styling |
| "Vitest mock module" | `vitest` | Test runner |
| "Pinia store без Nuxt" | `vue` / pinia | Standalone Vue |
| "zod discriminatedUnion" | `zod` | Validation library |
| "Playwright trace viewer" | `playwright` | E2E only |
| "Express middleware" | `nodejs` | Different framework |

## Edge cases — 5

| User-voice prompt | Resolution |
|---|---|
| "Vue компонент в Nuxt — defineProps" | **vue** primary (component API) + cross-link `nuxt` if SSR-specific |
| "h3 без Nuxt" | **nodejs** primary (Nitro/h3 standalone) + cross-link `nuxt` if user is in Nuxt |
| "Nuxt UI Card компонент" | **nuxt** primary (Nuxt UI is the official module) + cross-link `tailwind` for theming |
| "useFetch с TanStack Query" | **nuxt** primary (`useFetch` is Nuxt's native fetcher); if user explicitly wants TQ, cross-link `tanstack-query` |
| "SSG vs SSR — что выбрать для Nuxt" | **nuxt** primary (`deployment.md` covers preset trade-offs) |

## How to verify (manual)

1. Open a fresh session with this skill loaded in `~/.claude/skills/nuxt/`.
2. Paste each Positive → confirm system reminder lists `nuxt` and response cites the expected files.
3. Paste each Negative → confirm `nuxt` does NOT appear and fallback is mentioned.
4. Edge: confirm cross-link is called out explicitly.

If wrong: Negative→Positive tightens SKIP rules; Positive→Negative adds missing trigger to description; edge to one skill needs Related Skills enrichment.
