# react-hook-form — Eval Cases

v3 format: user-voice phrasing + Expected behavior + How to verify.

## Positive — should activate (10)

| User-voice prompt | Expected behavior |
|---|---|
| "useForm + Zod валидация — как настроить" | Load `zod-resolver.md` + `templates/form-component.tsx.template` |
| "Controller + shadcn Select" | Load `controller-and-context.md`; Controller render pattern |
| "useFieldArray append/remove строк" | Load `field-array.md`; `field.id` key warning |
| "setError merge server validation errors" | Load `server-validation.md` + `examples/server-error-merge.md` |
| "isSubmitting не сбрасывается" | Load `troubleshooting.md` async handler section |
| "multi-step form — validate шаг 1 перед next" | Load `multi-step-forms.md` `trigger(['fields'])` pattern |
| "useWatch vs watch — что выбрать" | Load `basics-register.md` subscription section |
| "controlled/uncontrolled warning при defaultValues undefined" | Load `troubleshooting.md` defaultValues section |
| "register vs Controller для custom input" | Load `controller-and-context.md` decision section |
| "mode onBlur vs onChange vs onSubmit" | Load `recommended-defaults.md` mode table |

## Negative — should NOT activate (10)

| User-voice prompt | Should route to | Why |
|---|---|---|
| "Formik field array" | (formik / no skill) | Different library |
| "TanStack Form" | (no skill) | Different library |
| "plain HTML form" | `react` | No library |
| "zod discriminated union без формы" | `zod` | Pure schema |
| "useState controlled input" | `react` | No RHF |
| "shadcn button theming" | `shadcn` | UI only |
| "Next.js Server Action без RHF" | `nextjs` | Server Actions |
| "TS generic constraint" | `typescript` | Type system |
| "Tailwind form styling" | `tailwind` | Styling |
| "Vitest mock useForm" | `vitest` | Test runner |

## Edge cases — 5

| User-voice prompt | Resolution |
|---|---|
| "form validation в React" | Ambiguous — if no library mentioned, load `react` + this; both not harmful |
| "shadcn Form компонент" | shadcn's Form is RHF-based — load both `shadcn` + this |
| "yup resolver" | This skill (RHF) — point to `@hookform/resolvers/yup`; canonical path is `zodResolver` |
| "useMutation + handleSubmit" | this + `tanstack-query` — both relevant |
| "Next.js form + zodResolver" | this + `nextjs` — both relevant; Server Action may replace `handleSubmit` |

## How to verify (manual)

1. Open a fresh session with `react-hook-form` loaded.
2. Paste each Positive → confirm system reminder includes `react-hook-form` and response cites the expected files.
3. Paste each Negative → confirm `react-hook-form` does NOT appear and fallback is mentioned.
4. Edge: confirm cross-link is called out explicitly.

If wrong: Negative→Positive tightens SKIP rules; Positive→Negative adds missing trigger; edge to one skill needs Related Skills enrichment.
