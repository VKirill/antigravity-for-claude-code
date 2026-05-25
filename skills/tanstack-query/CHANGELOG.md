# Changelog — tanstack-query

## [Unreleased]

## [2.0.0] — 2026-05-16

### Changed

- `references/eval-cases.md` migrated to v3 format: user-voice + Expected behavior + How to verify (10/10/5)
- Added `risk: medium-stakes` frontmatter
- SKILL.md untouched (210 lines — under 250)
- Verified v5 surface (`useSuspenseQuery`, `useSuspenseQueries`, `infiniteQueryOptions`, `dehydrate`/`hydrate`/`HydrationBoundary`) against context7 — clean

### Added

- `references/recommended-defaults.md` — `QueryClient` baseline, `staleTime`/`gcTime` per data-type, retry policy, `refetchOnWindowFocus`, mutation optimistic pattern, query-key factory, SSR per-request rule
- `references/troubleshooting.md` — stale after mutation, refetch infinite loop, SSR hydration mismatch, `useQuery` data undefined, `useInfiniteQuery` doesn't load next page, optimistic update vanishes, `useSuspenseQuery` doesn't suspend, v4→v5 `cacheTime` migration, mutation `onSuccess` after unmount
- `references/wrong-vs-right.md` — coarse string keys vs factory, `cacheTime` vs `gcTime`, `keepPreviousData` vs `placeholderData`, removed `onSuccess` callback vs `QueryCache` handlers, missing `onSettled`, module-level vs per-request `QueryClient`, `useEffect` fetching vs `useQuery`

## [1.0.0] — 2026-05-15

Initial release.

### Added

- `SKILL.md`: full Pattern 2 navigator — useQuery, useMutation, infinite, suspense, SSR prefetch, cache management
- `references/REFERENCE.md`: index + provider setup + quick patterns
- `references/queries.md`: query key factory, useQuery options (enabled, select, placeholderData, refetchInterval, retry), cancellation, prefetch
- `references/mutations.md`: useMutation lifecycle, mutate vs mutateAsync, typing, MutationCache global handlers, sequential mutations
- `references/optimistic-updates.md`: full 4-step rollback pattern (cancel, snapshot, setQueryData, restore), add/delete/update variants, common mistakes
- `references/infinite-query.md`: useInfiniteQuery cursor-based and page-number pagination, IntersectionObserver, select, maxPages, bidirectional
- `references/ssr-prefetch.md`: Next.js App Router — makeQueryClient per-request, prefetchQuery, fetchQuery (throws), dehydrate, HydrationBoundary, nested prefetching
- `references/cache-management.md`: staleTime vs gcTime, invalidation strategies (exact, hierarchical, predicate), setQueryData, removeQueries, persistQueryClient, network mode, refetch triggers
- `references/suspense-mode.md`: useSuspenseQuery, useSuspenseQueries, ErrorBoundary pairing, streaming with Next.js, useTransition for non-regression
- `references/eval-cases.md`: positive/negative routing prompts, v4→v5 breaking changes table, SemVer rules
- `templates/query-client.ts`: production QueryClient with retry, staleTime, MutationCache/QueryCache handlers, per-request factory vs singleton
- `templates/query-keys.ts`: typed factory pattern with `{{Feature}}` placeholders
- `examples/optimistic-list.md`: full toggle-todo example with cancel/snapshot/patch/rollback + component
- `examples/infinite-scroll.md`: cursor-based useInfiniteQuery + IntersectionObserver auto-load + filter changes
- `examples/nextjs-prefetch.md`: App Router end-to-end — Server Component prefetch → HydrationBoundary → Client Component with staleTime mismatch pitfall
