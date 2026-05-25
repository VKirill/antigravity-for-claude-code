# nextjs — Eval Cases

v3 format: **user-voice phrasing** (Russian/typos/incomplete welcome) + **Expected behavior** column (which sub-files / templates should load, not just "this skill activates").

## Positive — should activate (10)

| User-voice prompt | Expected behavior |
|---|---|
| "почему params undefined в next 16 странице" | Load `routing.md` Dynamic APIs section; show `await params` pattern |
| "use cache не инвалидируется после revalidateTag" | Load `troubleshooting.md` cache section + `caching.md` for tag semantics |
| "Server Action 413 Payload Too Large на upload" | Load `troubleshooting.md` Server Action 413 + `recommended-defaults.md` `bodySizeLimit` |
| "proxy.ts не срабатывает на /dashboard" | Load `middleware.md` matcher patterns; troubleshooting for matcher misconfig |
| "useActionState + zod валидация формы" | Load `examples/server-action-with-form.md` (canonical end-to-end flow) |
| "PPR с Suspense — где ставить границы" | Load `rendering.md` PPR section; show shell-vs-hole pattern |
| "generateMetadata для динамической OG картинки" | Load `metadata-and-seo.md`; cite `ImageResponse` + `app/og/route.tsx` |
| "intercepting route для модалки фото `(.)`" | Load `routing.md` intercepting routes section |
| "migrate с next 15 на 16 — что ломается" | Load `checklists/migration-15-to-16.md` |
| "Turbopack vs webpack — что отвалится" | Load `performance.md` Turbopack compat section |

## Negative — should NOT activate (10)

| User-voice prompt | Should route to | Why |
|---|---|---|
| "useState в React компоненте" | `react` | Pure React hook, no Next.js |
| "deploy на Vercel с Edge Config" | `vercel` | Vercel-specific deploy [cascade] |
| "Tailwind darkMode strategy" | `tailwind` | Pure styling concern |
| "useQuery не делает refetch" | `tanstack-query` | TanStack issue, no RSC boundary |
| "react-hook-form + zodResolver" | `react-hook-form` | Form lib, not Server Actions |
| "Pino logging для Node.js" | `nodejs` | Runtime concern |
| "SvelteKit SSR" | (no skill) | Wrong framework |
| "Remix loader pattern" | (no skill) | Wrong framework |
| "shadcn dialog компонент" | `shadcn` | Component library |
| "TS conditional types" | `typescript` | Type system |

## Edge cases — 5

| User-voice prompt | Resolution |
|---|---|
| "как фетчить данные в React компоненте" | Borderline. If Next.js context implied → **nextjs** (`'use cache'` / Server Components). Otherwise → **react** (`use(promise)` / TanStack). |
| "useEffect не запускается в next странице" | **nextjs** primary (server vs client boundary diagnosis) + cross-link `react` for hook semantics. |
| "tRPC + app router интеграция" | **nextjs** primary (route handler / RSC integration) + cross-link tRPC skill (cascade marker). |
| "auth в Next.js" | **nextjs** primary (middleware/`proxy.ts` auth flow) + cross-link `nodejs` for token/session patterns. |
| "медленная страница в Next.js" | **nextjs** primary (`performance.md` covers Turbopack, CWV, `next/image`). |

## How to verify (manual)

1. Open a fresh session with this skill loaded in `~/.claude/skills/nextjs/`.
2. Paste each Positive prompt → confirm:
   - System reminder lists `nextjs` as an active skill
   - Response references files matching the "Expected behavior" column
3. Paste each Negative prompt → confirm `nextjs` does NOT appear and the fallback skill is mentioned
4. Edge cases: confirm the response calls out the cross-link explicitly ("primary: nextjs, see also: react/nodejs/...")

If routing is wrong:
- Negative becoming Positive → tighten `description` SKIP rules
- Positive becoming Negative → add missing trigger term to `description`
- Edge cases routing to only one skill → enrich Related Skills cross-links

Run after any change to `SKILL.md` description or major reference restructure.
