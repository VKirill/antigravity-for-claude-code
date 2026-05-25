---
name: tanstack-query
description: "TanStack Query 5 server-state management — queries, mutations, infinite, optimistic, cache. Use when: tanstack query, react-query, useQuery, useMutation, useInfiniteQuery, useSuspenseQuery, queryClient, query keys, invalidateQueries, setQueryData, optimistic update, prefetch, hydration, suspense mode, server-side prefetching, dehydrate, hydrate, query cancellation, retry, refetch, stale time, cache time, gcTime. SKIP: SWR (different lib), Apollo Client (GraphQL-specific), Redux Toolkit Query."
stacks:
  - react-frontend
  - frontend
packages:
  - "@tanstack/react-query"
  - "@tanstack/react-query-devtools"
  - "@tanstack/query-core"
tags:
  - react
  - server-state
  - data-fetching
  - caching
  - mutations
  - suspense
risk: medium-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- TanStack Query: `5.x`
- React: `19.x`
- TypeScript: `6.0.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->

## Usage

Loaded automatically when its description matches the active task. Read only the section you need, then follow the link to the relevant reference file for full detail.

## Use this skill when

- Setting up `QueryClient` with production-safe stale/retry/gcTime defaults
- Designing query key factories for consistency across a feature (array structure, factory pattern)
- Writing `useQuery` with `enabled`, `select`, `placeholderData`, or `refetchInterval`
- Implementing mutations with optimistic updates and rollback via `onMutate` / `onError`
- Paginating with `useInfiniteQuery` (cursor-based or page-based) + IntersectionObserver
- Using `useSuspenseQuery` with React 19 Suspense boundaries for data-as-resource
- Server-side prefetching in Next.js App Router with `dehydrate` / `hydrate` / `HydrationBoundary`
- Tuning cache lifecycle: `staleTime` vs `gcTime`, when data goes stale vs when it is GC'd
- Configuring retry strategies (count, delay, conditional on status code)
- Network-mode configuration for offline-first apps (`networkMode: 'offlineFirst'`)
- Persisting the cache to localStorage/IndexedDB with `persistQueryClient`
- Wiring `@tanstack/react-query-devtools` for cache inspection in development

## Do not use this skill when

- Task is SWR (`useSWR`, `useSWRInfinite`) — different library with different mental model
- Task is Apollo Client with GraphQL-specific concerns (subscriptions, fragments, normalized store) — use `apollo-client`
- Task is Redux Toolkit Query (`createApi`, `injectEndpoints`) — use `redux-toolkit`
- Task is pure React state management without server data (context, Zustand, Jotai) — no overlap
- Task is building REST/GraphQL APIs on the backend — TanStack Query is client-only

## Purpose

TanStack Query 5 is the dominant server-state library for React applications — used in a large majority of new React projects that fetch data from APIs. It separates server state (async, remote, potentially stale) from client state (synchronous, local), eliminating the boilerplate of loading/error/data flags and manual cache invalidation.

Version 5 is a significant rewrite: callbacks moved out of `useQuery` into `QueryCache` event handlers, `cacheTime` was renamed `gcTime`, `keepPreviousData` became `placeholderData: keepPreviousData`, and first-class Suspense support landed via `useSuspenseQuery`. This skill covers v5 API exclusively — v4 patterns will cause type errors.

## Capabilities

### Query Keys Design

Query keys are the cache identity. Wrong key structure is the #1 source of stale-data bugs. Use the factory pattern: a `queryKeys` object per feature that produces typed, hierarchical arrays.

Key rules: always wrap in array, order from least to most specific, include all variables that affect the result. Predicate-based invalidation (`queryClient.invalidateQueries({ predicate })`) is the escape hatch when exact keys are impractical.

> Full reference + factory pattern: [references/queries.md](references/queries.md)
> Template: [templates/query-keys.ts.template](templates/query-keys.ts.template)

### useQuery Patterns

Core options that matter in production:

| Option | Purpose |
|---|---|
| `enabled` | Conditional fetch — never pass `undefined` to disabled queries |
| `select` | Transform/subscribe to slice of data — prevents re-renders |
| `placeholderData` | Keeps previous results visible during refetch (replaces v4 `keepPreviousData`) |
| `refetchInterval` | Polling — combine with `refetchIntervalInBackground: false` |
| `staleTime` | How long until data is considered stale (default: 0 = always stale) |
| `gcTime` | How long unused cache entries live (default: 5 min) |

> Full reference: [references/queries.md](references/queries.md)

### Mutations with Optimistic Updates

`useMutation` pattern: `onMutate` → snapshot context → optimistic update → `onError` rollback → `onSettled` invalidate. Never skip `onSettled` — it ensures invalidation even if mutation errors after an optimistic update succeeded.

> Full reference: [references/mutations.md](references/mutations.md)
> End-to-end example with rollback: [examples/optimistic-list.md](examples/optimistic-list.md)

### Optimistic Updates

Two strategies: (1) cancel in-flight queries + setQueryData in `onMutate`, rollback in `onError` — correct for list mutations; (2) `mutateAsync` + immediate local state patch — simpler but no automatic rollback.

> Full reference: [references/optimistic-updates.md](references/optimistic-updates.md)

### Infinite Query

`useInfiniteQuery` for cursor-based or page-number pagination. Key: `getNextPageParam` derives the next cursor from last page; `fetchNextPage()` triggers the load-more. Pair with IntersectionObserver for scroll-to-load.

> Full reference: [references/infinite-query.md](references/infinite-query.md)
> End-to-end with IntersectionObserver: [examples/infinite-scroll.md](examples/infinite-scroll.md)

### Suspense Mode (React 19)

`useSuspenseQuery` throws a Promise when loading (React Suspense protocol). Wrap in `<Suspense fallback={...}>` + `<ErrorBoundary>`. Data is guaranteed non-undefined after the boundary. Use `useSuspenseQueries` for parallel suspense queries.

> Full reference: [references/suspense-mode.md](references/suspense-mode.md)

### Server-Side Prefetching (Next.js App Router)

Pattern: create `QueryClient` in Server Component → `prefetchQuery` → `dehydrate` → pass to `HydrationBoundary` in Client Component. The client receives pre-populated cache with no loading flash. Requires `"use client"` boundary wrapping client hooks.

> Full reference: [references/ssr-prefetch.md](references/ssr-prefetch.md)
> End-to-end Next.js example: [examples/nextjs-prefetch.md](examples/nextjs-prefetch.md)

### Cache Management

`staleTime` controls when background refetch triggers (not when data is removed). `gcTime` controls when unused cache entries are garbage collected. Production baseline: `staleTime: 60_000, gcTime: 5 * 60_000`. For immutable data (user profile after login): `staleTime: Infinity`.

Invalidation strategies: `invalidateQueries({ queryKey: [...] })` for exact match, predicate function for pattern matching, `removeQueries` for hard eviction, `setQueryData` for manual cache write.

> Full reference: [references/cache-management.md](references/cache-management.md)

### Retry & Network Mode

Default: retry 3 times with exponential backoff. Never retry 4xx errors (client errors) — check `error.status` in retry function. `networkMode: 'online'` (default) pauses queries when offline; `'offlineFirst'` fires regardless; `'always'` for non-network data sources.

> Full reference: [references/cache-management.md](references/cache-management.md)

### Devtools

`@tanstack/react-query-devtools` — import `ReactQueryDevtools` and render inside `QueryClientProvider`. Only loads in dev builds when `process.env.NODE_ENV !== 'production'`. Shows cache, query state, stale status, and manual refetch controls.

## Behavioral Traits

- Uses the query key factory pattern for every feature — no inline `['todos']` strings scattered across components
- Sets `staleTime` explicitly — never relies on the default 0 (always stale) in production
- Puts `onSettled` on every mutation that mutates server data, not just `onSuccess`
- Uses `select` to prevent unnecessary re-renders when components only care about a slice
- Wraps `useSuspenseQuery` in both `<Suspense>` and `<ErrorBoundary>` — one without the other is incomplete
- Cancels in-flight queries in `onMutate` before optimistic updates to prevent race conditions
- Creates one `QueryClient` instance per request on the server — never a module-level singleton
- Validates `gcTime >= staleTime` — otherwise data is garbage collected before it goes stale

## Important Constraints

- NEVER use v4 callback options (`onSuccess`, `onError`, `onSettled`) in `useQuery` — they were removed in v5; use `QueryCache` event handlers for global side effects
- NEVER create `QueryClient` as a module-level singleton in Next.js App Router — one per request required
- NEVER call `queryClient.invalidateQueries()` without `await` inside `onSettled` — fire-and-forget misses the loading state
- ALWAYS include all variables that affect query results in the query key — missing variables = stale cache bugs
- ALWAYS set `gcTime >= staleTime` — if gcTime < staleTime the cache entry is GC'd before data is even considered stale
- ALWAYS wrap `useSuspenseQuery` in `<ErrorBoundary>` — Suspense without error boundary leaves rejected promises unhandled
- NEVER share a `QueryClient` across SSR requests — creates data leakage between users

## Related Skills

**90%-filter applied** — each entry is a dominant or near-dominant 2026 choice.

### Framework
- ✓ `react` — React 19 (required peer; Suspense, concurrent features)
- ✓ `nextjs` — Next.js 16 (primary SSR/SSG pairing for `dehydrate`/`hydrate` patterns)

### Language
- ✓ `typescript` — TS 5.9 (typed query keys and select transforms)

### Validation
- ✓ `zod` — Zod 4 (validate API responses in `queryFn` before caching)

### Forms
- ✓ `react-hook-form` — React Hook Form 8 (mutations pair with form submission)

## API Reference

| Topic | File |
|---|---|
| Index + decision map, quick patterns | [references/REFERENCE.md](references/REFERENCE.md) |
| Query keys factory, useQuery patterns, enabled/select/placeholderData | [references/queries.md](references/queries.md) |
| useMutation, onMutate/onError/onSettled lifecycle | [references/mutations.md](references/mutations.md) |
| Optimistic updates — setQueryData rollback pattern | [references/optimistic-updates.md](references/optimistic-updates.md) |
| useInfiniteQuery, cursor pagination, page number pagination | [references/infinite-query.md](references/infinite-query.md) |
| Next.js App Router prefetch, dehydrate, HydrationBoundary | [references/ssr-prefetch.md](references/ssr-prefetch.md) |
| staleTime vs gcTime, invalidation strategies, persistQueryClient | [references/cache-management.md](references/cache-management.md) |
| useSuspenseQuery, React 19 Suspense, ErrorBoundary pairing | [references/suspense-mode.md](references/suspense-mode.md) |
| **Recommended defaults** — `staleTime`/`gcTime` per data-type, retry policy, `refetchOnWindowFocus`, factory pattern | [references/recommended-defaults.md](references/recommended-defaults.md) |
| **Troubleshooting** — stale after mutation, refetch loop, SSR hydration mismatch, optimistic flash, v5 migration | [references/troubleshooting.md](references/troubleshooting.md) |
| **Wrong vs right** — coarse keys vs hierarchical, v4→v5 renames, missing onSettled, module-level QueryClient, useEffect fetching | [references/wrong-vs-right.md](references/wrong-vs-right.md) |
| Eval cases (routing tests) | [references/eval-cases.md](references/eval-cases.md) |

### Templates

| Template | File |
|---|---|
| Production QueryClient config — retry, staleTime, gcTime, error handler | [templates/query-client.ts.template](templates/query-client.ts.template) |
| Query key factory pattern — typed, hierarchical, per-feature | [templates/query-keys.ts.template](templates/query-keys.ts.template) |

### Examples

| Scenario | File |
|---|---|
| Optimistic list update with rollback — cancel, setQueryData, onError restore | [examples/optimistic-list.md](examples/optimistic-list.md) |
| Infinite scroll — useInfiniteQuery + IntersectionObserver | [examples/infinite-scroll.md](examples/infinite-scroll.md) |
| Next.js App Router prefetch — Server Component + HydrationBoundary | [examples/nextjs-prefetch.md](examples/nextjs-prefetch.md) |

**How to use**: navigate to the specific file for the topic you need. Don't read all files — look up only what's relevant to the current task.
