# Changelog — i18n

## v1.0.0 — initial release

- Pattern 2 layout with 9 references covering next-intl and vue-i18n
- `SKILL.md` navigator with framework-routing description (next-intl, vue-i18n, i18next trigger terms; SKIP rules for single-locale apps)
- References:
  - `REFERENCE.md` — decision map (framework → library, shared concepts)
  - `next-intl.md` — Next.js 16 App Router integration (defineRouting, middleware, setRequestLocale, getTranslations, useTranslations, NextIntlClientProvider, localized pathnames)
  - `vue-i18n.md` — Vue 3.5 + Nuxt 4 integration (createI18n Composition mode, useI18n, @nuxtjs/i18n module, lazy locales, SSR)
  - `translation-files.md` — JSON/YAML, namespaces, ICU plurals/select/ordinal, formatters
  - `seo-and-routing.md` — locale-prefix strategies, hreflang, sitemap, canonical, RTL, redirects
  - `dynamic-and-runtime.md` — lazy loading, code-splitting, locale switcher, RSC vs Client, browser detection
  - `translation-management.md` — Crowdin, Lokalise, Phrase, Tolgee (popularity-filtered 2026)
  - `troubleshooting.md` — hydration, missing keys, Russian plural for vue-i18n, setRequestLocale ordering, ICU syntax, type safety, SSR locale leakage
  - `eval-cases.md` — 10 positive, 10 negative, 5 edge cases for routing verification
- Cross-checked against Context7 docs for next-intl (defineRouting, createMiddleware, setRequestLocale, getTranslations signatures) and vue-i18n (createI18n Composition default, useI18n, pluralizationRules, lazy import pattern)
- No hardcoded version numbers in body (version block is sync-script owned)
- Stacks: next-intl, vue-i18n, typescript — registered for inclusion in `sync_skill_versions.py` by main agent
