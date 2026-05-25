# hono skill — CHANGELOG

## [2.0.0] — 2026-05-15

Full retrofit to skill-evaluation v3 standards. `risk: high-stakes` added (production HTTP framework on edge runtimes = request-handling trust boundary). Bullmq v2.0.1 used as gold-standard exemplar.

### Added
- `references/recommended-defaults.md` — canonical guidance for runtime choice (Workers / Bun / Node / Vercel Edge / Deno / Lambda), router pick (`RegExpRouter` / `TrieRouter` / `LinearRouter` / `hono/tiny`), Bindings & Variables typing pattern, cookie defaults (`httpOnly`, `secure`, `sameSite`, `__Host-` prefix), JWT alg pinning, CORS strict allowlist, ETag + cache headers per environment, RPC `AppType = typeof <chain>` boundary, body-limit per-route, compression by env (Workers/Vercel/Node/proxy), logger middleware, `@hono/zod-validator` placement, Workers bindings types (`KVNamespace`, `D1Database`, `R2Bucket`, `DurableObjectNamespace`), node-server adapter vs native edge.
- `references/troubleshooting.md` — required for `risk: high-stakes` per v3. Symptom-indexed: ES Module vs Service Worker confusion, "Body has already been consumed", Bindings type erasure, CORS preflight mismatch, RPC type drift, edge runtime API mismatch (`node:crypto` → `crypto.subtle`), cookie sameSite cross-origin, ETag misuse, routing surprise (`/users/:id` vs `/users/me`), missing status code (`c.json` defaults 200), Vercel Edge cold start.
- `references/wrong-vs-right.md` — 5 production wrong-vs-right pairs with "Why it matters": `c.req.json()` twice vs `c.req.valid()`, Bindings typed vs untyped, edge `crypto.subtle` vs Node `crypto`, CORS specific allowlist vs `'*' + credentials`, RPC client `typeof <chain>` vs `typeof app`.

### Changed
- `SKILL.md` compressed 276 → 195 lines. Capabilities section now one-liner-per-domain pointing to references — removed inline code blocks that duplicated reference content. Description rewritten to 595 chars (within ≤600 limit) with sharper trigger terms (Workers bindings, specific middleware imports) and SKIP-only routing guidance.
- Frontmatter `risk: high-stakes` added — triggers v3 mandatory artifacts.
- `references/eval-cases.md` rewritten in v3 format: user-voice phrasing (Russian/typos/incomplete) + "Expected behavior" column that names which sub-files should load.
- Behavioral Traits / Constraints updated: added `c.req.json()`-twice rule, `alg`-pinning on JWT, `c.json(body, 4xx)` explicit status, `export default app` on Node antipattern. Defers numeric values to `recommended-defaults.md`.

### Verified versions (Context7, 2026-05-15)
- Confirmed via `/honojs/hono`: cookie helpers `setCookie`/`getCookie`/`setSignedCookie`/`deleteCookie` from `hono/cookie`; `jwt({ secret, alg })` middleware with `c.var.jwtPayload`; `cors({ origin, credentials })` shape; `c.req.parseBody()` exclusive for FormData; `c.req.json()`/`text()`/`arrayBuffer()` for body kinds; `hc<AppType>()` typed client with `$get`/`$post`/`$url`; Bindings/Variables generic shape; compress middleware threshold.
- Confirmed via Hono migration docs: cookie + jwt + body-parsing moved to dedicated sub-paths in v4; constructor uses `<{ Bindings, Variables }>`; static-file serving is adapter-specific (`hono/cloudflare-workers` etc.).
- No hallucinated imports introduced. All `hono/*` sub-paths and `@hono/*` packages cross-checked.

## [1.0.0] — 2026-05-15

### Added
- Initial skill generation under skill-evaluation v2 standards (Pattern 2)
- SKILL.md navigator with 8 reference files + eval-cases
- `references/core-api.md` — Hono(), Context, request/response model, routers
- `references/routing-and-context.md` — patterns, sub-apps, basePath, factory
- `references/middleware.md` — built-ins (cors/logger/etag/csrf/secureHeaders/jwt/basicAuth/bearerAuth/bodyLimit/cache/timeout/compress/serveStatic/...)
- `references/runtimes.md` — Workers, Vercel Edge, Deno, Bun, Node (@hono/node-server), Lambda
- `references/validators-zod.md` — @hono/zod-validator + Valibot + ArkType targets
- `references/rpc-client.md` — hc<AppType>(), $get/$post, headers, query/param
- `references/testing.md` — app.request(), Vitest, Miniflare for Workers
- `references/migration.md` — v3 → v4: generics, hono/cookie + hono/jwt split, c.req.body removal
- `references/eval-cases.md` — 10 positive + 10 negative + 5 edge routing tests
- `templates/minimal-app.ts.template` — runtime-agnostic app
- `templates/cloudflare-workers.ts.template` — Workers entry with typed bindings
- `templates/vercel-edge.ts.template` — Vercel Edge function
- `examples/rpc-end-to-end.md` — server + typed RPC client + tests
- `examples/jwt-protected-api.md` — JWT middleware + role gates

### Verified versions (Context7, 2026-05-15)
- Hono: `4.x` (Hono 4 series stable; constructor uses `<{ Bindings, Variables }>` generics)
- `@hono/node-server`: latest
- `@hono/zod-validator`: latest
- Sources: `/honojs/hono` and `/websites/hono_dev`

### Notes
- Hono 4 already split helpers into `hono/cookie`, `hono/jwt`, `hono/utils/*` namespaces
- RPC client (`hc<AppType>()`) is the killer feature for monorepo frontend/backend type sharing
- `RegExpRouter` is the default; `LinearRouter` is for Lambda one-route deploys
