---
name: react-hook-form
description: "React Hook Form v7 — performant forms via uncontrolled inputs, Zod validation. Use when: react-hook-form, RHF, useForm, register, handleSubmit, watch, setValue, getValues, formState, Controller, FormProvider, useFieldArray, zodResolver, @hookform/resolvers, multi-step form, dynamic fields, async validation, defaultValues, error display. SKIP: Formik, TanStack Form, vanilla uncontrolled forms."
stacks:
  - react
  - frontend
packages:
  - react-hook-form
  - "@hookform/resolvers"
  - zod
tags:
  - react
  - forms
  - validation
  - zod
  - typescript
  - shadcn
source: generated-v1.0.0
risk: medium-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- React Hook Form: `7.x`
- React: `19.x`
- TypeScript: `6.0.x`
- Zod: `4.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->

## Usage

Loaded automatically when its description matches the active task. Read only the section you need, then follow the link to the relevant reference file for full detail.

## Use this skill when

- Building any form with `useForm`, `register`, `handleSubmit`, or `Controller`
- Integrating RHF with Zod via `@hookform/resolvers/zod` for schema-based validation
- Setting up `useFieldArray` for dynamic lists (add/remove/reorder fields at runtime)
- Using `FormProvider` + `useFormContext` to share form state in deeply nested components
- Implementing multi-step forms with partial schemas and inter-step state
- Merging server-side validation errors (e.g., API 422 responses) into `formState.errors`
- Integrating RHF with shadcn/ui `Form`, `FormField`, `FormItem`, `FormMessage` primitives
- Wiring RHF with TanStack Query `useMutation` for async form submission
- Debugging `formState.isDirty`, `isValid`, `isSubmitting`, `isSubmitSuccessful`
- Handling conditional fields that appear/disappear based on other field values
- Implementing async validation (debounced uniqueness checks, server lookups)
- Resetting forms after submission, including partial reset and `defaultValues`

## Do not use this skill when

- Building forms with Formik — different library, different mental model
- Using TanStack Form (react-form) — different API, not RHF
- Working with plain uncontrolled HTML forms without any form library
- Task is Zod schema design only (no form context) — use `zod` skill
- Task is pure React state management without form submission — use `react` skill
- Task is shadcn/ui component theming only — use `shadcn` skill

## Purpose

React Hook Form v7 achieves form performance through uncontrolled inputs: fields read their value from the DOM at submit time rather than re-rendering on every keystroke. This makes RHF substantially faster than controlled approaches (Formik, Redux Form) in forms with many fields, especially when using `watch` selectively. The skill covers the complete RHF production lifecycle: schema setup, register API, Controller for third-party inputs, field arrays, multi-step orchestration, and server error injection.

The primary integration target is Zod v4 via `@hookform/resolvers/zod` — schema inference eliminates duplicate type declarations. For UI, the shadcn/ui `Form` component wraps RHF's context cleanly. TanStack Query mutations compose naturally with `handleSubmit`.

## Capabilities

### useForm Setup and Modes

`useForm<TSchema>({ resolver: zodResolver(schema), defaultValues, mode })` is the root call. Mode controls when validation runs:

| mode | When validation fires |
|---|---|
| `onSubmit` | Only on submit (default — best perf) |
| `onBlur` | After field loses focus |
| `onChange` | On every keystroke (expensive — avoid for large forms) |
| `onTouched` | On first blur, then onChange |
| `all` | onChange + onBlur |

`reValidateMode` (default: `onChange`) controls re-validation after the first submit. Use `mode: 'onBlur'` + `reValidateMode: 'onBlur'` for most UX needs without keystroke-level re-renders.

> Full API: [references/basics-register.md](references/basics-register.md)

### register API and Ref Forwarding

`register('fieldName', options?)` returns `{ name, ref, onChange, onBlur }` — spread directly onto native inputs. For ref forwarding with custom components, use `Controller` instead. Constraints: `required`, `min`, `max`, `minLength`, `maxLength`, `pattern`, `validate`. When using a Zod resolver, inline constraints are redundant — the resolver handles all validation.

> Full reference + ref forwarding patterns: [references/basics-register.md](references/basics-register.md)

### Controller for Third-Party Inputs

`Controller` bridges RHF's uncontrolled model with controlled components (shadcn/ui Select, Checkbox, DatePicker, custom inputs). Pattern: `<Controller name="x" control={control} render={({ field, fieldState }) => ...} />`. `field` contains `value`, `onChange`, `onBlur`, `ref` — spread onto the controlled component. `fieldState.error` gives the validation error for that specific field.

> Integration with shadcn/ui Form: [references/controller-and-context.md](references/controller-and-context.md)

### FormProvider and useFormContext

`FormProvider` passes `methods` (the `useForm` return) through React context. Child components call `useFormContext<TSchema>()` to access `register`, `control`, `formState`, `setValue`, `getValues`, etc. Prevents prop-drilling in large forms with nested components. Type the schema at `useFormContext<TSchema>` for full inference.

> Patterns + pitfalls: [references/controller-and-context.md](references/controller-and-context.md)

### useFieldArray for Dynamic Lists

`useFieldArray({ control, name })` returns `{ fields, append, prepend, remove, insert, move, swap, update }`. Fields have a stable RHF-generated `id` — always use `field.id` as React `key`, not the array index. Nested arrays (array of arrays) require nested `useFieldArray` calls each with their own `name` path.

> Full reference with nested arrays: [references/field-array.md](references/field-array.md)

### Zod Resolver Integration

`zodResolver(schema)` from `@hookform/resolvers/zod` runs `schema.safeParse` on submit (and on the configured `mode` triggers). The resolver infers `TSchema` from `z.infer<typeof schema>` — use `useForm<z.infer<typeof schema>>` to make TypeScript aware of the shape. Partial validation (multi-step): pass `schema.pick({...})` as the resolver for each step.

> Async refinements, `.superRefine`, discriminated unions: [references/zod-resolver.md](references/zod-resolver.md)

### Multi-Step Forms

Pattern: single `useForm` at root, navigate steps without unmounting, validate each step's fields via `trigger(['field1', 'field2'])` before proceeding, submit full payload on final step. `FormProvider` shares the form across step components. Avoid unmounting steps — unmounted fields clear their values unless `shouldUnregister: false` is set (it's `false` by default in RHF v7+).

> Full walkthrough with TypeScript: [references/multi-step-forms.md](references/multi-step-forms.md)

### Server Validation Merge

After an API call returns validation errors (e.g., 422 with `{ field: string, message: string }[]`), use `setError('fieldName', { type: 'server', message })` to inject them into `formState.errors`. For a root-level form error (non-field), use `setError('root', { message })`. Call `clearErrors()` or individual `clearErrors('fieldName')` on user correction.

> Full pattern with TanStack Query: [references/server-validation.md](references/server-validation.md)

### formState Subscriptions

`formState` is proxy-based — only the fields you destructure trigger re-renders. Destructure only what you need: `const { errors, isSubmitting, isValid } = formState`. Common pitfalls: `isValid` is `false` until the form has been validated at least once (use `mode: 'onChange'` or call `trigger()` if you need `isValid` on mount). `isDirty` compares against `defaultValues` — always provide `defaultValues` for it to work correctly.

> Subscription patterns: [references/basics-register.md](references/basics-register.md)

### watch and useWatch

`watch('fieldName')` re-renders the component on every change to that field. `useWatch({ control, name })` is the same but can be used in child components and is slightly more performant (subscription-based). For side effects on field change, use `useEffect(() => { const sub = watch(callback); return sub.unsubscribe; }, [watch])`. Never call `watch()` (no args) in a large form — it subscribes to all fields.

> Selective subscription patterns: [references/basics-register.md](references/basics-register.md)

## Behavioral Traits

- Always provides `defaultValues` in `useForm` — required for `isDirty`, `reset`, and diff tracking
- Uses `zodResolver` as the sole validation layer — never duplicates constraints in `register` options when a schema resolver is present
- Uses `Controller` for any non-native input (shadcn Select, Checkbox, DatePicker, custom pickers)
- Spreads `field` from `Controller.render` onto the UI component — never manually wires `onChange`/`value`
- Destructs only the needed `formState` fields — avoids `formState.errors` + `formState.isValid` + `formState.isDirty` all at once unless all three are actually used
- Uses `useWatch` over `watch` in child components — avoids re-rendering the root form component
- Calls `trigger(['fieldA', 'fieldB'])` to validate a specific step before advancing — never validates the entire form mid-flow
- Uses `setError('root', ...)` for non-field API errors (e.g., "email already taken" at form level)
- Calls `reset(newValues)` after successful submission to clear dirty state — not `reset()` without args unless intentionally clearing to `defaultValues`
- Prefers `onBlur` mode for UX — `onChange` is reserved for real-time search or uniqueness-check flows

## Important Constraints

- NEVER use array index as React `key` in `useFieldArray` renders — always `field.id`
- NEVER call `watch()` with no arguments in large forms — subscribes to all fields, causes constant re-renders
- NEVER add Zod validation AND inline `register` constraints for the same field — the resolver owns validation
- NEVER access `formState.isValid` expecting `true` on initial render in `onSubmit` mode — it starts `false`
- NEVER use `shouldUnregister: true` unless explicitly needed — unmounted fields lose their values
- ALWAYS provide `defaultValues` with `useForm` — absent defaults cause uncontrolled-to-controlled warnings and break `isDirty`
- ALWAYS use `<FormProvider>` with `useFormContext` — never pass `control`/`register` as props through many levels
- ALWAYS handle the `isSubmitting` state to disable the submit button — prevents double-submission
- ALWAYS type `useFormContext<z.infer<typeof schema>>()` — untyped context loses field inference
- ALWAYS use `async` on `handleSubmit` callback when calling async APIs — RHF sets `isSubmitting: true` only for async handlers

## Related Skills

**90%-filter applied** — mainstream 2026 choices only.

### UI layer
- ✓ `react` — React 19 composition, hooks, RSC; RHF lives inside React
- ✓ `shadcn` — shadcn/ui Form component is the primary RHF UI wrapper

### Validation
- ✓ `zod` — Zod 4 schema design; RHF delegates validation to zodResolver

### Data fetching / mutations
- ✓ `tanstack-query` — TanStack Query v5 useMutation + RHF handleSubmit compose naturally

### Meta-frameworks
- ✓ `nextjs` — Next.js 16 Server Actions can replace handleSubmit; RHF still useful for client-side validation

### Language
- ✓ `typescript` — TS 5.9; RHF is fully typed, schema inference is central

## API Reference

| Topic | File |
|---|---|
| Index and decision map | [references/REFERENCE.md](references/REFERENCE.md) |
| useForm setup, register API, formState subscriptions, watch/useWatch | [references/basics-register.md](references/basics-register.md) |
| Controller, FormProvider, useFormContext, nested field typing | [references/controller-and-context.md](references/controller-and-context.md) |
| useFieldArray — append/remove/move, nested arrays, key management | [references/field-array.md](references/field-array.md) |
| zodResolver, async refinements, discriminated unions, partial schemas | [references/zod-resolver.md](references/zod-resolver.md) |
| Multi-step forms — trigger per step, shared FormProvider, TypeScript | [references/multi-step-forms.md](references/multi-step-forms.md) |
| Server validation merge — setError, clearErrors, root errors | [references/server-validation.md](references/server-validation.md) |
| **Recommended defaults** — `mode` choice, `defaultValues` discipline, `criteriaMode`, `shouldUnregister` | [references/recommended-defaults.md](references/recommended-defaults.md) |
| **Troubleshooting** — register inside Controller, defaultValues lost, isSubmitting stuck, isValid false, watch storm, server errors not showing | [references/troubleshooting.md](references/troubleshooting.md) |
| **Wrong vs right** — Controller vs register, field.id vs index, duplicate validation, missing defaultValues, scoped useWatch, async onSubmit, setError, FormProvider | [references/wrong-vs-right.md](references/wrong-vs-right.md) |
| Eval cases | [references/eval-cases.md](references/eval-cases.md) |
| Typed form + Zod schema + shadcn/ui boilerplate | [templates/form-component.tsx.template](templates/form-component.tsx.template) |
| Multi-step form boilerplate with FormProvider and step triggers | [templates/multi-step-form.tsx.template](templates/multi-step-form.tsx.template) |
| useFieldArray end-to-end walkthrough | [examples/dynamic-fields.md](examples/dynamic-fields.md) |
| Merging API validation errors into formState | [examples/server-error-merge.md](examples/server-error-merge.md) |

**How to use**: open the specific topic file. Don't read all files — look up only what's relevant to the current task.
