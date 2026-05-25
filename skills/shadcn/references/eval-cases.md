# shadcn — Eval Cases

v3 format: user-voice phrasing + Expected behavior + How to verify.

## Positive — should activate (10)

| User-voice prompt | Expected behavior |
|---|---|
| "npx shadcn init выдаёт ошибку Tailwind v4" | Load `setup-and-cli.md`; troubleshooting init for Tailwind 4 |
| "components.json для monorepo — где aliases" | Load `setup-and-cli.md`; aliases/path resolution section |
| "dark mode с CSS variables в shadcn" | Load `theming.md`; `.dark` class strategy |
| "Form + React Hook Form + Zod в shadcn" | Load `form-integration.md` + `examples/form-with-rhf-zod.md` |
| "asChild на Button — рендер как Link" | Load `popular-components.md`; `@radix-ui/react-slot` pattern |
| "Combobox с поиском" | Load `popular-components.md` Combobox section |
| "DataTable + TanStack Table + сортировка" | Load `examples/build-data-table.md` |
| "новый кастомный registry для design system" | Load `custom-registry.md` |
| "cn() helper и tailwind-merge" | Load `popular-components.md` or `setup-and-cli.md` utils section |
| "kak добавить sonner toast" | Load `popular-components.md` Sonner section |

## Negative — should NOT activate (10)

| User-voice prompt | Should route to | Why |
|---|---|---|
| "Material UI button" | (no skill) | Different paradigm |
| "Mantine theme" | (no skill) | Different library |
| "DaisyUI компоненты" | `tailwind` | CSS-class-only paradigm |
| "Headless UI tabs" | (Vue / no skill) | Different ecosystem |
| "Tailwind без компонентов" | `tailwind` | Pure styling |
| "RHF Controller без shadcn" | `react-hook-form` | Library-only |
| "zod schema" | `zod` | Validation only |
| "useState в React" | `react` | Pure hook |
| "Radix focus management без shadcn" | (no skill) | Pure Radix |
| "React Native button styling" | (no skill) | shadcn is web-only |

## Edge cases — 5

| User-voice prompt | Resolution |
|---|---|
| "accessible form components" | If shadcn imports already present → **shadcn**; otherwise ambiguous — ask |
| "toast notification — какой выбрать" | If shadcn project → **shadcn** (Sonner); otherwise architectural — surface options |
| "data table в Next.js" | **shadcn** primary if shadcn project (TanStack Table integration); cross-link `nextjs` for RSC patterns |
| "cn() помощник" | **shadcn** primary if shadcn project; otherwise just tailwind-merge+clsx → `tailwind` |
| "themable React app" | If shadcn → **shadcn** (CSS vars); else `tailwind` |

## How to verify (manual)

1. Open a fresh session with `shadcn` loaded.
2. Paste each Positive → confirm system reminder lists `shadcn` and response cites the expected files.
3. Paste each Negative → confirm `shadcn` does NOT appear and fallback is mentioned.
4. Edge: confirm cross-link is called out explicitly.

If wrong: Negative→Positive tightens SKIP rules; Positive→Negative adds missing trigger; edge to one skill needs Related Skills enrichment.
