# i18n — Eval Cases

v3 format: **user-voice phrasing** (Russian/typos/incomplete welcome) + **Expected behavior** column (which sub-files / templates should load).

This skill is cross-cutting — many prompts also route to `nextjs` or `nuxt`. The eval verifies that i18n wins when the question is about translation/locale and defers to framework skills when the question is about routing/data fetching with no i18n angle.

## Positive — should activate (10)

| User-voice prompt | Expected behavior |
|---|---|
| "добавить русский язык в next.js проект" | Load `next-intl.md` setup + `seo-and-routing.md` for hreflang |
| "next-intl middleware setup app router" | Load `next-intl.md` middleware section |
| "vue-i18n composition api useI18n" | Load `vue-i18n.md` Path A composition section |
| "nuxt i18n module strategy prefix_except_default" | Load `vue-i18n.md` Nuxt section + `seo-and-routing.md` strategies |
| "ICU plural для русского — one few many" | Load `translation-files.md` Russian plural + `troubleshooting.md` vue-i18n custom rule |
| "language switcher preserving path and query" | Load `dynamic-and-runtime.md` locale switcher section |
| "hreflang не отображается в google search console" | Load `seo-and-routing.md` hreflang + `troubleshooting.md` checklist |
| "lazy load locales next-intl getRequestConfig" | Load `dynamic-and-runtime.md` lazy section |
| "Crowdin push pull в CI для переводов" | Load `translation-management.md` Crowdin section |
| "hydration mismatch after switching locale" | Load `troubleshooting.md` hydration section + `next-intl.md` setRequestLocale |

## Negative — should NOT activate (10)

| User-voice prompt | Should route to | Why |
|---|---|---|
| "next.js app router data fetching" | `nextjs` | Pure Next.js, no i18n |
| "vue composition api ref reactive" | `vue` | Pure Vue, no translation |
| "nuxt useFetch with auth" | `nuxt` | Data fetching, no locale |
| "useState in react component" | `react` | Pure React hook |
| "tailwind dark mode strategy" | `tailwind` | Styling |
| "prisma schema migrate" | `prisma` | ORM |
| "postgresql index on jsonb" | `postgresql` | DB |
| "playwright e2e test for login" | `playwright` | Testing |
| "zod schema for env vars" | `zod` | Validation |
| "tanstack query refetch on focus" | `tanstack-query` | Data fetching |

## Edge cases — 5

| User-voice prompt | Resolution |
|---|---|
| "локализованные URL `/about` → `/o-nas`" | **i18n** primary (`next-intl.md` pathnames or `vue-i18n.md` Nuxt `pages` config); cross-link `nextjs`/`nuxt` for routing internals |
| "sitemap для мультиязычного сайта" | **i18n** primary (`seo-and-routing.md` sitemap per locale); cross-link `nextjs` (`sitemap.ts` mechanics) |
| "формат даты и валюты per-locale" | **i18n** primary (`translation-files.md` formatters); pure `Intl.*` without library only if user explicit |
| "RTL поддержка для арабского" | **i18n** primary (`seo-and-routing.md` RTL section + `troubleshooting.md` dir=rtl); cross-link `tailwind` for CSS logical properties |
| "translations from CMS vs JSON file" | **i18n** primary (`translation-files.md` + `dynamic-and-runtime.md` runtime loading); cross-link CMS skill if applicable |

## How to verify (manual)

1. Open a fresh session with this skill in `~/.claude/skills/i18n/`
2. Paste each Positive prompt → confirm:
   - System reminder lists `i18n` as active
   - Response references files matching "Expected behavior"
3. Paste each Negative prompt → confirm `i18n` does NOT appear and the right fallback skill is mentioned
4. Edge cases: confirm response calls out the cross-link explicitly ("primary: i18n, see also: nextjs/nuxt/...")

If routing is wrong:
- Negative becoming Positive → tighten `description` SKIP rules (add more counter-triggers)
- Positive becoming Negative → add missing trigger term to `description` (e.g., specific platform name)
- Edge cases routing to only one skill → enrich `## Related Skills` cross-links

Run after any change to `SKILL.md` description or major reference restructure.
