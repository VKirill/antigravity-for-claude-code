---
name: i18n
description: "Web app internationalization — next-intl (Next.js/React) and vue-i18n (Nuxt/Vue). Use when: i18n, internationalization, translation, locale, next-intl, vue-i18n, i18next, multilingual, language switcher, ICU, hreflang, plural, getTranslations, useTranslations, useI18n, createI18n, locale routing, Crowdin, Lokalise, Tolgee. SKIP: single-locale app, raw Intl.* without library, simple lang toggle."
stacks:
  - next-intl
  - vue-i18n
  - typescript
packages:
  - next-intl
  - vue-i18n
  - "@nuxtjs/i18n"
manifests:
  - i18n.config.ts
  - next-intl.config.ts
  - messages/
  - locales/
tags:
  - i18n
  - localization
  - translation
  - internationalization
source: generated-zero-baseline
risk: medium-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- next-intl: `4.12.x`
- vue-i18n: `11.4.x`
- TypeScript: `6.0.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->


## Usage

Loaded automatically when its description matches the active task. Detect the framework first (Next.js vs Nuxt/Vue), then open the matching reference. Read only the section you need.

## Use this skill when

- Adding a second language to a Next.js or Nuxt app for the first time
- Picking between next-intl, vue-i18n and `@nuxtjs/i18n` for a greenfield project
- Wiring locale-prefixed routing (`/en/...`, `/de/...`) with hreflang and sitemap
- Writing ICU-format messages with plurals, gender, dates, numbers, currency
- Switching between Server Components and Client Components for translations in App Router
- Lazy-loading locale messages to reduce bundle size
- Building a locale switcher that preserves the current path and query
- Integrating a translation management platform (Crowdin, Lokalise, Phrase, Tolgee)
- Debugging hydration mismatches, missing keys, fallback locale, or build-time message validation errors

## Do not use this skill when

- Single-locale app — adding `lang="en"` to `<html>` is enough; no library needed
- Server-only string translation utility unrelated to a UI framework
- Pure `Intl.DateTimeFormat` / `Intl.NumberFormat` usage without message catalogs → standard `Intl` API docs
- React Native or Flutter localization → mobile-specific stacks (`react-native`, `flutter`)
- Backend-only API responses with `Accept-Language` content negotiation and no UI catalog
- Astro content collections without runtime locale switching → `astro` content config

## Purpose

Internationalization spans framework, routing, message format, build pipeline, SEO, and translator workflow. A framework-only skill misses the cross-cutting decisions: which library to pick, how to map ICU plurals to JSON, when to lazy-load messages, how to wire hreflang correctly. This skill is the single navigator for the i18n surface across our React/Next.js and Vue/Nuxt projects.

The two pinned libraries cover ~95% of our work: **next-intl** for Next.js App Router (Server Components first-class, ICU built-in, type-safe keys) and **vue-i18n** for Vue/Nuxt (Composition API, `useI18n`, Nuxt module). The remaining 5% (i18next, FormatJS, lingui) is referenced only when a project already uses them. Hands off to framework skills (`nextjs`, `nuxt`, `react`, `vue`) for non-i18n concerns.

## Capabilities

Each capability below points to the canonical reference file. References own the code, edge cases, and gotchas — do not duplicate them here.

### Library decision and framework routing

Map task → library: Next.js App Router → next-intl. Nuxt → `@nuxtjs/i18n` (wraps vue-i18n). Plain Vue SPA → vue-i18n directly. Decision table with tradeoffs and when to escape to i18next. → [references/REFERENCE.md](references/REFERENCE.md)

### next-intl integration (Next.js 16 App Router)

`defineRouting` + `createMiddleware`, `[locale]` segment, `setRequestLocale` for static rendering, `getTranslations` in async Server Components, `useTranslations` in Client Components, `NextIntlClientProvider`, localized `Link`/navigation, `pathnames` for translated URLs. → [references/next-intl.md](references/next-intl.md)

### vue-i18n integration (Vue 3.5 + Nuxt 4)

`createI18n` with Composition mode (default in v11+), `useI18n` composable, `t/n/d` for messages/numbers/dates, `Composer` instance, global vs local scope, SFC `<i18n>` blocks. Nuxt module `@nuxtjs/i18n` vs raw vue-i18n — when to use which. → [references/vue-i18n.md](references/vue-i18n.md)

### Translation file structure

JSON vs YAML, namespace organization (by feature vs by page), ICU message format (plural, select, ordinal), date/number/currency formatters, nested keys vs flat keys, type generation from message files. → [references/translation-files.md](references/translation-files.md)

### SEO and routing

Locale-prefixed URLs (`prefix`, `prefix_except_default`, `as-needed`), `hreflang` tags, alternate links, canonical URLs, `sitemap.xml` per-locale, `robots.txt`, default-locale strategies, redirect behavior on root. → [references/seo-and-routing.md](references/seo-and-routing.md)

### Dynamic and runtime patterns

Lazy locale loading with dynamic imports, code-splitting per-locale, RSC vs Client boundary decisions, locale switcher that preserves path+query, programmatic locale change, browser language detection, cookie persistence. → [references/dynamic-and-runtime.md](references/dynamic-and-runtime.md)

### Translation management platforms

Crowdin, Lokalise, Phrase, Tolgee — popularity-filtered 2026 options. Push/pull workflows, in-context editing, machine translation, version control integration. → [references/translation-management.md](references/translation-management.md)

### Troubleshooting

Hydration mismatches, missing keys, fallback locale chain, ICU syntax errors, build-time vs runtime errors, type-safe key inference failures, SSR locale leakage, `setRequestLocale` ordering bugs. → [references/troubleshooting.md](references/troubleshooting.md)

### Routing evaluation

When to load this skill vs framework-specific skill — eval cases (positive, negative, edge). → [references/eval-cases.md](references/eval-cases.md)

## Behavioral Traits

- Detects the framework before recommending a library — Next.js → next-intl, Nuxt → `@nuxtjs/i18n`, raw Vue → vue-i18n, anything else → ask
- Keeps message catalogs out of components — never hardcodes user-visible strings inline
- Validates ICU syntax mentally before suggesting a plural/select message; offers the minimal form
- Prefers `getTranslations` (async) in Server Components, `useTranslations` (hook) only in Client Components
- For vue-i18n always uses Composition mode (`legacy: false` is implicit in v11+) and `useI18n()`
- Treats locale as routing state, not application state — derived from URL, not React/Vue store
- Splits messages by namespace (page or feature), not one mega-file per locale
- Lazy-loads non-default locales when bundle size matters
- Asks about translation management workflow (Git-only vs SaaS platform) before scaffolding

## Important Constraints

- NEVER hardcode user-visible strings in components — every UI string goes through `t()` / `useTranslations` / `useI18n`
- NEVER mix locale routing strategies in one app (`prefix` and `prefix_except_default` simultaneously)
- NEVER ship vue-i18n in **legacy mode** for new projects — Composition mode is the only mode in v11+
- NEVER call `setRequestLocale` after a next-intl hook — it must run first in the layout
- NEVER ship a single mega-locale JSON file >500 KB without lazy loading — split by namespace
- NEVER store locale only in cookie/localStorage — URL is the source of truth for SEO + sharing
- ALWAYS render `hreflang` and `lang` attributes for SEO crawlability
- ALWAYS validate ICU message syntax at build time (next-intl does this; vue-i18n needs `@intlify/unplugin-vue-i18n`)
- ALWAYS provide a fallback locale and confirm fallback chain on missing keys
- ALWAYS use `formatMessage` / `t` for plurals — never write `${count} ${count === 1 ? 'item' : 'items'}` in JSX

## Related Skills

### Frameworks (host)
- `nextjs` — Next.js 16 App Router internals; next-intl plugs into its routing/RSC model
- `nuxt` — Nuxt 4 file routing and modules; `@nuxtjs/i18n` is a Nuxt module
- `react` — React 19 component patterns referenced by next-intl client integration
- `vue` — Vue 3.5 Composition API and reactivity referenced by vue-i18n
- `astro` — Astro 6 content collections; Astro has its own i18n routing (`astro:i18n`) — out of scope here

### Adjacent
- `typescript` — type-safe message keys, branded locale types, schema inference

## API Reference

Domain-specific references (Pattern 2) — load only what's relevant:

| Topic | File |
|---|---|
| Decision map: next-intl vs vue-i18n by framework, shared concepts, escape hatches | [references/REFERENCE.md](references/REFERENCE.md) |
| next-intl in Next.js 16 App Router — routing, middleware, server/client components, ICU | [references/next-intl.md](references/next-intl.md) |
| vue-i18n + Nuxt 4 — `createI18n`, `useI18n`, Nuxt module, lazy locales, SSR | [references/vue-i18n.md](references/vue-i18n.md) |
| Translation file structure — JSON/YAML, namespaces, ICU, plurals, formatters | [references/translation-files.md](references/translation-files.md) |
| SEO and routing — locale prefixes, hreflang, sitemap, canonical, redirects | [references/seo-and-routing.md](references/seo-and-routing.md) |
| Dynamic and runtime — lazy loading, code-splitting, locale switcher, RSC vs client | [references/dynamic-and-runtime.md](references/dynamic-and-runtime.md) |
| Translation management — Crowdin, Lokalise, Phrase, Tolgee comparison + workflows | [references/translation-management.md](references/translation-management.md) |
| Troubleshooting — hydration mismatches, missing keys, fallback, ICU errors, type-safety | [references/troubleshooting.md](references/troubleshooting.md) |
| Eval cases — routing prompts (positive/negative/edge) for skill activation | [references/eval-cases.md](references/eval-cases.md) |

**How to use**: pick the framework (Next.js → `next-intl.md`, Nuxt/Vue → `vue-i18n.md`), then read cross-cutting files (`translation-files.md`, `seo-and-routing.md`) as needed.
