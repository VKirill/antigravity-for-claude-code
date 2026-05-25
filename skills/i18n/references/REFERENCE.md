# i18n — Decision Map

Slim index for picking the right reference file. Read this first when starting an i18n task.

## Which library?

| Framework / context | Library | Reference |
|---|---|---|
| Next.js 16 App Router | **next-intl** | [next-intl.md](next-intl.md) |
| Next.js Pages Router (legacy) | next-intl (or `next-i18next` for true legacy) | [next-intl.md](next-intl.md) |
| Nuxt 4 | **@nuxtjs/i18n** (wraps vue-i18n) | [vue-i18n.md](vue-i18n.md) |
| Vue 3.5 SPA (no Nuxt) | **vue-i18n** directly | [vue-i18n.md](vue-i18n.md) |
| Astro | `astro:i18n` (built-in) — out of scope, see `astro` skill | — |
| React SPA (no Next.js) | next-intl works standalone, or i18next | [next-intl.md](next-intl.md) standalone section |
| React Native | `react-native-localize` + i18next — out of scope | — |
| Backend-only (Node API) | `Intl.*` directly or i18next-node | — |

## Decision: next-intl vs vue-i18n by feature

| Feature | next-intl | vue-i18n |
|---|---|---|
| Default API | ICU MessageFormat | Custom syntax (`{name}`) + ICU via plugin |
| Server Components | First-class (`getTranslations`) | N/A (Vue/Nuxt SSR uses `useI18n` everywhere) |
| Type safety | Auto-infer from JSON, build-time check | Manual schema typing or `@intlify/unplugin-vue-i18n` |
| Routing | `defineRouting` + middleware | `@nuxtjs/i18n` module |
| Lazy loading | Per-locale via dynamic `import` | Built-in via `lazy` option |
| Localized pathnames | Yes (`pathnames` config) | Yes (`pages` config in Nuxt module) |
| Standalone (no framework) | Yes (Pages Router, Remix, SPA) | Yes |

## Shared concepts (framework-agnostic)

These live in cross-cutting reference files:

| Concept | File |
|---|---|
| JSON/YAML structure, namespaces, ICU plurals, formatters | [translation-files.md](translation-files.md) |
| `hreflang`, sitemap, canonical, locale-prefix strategies | [seo-and-routing.md](seo-and-routing.md) |
| Lazy loading, code-splitting, locale switcher, RSC vs Client | [dynamic-and-runtime.md](dynamic-and-runtime.md) |
| Crowdin / Lokalise / Phrase / Tolgee | [translation-management.md](translation-management.md) |
| Hydration, missing keys, fallback, type errors | [troubleshooting.md](troubleshooting.md) |

## Escape hatches — when to leave both libraries

Use **i18next** (or `next-i18next`) only if:
- Existing codebase already on i18next — don't rewrite
- Need React Native + web shared catalog with `react-i18next`
- Need namespace plugin ecosystem (e.g. `i18next-icu`, `i18next-resources-to-backend`)

Use **FormatJS / react-intl** only if:
- Existing codebase already on FormatJS
- Need extracted message IDs with `babel-plugin-formatjs`

Use **Lingui** only if:
- Existing codebase, or strong preference for macros and gettext-style extraction

For new projects: stick with next-intl (Next.js/React) or vue-i18n (Vue/Nuxt).

## Quick task → file map

| Task | Read |
|---|---|
| "add Russian to my Next.js site" | next-intl.md (setup), translation-files.md (structure), seo-and-routing.md (hreflang) |
| "language switcher that keeps the path" | dynamic-and-runtime.md (locale switcher pattern) |
| "plural rule for Russian (1/2-4/5+)" | translation-files.md (ICU plural), troubleshooting.md (Russian rule) |
| "hreflang missing in Google Search Console" | seo-and-routing.md (hreflang section) |
| "translations not appearing after locale change" | troubleshooting.md (hydration + fallback) |
| "split locale JSON, lazy load on route" | dynamic-and-runtime.md (lazy + code-splitting) |
| "push translations to Crowdin from CI" | translation-management.md |
| "should I load this skill or the nextjs skill" | eval-cases.md |

## File size policy

All reference files are kept under 500 lines per Pattern 2. If a file grows beyond, split by sub-domain (e.g., `next-intl-routing.md` + `next-intl-rsc.md`).
