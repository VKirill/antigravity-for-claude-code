---
name: react
description: "Production React 19 — composition patterns, hooks, state management, performance, React Compiler, Actions, useActionState, useOptimistic, use(), ref as prop, Server Components. Use when: react, react 19, hooks, useState, useEffect, useActionState, useOptimistic, use(), ref as prop, React Compiler, composition, memo, useTransition, useDeferredValue, compound components, custom hooks, context, form actions, optimistic UI, RSC. SKIP: Next.js App Router specifics (→nextjs), React Native (→react-native), Vue (→vue)."
stacks:
  - frontend
  - react
packages:
  - react
  - react-dom
tags:
  - react
  - react-19
  - frontend
  - hooks
  - components
  - typescript
  - jsx
  - tsx
source: generated(react-19-patterns)
risk: medium-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- React: `19.x`
- TypeScript: `6.0.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->

## Usage

Loaded automatically when its description matches the active task. Read only the section you need.

## Use this skill when

- Building React 19 components: composition, compound components, render props, polymorphic
- Hooks: custom hooks, `useId`, `useImperativeHandle`, `useSyncExternalStore`, debounce, derived state
- State: Context + `useReducer`, `useActionState`, `useOptimistic`, `use()` + Suspense
- React 19 Actions and form integration (server actions or client actions)
- Optimistic UI with `useOptimistic`
- Suspense + Error Boundaries
- Performance: React Compiler opt-in, `memo`, `useMemo`, `useCallback`, `useTransition`, `useDeferredValue`
- Refs: `ref` as prop (React 19), `useImperativeHandle`, callback refs
- Server vs Client Component decisions
- Document Metadata (`<title>`, `<meta>`), Asset Loading APIs (React 19)
- Migrating React 18 → 19 (`forwardRef` removed, legacy context, string refs)

## Do not use this skill when

- Next.js App Router specifics (routing, layouts, middleware) → `nextjs`
- React Native → `react-native`
- Vue, Svelte, etc. → their dedicated skills
- TS type-system design → `typescript`
- TanStack Query cache specifics → `tanstack-query`
- RHF register/Controller/validation → `react-hook-form`

## Purpose

React 19 is a significant rethink of the model. React Compiler (stable in 19.1) applies memoization automatically. Actions replace ad-hoc `useState + async handler` for mutations. `useActionState` + `useOptimistic` + `use()` enable optimistic UI without external libraries. Server Components shift data fetching to the component tree.

This skill covers composable architecture, hook patterns, new state primitives, performance with/without Compiler, Server vs Client decisions, React 19 DOM/metadata APIs. Hands off to `nextjs` for framework concerns and to `tanstack-query` / `react-hook-form` when those libraries are in use.

## Capabilities

- **Composition patterns** — compound components, render props, polymorphic, `ref` as prop (React 19 — `forwardRef` is gone). → [references/composition.md](references/composition.md)
- **Hooks** — custom hooks, `useId`, `useImperativeHandle`, `useSyncExternalStore`, `useInsertionEffect`, `useDeferredValue`, debounce pattern. → [references/hooks.md](references/hooks.md)
- **State** — `useActionState`, `useOptimistic`, `use(promise|context)`, Context + `useReducer`, Error Boundaries. → [references/state.md](references/state.md)
- **Performance** — React Compiler setup, `memo`/`useMemo`/`useCallback`, `useTransition`, `useDeferredValue`, virtualization. → [references/performance.md](references/performance.md)
- **Server Components** — RSC vs Client decision matrix, composition across the boundary, async components. → [references/server-components.md](references/server-components.md)
- **React 19 features** — Actions, Document Metadata, Asset Loading, `ref` prop, `use()` for Context, error recovery hooks. → [references/react-19-features.md](references/react-19-features.md)
- **Troubleshooting** — hydration mismatch sources, `useEffect` double-fire in StrictMode, `useState` lazy initializer misuse, `useMemo` not memoizing. → [references/troubleshooting.md](references/troubleshooting.md)
- **Wrong vs right** — `useEffect` for fetching vs `use(promise)` / TanStack; `forwardRef` vs ref as prop; derived state via `useEffect` vs render; `useContext` vs `use()`. → [references/wrong-vs-right.md](references/wrong-vs-right.md)

## Behavioral Traits

- Reaches for composition (compound components, render props) before prop drilling workarounds
- Enables React Compiler on new code and removes manual `memo`/`useMemo`/`useCallback` in covered paths
- Uses `useActionState` + `<form action>` for form mutations — no ad-hoc `useState` + `handleSubmit`
- Pairs `useOptimistic` with `useActionState` for any list/UI benefiting from instant feedback
- Writes `ref` as a prop directly — no `forwardRef` wrapper in new code
- Uses `use(promise)` inside Suspense rather than `useEffect` + loading state for async data
- Defines Error Boundaries per feature tree, not just root-level
- TypeScript strict mode — no `any`/`unknown` at component prop boundaries
- Profiles with React DevTools before adding manual memoization
- Keeps Client Components at the leaves — maximum server-rendering surface

## Important Constraints

- NEVER call hooks conditionally or inside loops — violates Rules of React
- NEVER mutate state directly — always use setter or dispatch
- NEVER use `forwardRef()` in new React 19 code — pass `ref` as a prop
- NEVER add `useEffect` for derived state — compute from existing state during render
- NEVER use `useEffect` for data that should be server-fetched — use RSC or `use()` + Suspense
- NEVER reach for external state lib (Zustand, Jotai) before exhausting `useActionState` + Context
- NEVER memoize everything by default — profile first; Compiler handles most cases when enabled
- ALWAYS wrap async component trees with Suspense + ErrorBoundary — not just Suspense
- ALWAYS pass serializable values across Server/Client boundary
- ALWAYS co-locate state at the lowest component that needs it

## Related Skills

✓ marks **active** skills; unmarked are **cascade markers**.

### Language & meta-framework
- ✓ `typescript` — TS 5.9
- ✓ `nextjs` — Next.js 16 (dominant React meta-framework)

### Styling
- ✓ `tailwind` — Tailwind CSS 4
- ✓ `shadcn` — shadcn/ui

### Async / forms / validation
- ✓ `tanstack-query` — TanStack Query 5
- ✓ `react-hook-form` — React Hook Form 7
- ✓ `zod` — Zod 4

### Build & testing
- ✓ `vite` — Vite 6
- ✓ `vitest` — Vitest 4
- ✓ `playwright` — Playwright 1.60

### Deploy
- ✓ `nextjs` — handles deploy for most React apps
- `docker` — non-Next containerized deploys [cascade]
- ✓ `linux-sysadmin` — PM2/Nginx for self-hosted

## API Reference

| Topic | File |
|---|---|
| Index + decision map, quick patterns | [references/REFERENCE.md](references/REFERENCE.md) |
| Compound components, render props, polymorphic, ref as prop | [references/composition.md](references/composition.md) |
| Custom hooks, useId, useImperativeHandle, useSyncExternalStore, debounce | [references/hooks.md](references/hooks.md) |
| `useActionState`, `useOptimistic`, `use()`, Context + `useReducer`, Error Boundaries | [references/state.md](references/state.md) |
| React Compiler, memo/useMemo/useCallback, useTransition, useDeferredValue, virtualization | [references/performance.md](references/performance.md) |
| Server vs Client Components, RSC patterns, Suspense + streaming | [references/server-components.md](references/server-components.md) |
| React 19 APIs: Actions, Document Metadata, Asset Loading, ref prop, `use()` for Context | [references/react-19-features.md](references/react-19-features.md) |
| **Troubleshooting** — hydration, StrictMode double-fire, lazy init, `useMemo` no-op | [references/troubleshooting.md](references/troubleshooting.md) |
| **Wrong vs right** — fetching, forwardRef, derived state, useContext | [references/wrong-vs-right.md](references/wrong-vs-right.md) |
| Eval cases | [references/eval-cases.md](references/eval-cases.md) |

### Templates

| Template | File |
|---|---|
| Typed React 19 component — ref as prop, actions, TS strict | [templates/component.tsx.template](templates/component.tsx.template) |

### Examples

| Scenario | File |
|---|---|
| Tabs compound component: Context state, TS generics, ARIA | [examples/compound-component.md](examples/compound-component.md) |
| Optimistic list: useOptimistic + useActionState + form action + rollback | [examples/optimistic-list.md](examples/optimistic-list.md) |

**How to use**: navigate to the specific file for the topic you need. Don't read all references — look up only what's relevant.
