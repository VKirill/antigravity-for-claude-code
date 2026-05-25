# astro — Eval Cases

v3 format: **user-voice phrasing** + **Expected behavior** column (which sub-files / templates should load, not just "skill activates").

## Positive — should activate (10)

| User-voice prompt | Expected behavior |
|---|---|
| "Astro 6 проект с tailwind 4 и react islands" | Load `integrations.md` + `templates/astro.config.mjs.template`; cite `@tailwindcss/vite` (NOT `@astrojs/tailwind` v3) + `react()` integration |
| "content collections с глобом для блога" | Load `content-collections.md` + `templates/content.config.ts.template`; cite `defineCollection` + `glob({ pattern, base })` loader + Zod schema |
| "Server Island с server:defer для персонализации" | Load `server-islands-and-actions.md` + `examples/server-island-with-actions.md`; cite `output: 'server'` + adapter requirement |
| "Astro Action с Zod валидацией формы" | Load `server-islands-and-actions.md` + `examples/server-island-with-actions.md`; cite `defineAction({ accept: 'form', input, handler })` + `Astro.getActionResult` |
| "client:visible vs client:load — что выбрать" | Load `islands-architecture.md`; cite default below-the-fold = `client:visible`, sparingly `client:load` |
| "View Transitions ClientRouter в layout" | Load `view-transitions.md`; cite `<ClientRouter />` (renamed from `<ViewTransitions />`), `transition:name`, `transition:animate` |
| "deploy на Cloudflare Pages" | Load `deploy-adapters.md`; cite `@astrojs/cloudflare` adapter + `output: 'server'` (or per-page prerender) |
| "Image оптимизация в Astro" | Load `performance.md`; cite `<Image src={...} />` from `astro:assets` + sharp service in Node, compile in static |
| "dynamic routes [slug].astro c getStaticPaths" | Load `routing.md`; cite signature `export async function getStaticPaths()` + `params`/`props` shape |
| "RSS feed для блог-коллекции" | Load `integrations.md`; cite `@astrojs/rss` + `getCollection` source pattern |

## Negative — should NOT activate (10)

| User-voice prompt | Should route to | Why |
|---|---|---|
| "Next.js App Router server actions" | `nextjs` | Different framework |
| "Nuxt 4 useFetch SSR" | `nuxt` | Different framework |
| "React Native Expo router" | (no skill — react-native cascade) | Mobile-native |
| "Vue 3 composition api SFC" | `vue` | Vue without Astro |
| "Vite plugin authoring" | `vite` | Build-tool-level concern |
| "Tailwind 4 oklch палитра" | `tailwind` | Pure Tailwind, no Astro |
| "Cloudflare Worker без фреймворка" | (no skill) | Edge runtime direct |
| "Gatsby GraphQL schema" | (no skill) | Different SSG |
| "Hugo theme template" | (no skill) | Go SSG |
| "WordPress headless CMS" | (no skill — cascade) | CMS-only |

## Edge cases — 5

| User-voice prompt | Resolution |
|---|---|
| "Astro + React islands — где state хранить" | **astro** primary (`islands-architecture.md`) + `react` cross-link. Islands are isolated; cross-island state via signals/nanostores or URL/query. |
| "Astro DB sunset — куда мигрировать" | **astro** primary; flag SKILL.md Important Constraints — `@astrojs/db` hosted service ended. Recommend self-host libsql/Turso or `prisma` + `postgresql`. |
| "Tailwind 3 → 4 в Astro проекте" | **astro** primary + `tailwind` cross-link. Replace `@astrojs/tailwind` integration with `@tailwindcss/vite` plugin in `vite.plugins`. |
| "MDX vs Markdoc для контента" | **astro** primary (`integrations.md`); MDX is `@astrojs/mdx`, Markdoc is `@astrojs/markdoc`. Tradeoff: MDX inlines components, Markdoc enforces schema. |
| "Astro vs Next.js — что выбрать" | Ambiguous; surface tradeoffs from SKILL.md Purpose (content-first vs full-stack-state). For content/marketing → Astro; for app-shell with rich client state → Next. |

## How to verify (manual)

1. Open a fresh session with this skill in `~/.claude/skills/astro/`.
2. Paste each Positive prompt → confirm:
   - The system reminder lists `astro` as an active skill
   - The response references files matching the "Expected behavior" column
3. Paste each Negative prompt → confirm `astro` does NOT appear in the routed skill response, and the suggested fallback skill is mentioned.
4. Edge cases: confirm response surfaces cross-link explicitly ("primary: astro, see also: react/tailwind/prisma").

If a prompt routes wrong:
- Negative becoming Positive → tighten the `description` SKIP rules
- Positive becoming Negative → add the missing trigger term to `description`
- Edge routing only to one skill → enrich Related Skills cross-links

Run after any change to `SKILL.md` description or major reference restructure.
