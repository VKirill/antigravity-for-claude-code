# react — Eval Cases

v3 format: user-voice phrasing + Expected behavior column + How to verify.

## Positive — should activate (10)

| User-voice prompt | Expected behavior |
|---|---|
| "useEffect выполняется два раза в dev — это нормально?" | Load `troubleshooting.md` StrictMode double-fire section |
| "как сделать optimistic update списка" | Load `state.md` + `examples/optimistic-list.md` (useOptimistic + useActionState) |
| "форма с useActionState и Zod валидацией" | Load `state.md`; useActionState + form action pattern |
| "ref в дочернем компоненте — forwardRef сломался" | Load `composition.md`; React 19 — `ref` as prop |
| "useMemo не мемоизирует, рендер каждый раз" | Load `troubleshooting.md` `useMemo` no-op (deps array misuse) |
| "включить React Compiler" | Load `performance.md` Compiler section |
| "когда Server vs Client Component" | Load `server-components.md` decision matrix |
| "use(promise) внутри Suspense — как обработать ошибку" | Load `state.md`; Error Boundary + Suspense pattern |
| "compound component Tabs с Context" | Load `composition.md` + `examples/compound-component.md` |
| "hydration mismatch в React" | Load `troubleshooting.md` hydration section |

## Negative — should NOT activate (10)

| User-voice prompt | Should route to | Why |
|---|---|---|
| "Next.js Server Action" | `nextjs` | Framework-specific |
| "useQuery refetch on focus" | `tanstack-query` | TQ-specific cache |
| "register + Controller в RHF" | `react-hook-form` | RHF API |
| "zod discriminatedUnion" | `zod` | Validation lib |
| "Tailwind dark mode" | `tailwind` | Pure styling |
| "Vue ref vs reactive" | `vue` | Vue API |
| "React Native StyleSheet" | (no skill) | RN-specific |
| "TS conditional types" | `typescript` | Type system |
| "Vitest mock module" | `vitest` | Test runner |
| "shadcn dialog usage" | `shadcn` | Component library |

## Edge cases — 5

| User-voice prompt | Resolution |
|---|---|
| "useState или useReducer" | **react** primary (`state.md` decision) — architectural advice belongs here |
| "fetch в компоненте — useEffect или use(promise)" | **react** primary (`wrong-vs-right.md` — `use()` / TanStack preferred); if Next context, cross-link `nextjs` |
| "context в RSC" | **react** primary (`server-components.md` — RSC can't provide Context); cross-link `nextjs` for App Router context |
| "react-hook-form + useActionState" | **react** if asking integration; **react-hook-form** if asking RHF internals — surface both |
| "useTransition vs useDeferredValue" | **react** primary (`performance.md` covers the difference) |

## How to verify (manual)

1. Open a fresh session with `react` loaded.
2. Paste each Positive → confirm system reminder includes `react` and response cites expected files.
3. Paste each Negative → confirm `react` does NOT appear and fallback is mentioned.
4. Edge: confirm cross-link is called out explicitly.

If wrong: Negative→Positive tightens SKIP rules; Positive→Negative adds missing trigger; edge to one skill needs Related Skills enrichment.
