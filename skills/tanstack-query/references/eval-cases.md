# tanstack-query — Eval Cases

v3 format: user-voice phrasing + Expected behavior + How to verify.

## Positive — should activate (10)

| User-voice prompt | Expected behavior |
|---|---|
| "useQuery возвращает stale data после mutation" | Load `cache-management.md` invalidation + `troubleshooting.md` stale after mutation |
| "optimistic update с rollback" | Load `optimistic-updates.md` + `examples/optimistic-list.md` |
| "useInfiniteQuery + IntersectionObserver" | Load `infinite-query.md` + `examples/infinite-scroll.md` |
| "dehydrate / HydrationBoundary в Next.js App Router" | Load `ssr-prefetch.md` + `examples/nextjs-prefetch.md` |
| "useSuspenseQuery + ErrorBoundary" | Load `suspense-mode.md` |
| "query key factory pattern" | Load `queries.md` + `templates/query-keys.ts.template` |
| "gcTime vs staleTime — что выбрать" | Load `recommended-defaults.md` staleTime/gcTime table |
| "v4 → v5 migration — cacheTime отвалился" | Load `troubleshooting.md` v5 migration + `eval-cases.md` v5 table |
| "placeholderData keepPreviousData" | Load `queries.md` placeholderData section |
| "refetch infinite loop — какие причины" | Load `troubleshooting.md` infinite loop |

## Negative — should NOT activate (10)

| User-voice prompt | Should route to | Why |
|---|---|---|
| "useSWR не рефетчит" | (no skill) | Different lib |
| "Apollo writeQuery" | (no skill) | Apollo-specific |
| "RTK Query createApi" | (no skill) | Different lib |
| "Zustand store" | `react` | Pure client state |
| "useState + useEffect для fetch" | `react` | No TQ context |
| "Next.js use cache" | `nextjs` | Server caching |
| "react-hook-form Controller" | `react-hook-form` | Form lib |
| "zod schema" | `zod` | Validation |
| "Prisma findMany" | `prisma` | ORM |
| "BullMQ retry" | `bullmq` | Queue lib |

## Edge cases — 5

| User-voice prompt | Resolution |
|---|---|
| "useMutation + react-hook-form" | this + `react-hook-form` — both relevant; mutation drives `onSubmit` |
| "TQ + Server Action" | this primary if asking about invalidating client cache after Action; otherwise `nextjs` |
| "prefetch на сервере" | this primary (`ssr-prefetch.md`); cross-link `nextjs` for RSC patterns |
| "useQuery vs useSuspenseQuery" | this primary (`suspense-mode.md` decision); architectural question |
| "TQ persist в localStorage" | this primary (`cache-management.md` `persistQueryClient`); offline patterns |

## How to verify (manual)

1. Open a fresh session with `tanstack-query` loaded.
2. Paste each Positive → confirm system reminder lists `tanstack-query` and response cites expected files.
3. Paste each Negative → confirm `tanstack-query` does NOT appear and fallback is mentioned.
4. Edge: confirm cross-link is called out explicitly.

## v5 breaking changes reference

| v4 | v5 | Notes |
|---|---|---|
| `cacheTime` | `gcTime` | Renamed — v4 key silently ignored |
| `keepPreviousData: true` | `placeholderData: keepPreviousData` | Import `keepPreviousData` from package |
| `useQuery({ onSuccess, onError })` | Removed | Use `QueryCache` event handlers |
| `isLoading` | `isPending` | `isLoading = isPending && isFetching` |
| `status: 'loading'` | `status: 'pending'` | Status string changed |
| No `initialPageParam` | required | Must specify for `useInfiniteQuery` |
