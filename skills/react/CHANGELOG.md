# react skill — CHANGELOG

All notable changes to this skill follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and SemVer.

## [2.0.0] — 2026-05-16

### Changed

- SKILL.md compressed 262 → ~160 lines per v3 standard (Pattern 2)
- `references/eval-cases.md` migrated to v3 format: user-voice + Expected behavior + How to verify (10/10/5)
- Added `risk: medium-stakes` frontmatter

### Added

- `references/troubleshooting.md` — hydration mismatch sources, StrictMode `useEffect` double-fire, `useState` lazy initializer misuse, `useMemo` no-op deps, infinite render loops, stale closures, Context value gotchas, `useImperativeHandle`
- `references/wrong-vs-right.md` — `useEffect` fetching vs `use(promise)`/TanStack, `forwardRef` vs ref prop, derived state via `useEffect` vs render, `useContext` vs `use()`, `onSubmit` vs `useActionState`, manual memo vs React Compiler

## [1.0.0] — 2026-05-15

### Added (initial release)

- `SKILL.md` — navigator: 8 capability sections, Behavioral Traits, Important Constraints, Related Skills (90%-filter), full API Reference table
- `references/REFERENCE.md` — index + decision map + quick patterns (compound component, useActionState, useOptimistic, ref as prop)
- `references/composition.md` — compound components, render props, polymorphic, ref as prop, forwardRef migration, TypeScript generics
- `references/hooks.md` — custom hooks, useId, useImperativeHandle, useSyncExternalStore, useInsertionEffect, debounce hook, derived state, anti-patterns
- `references/state.md` — useActionState, useOptimistic, use() + Suspense, Context + useReducer, Error Boundaries, Suspense boundary placement
- `references/performance.md` — React Compiler setup (Vite), manual memo/useMemo/useCallback, useTransition, useDeferredValue, virtualization, profiling workflow
- `references/server-components.md` — RSC vs Client decision matrix, async Server Components, Suspense streaming, interleaving pattern, caveats
- `references/react-19-features.md` — Actions, useFormStatus, Document Metadata, Asset Loading, ref as prop, use() for Context, error recovery hooks, migration guide + codemods
- `references/eval-cases.md` — 15 positive, 11 negative, 5 edge cases for routing verification
- `templates/component.tsx` — typed React 19 component template (ref as prop, strict TypeScript)
- `examples/compound-component.md` — Tabs component end-to-end: Context, ARIA, controlled + uncontrolled, Accordion variant, verification checklist
- `examples/optimistic-list.md` — useOptimistic + useActionState + form action, optimistic delete extension, rollback flow diagram, verification checklist
- Version block registered in `sync_skill_versions.py` (React 19.x + TypeScript 5.9.x)
