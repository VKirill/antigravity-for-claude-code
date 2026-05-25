# tailwind — Eval Cases

v3 format: **user-voice phrasing** + **Expected behavior** column (which sub-files / templates should load, not just "skill activates").

## Positive — should activate (10)

| User-voice prompt | Expected behavior |
|---|---|
| "поставь tailwind 4 в vite проект" | Load `config-css-first.md` + `templates/globals.css`; cite `@tailwindcss/vite` plugin + `@import "tailwindcss";` entry |
| "сделай бренд палитру в oklch, 50-950" | Load `theme-and-tokens.md`; cite oklch scale pattern in `@theme {}` |
| "dark mode в tailwind 4 не работает" | Load `variants.md` + `theme-and-tokens.md`; cite `@custom-variant dark (&:where(.dark, .dark *))` (NOT `@variant dark`) |
| "container queries без плагина" | Load `container-queries.md`; cite native `@container` + `@sm:`/`@lg:` (no `@tailwindcss/container-queries` plugin in v4) |
| "мигрируй tailwind.config.js в tailwind 4" | Load `migration-3-to-4.md`; emphasize CSS-first `@theme`, NO config.js, `darkMode: 'class'` → `@custom-variant dark` |
| "@theme c кастомными fonts и radius" | Load `config-css-first.md`; cite `--font-display`, `--radius-card` token naming |
| "tailwind-merge не дедупит class" | Load `integration-with-react.md`; cite `cn() = twMerge(clsx(...))` order + classGroups for project specifics |
| "has-[:checked]: на родителе" | Load `variants.md` has-* section; cite stacking right-to-left |
| "prose class для блога" | Cite `@tailwindcss/typography` plugin; load `theme-and-tokens.md` typography section |
| "starting: animation для появления модалки" | Load `variants.md`; cite `@starting-style` CSS WG draft + `starting:` prefix |

## Negative — should NOT activate (10)

| User-voice prompt | Should route to | Why |
|---|---|---|
| "styled-components theme provider" | `react` | CSS-in-JS, not Tailwind |
| "UnoCSS preset config" | (no skill) | Different engine |
| "Emotion ssr setup" | `react` | CSS-in-JS |
| "vanilla-extract sprinkles" | (no skill) | Different paradigm |
| "Bootstrap 6 grid" | (no skill) | Different framework |
| "CSS Grid template-areas" | (no skill — general CSS) | Vanilla CSS, no Tailwind |
| "Sass mixin для responsive" | (no skill) | Sass-only |
| "Panda CSS recipes" | (no skill) | Different engine |
| "Windi CSS shortcuts" | (no skill) | Different framework |
| "PostCSS plugin authoring" | (no skill — niche) | PostCSS internals, not Tailwind |

## Edge cases — 5

| User-voice prompt | Resolution |
|---|---|
| "tailwind в astro проекте" | **tailwind** primary (`integration-with-react.md` adapter section) + `astro` cross-link. Use `@tailwindcss/vite` via Astro Vite config (NOT legacy `@astrojs/tailwind` integration). |
| "shadcn/ui themes c oklch" | **tailwind** primary (`theme-and-tokens.md` semantic aliases) + `shadcn` cross-link. shadcn reads `@theme` vars from `globals.css`. |
| "Tailwind 3 → 4 апгрейд большого проекта" | **tailwind** primary (`migration-3-to-4.md` full guide). Emphasize: dark mode syntax breaking change (`@variant` → `@custom-variant`), config.js sunset. |
| "Tailwind с CSS modules вместе" | **tailwind** primary; flag tradeoff — can coexist but Tailwind utility classes lose CSS-modules scoping. Surface from `config-css-first.md`. |
| "JIT mode в Tailwind 4" | **tailwind** primary; flag concept-obsolete: v4 is JIT-only, no AOT/Purge distinction. Cite `config-css-first.md` overview. |

## How to verify (manual)

1. Open a fresh session with this skill in `~/.claude/skills/tailwind/`.
2. Paste each Positive prompt → confirm:
   - The system reminder lists `tailwind` as an active skill
   - The response references files matching the "Expected behavior" column
3. Paste each Negative prompt → confirm `tailwind` does NOT appear in the routed skill response, and the suggested fallback skill is mentioned.
4. Edge cases: confirm response surfaces cross-link explicitly ("primary: tailwind, see also: astro/shadcn").

If a prompt routes wrong:
- Negative becoming Positive → tighten the `description` SKIP rules
- Positive becoming Negative → add the missing trigger term to `description`
- Edge routing only to one skill → enrich Related Skills cross-links

Run after any change to `SKILL.md` description or major reference restructure.
