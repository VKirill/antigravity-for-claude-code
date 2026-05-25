# vite — Eval Cases

v3 format: **user-voice phrasing** + **Expected behavior** column (which sub-files / templates should load, not just "skill activates").

## Positive — should activate (10)

| User-voice prompt | Expected behavior |
|---|---|
| "vite.config.ts с алиасами и proxy на /api" | Load `config-basics.md`; cite `resolve.alias` with absolute paths + `server.proxy['/api'] = { target, changeOrigin }` |
| "HMR не работает после обновления плагина" | Load `troubleshooting.md` + `config-basics.md` HMR section; flag `if (import.meta.hot)` guard + plugin order |
| "Vite 7 environments client+ssr build" | Load `environment-api.md`; cite `environments: { client, ssr }` + `applyToEnvironment` plugin opt-in |
| "library mode для публикации npm пакета" | Load `library-mode.md` + `templates/vite.lib.config.ts.template`; cite `build.lib` + `rollupOptions.external` |
| "SSR через middleware с Express" | Load `ssr-mode.md` dev middleware section; cite `createServer({ middlewareMode: true }) + ssrLoadModule` |
| "@vitejs/plugin-react vs SWC, что быстрее" | Load `plugins.md`; cite SWC 5-10× faster transform for large apps |
| "пишу свой плагин с virtual module" | Load `plugins.md` + `examples/custom-plugin.md`; cite `resolveId` + `load` hooks + `\0virtual:` prefix |
| "import.meta.glob для авто-роутинга" | Load `config-basics.md` Glob section; cite `{ eager, import }` options + build-time resolution |
| "base path для деплоя на /app" | Cite SKILL.md Constraints (always set `base` for sub-path); load `config-basics.md` |
| "manualChunks для vendor split" | Load `performance.md`; cite `build.rollupOptions.output.manualChunks` named pattern |

## Negative — should NOT activate (10)

| User-voice prompt | Should route to | Why |
|---|---|---|
| "Next.js Turbopack config" | `nextjs` | Different bundler, Next-internal |
| "Webpack 5 splitChunks" | (no skill) | Different bundler |
| "Parcel config" | (no skill) | Different bundler |
| "esbuild standalone build" | `nodejs` | Direct esbuild use, not Vite |
| "Astro adapter config" | `astro` | Astro exposes own config; Vite is internal |
| "Rollup standalone library" | (no skill) | Direct Rollup, not Vite library mode |
| "tsc-only typecheck в CI" | `typescript` | Type-check, not build |
| "vitest pool config" | `vitest` | Test runner, not build tool |
| "React useState rerender" | `react` | Component logic |
| "Vue defineProps типизация" | `vue` | Vue compiler/types |

## Edge cases — 5

| User-voice prompt | Resolution |
|---|---|
| "Vite + Vitest конфиг в одном файле" | **vite** primary (`config-basics.md`) + `vitest` cross-link. Pattern: `vite.config.ts` with `test:` block; Vitest reads same config. |
| "Astro проект — менять vite.config" | **astro** primary; flag Astro exposes Vite config via `astro.config.mjs` `vite:` key. Cross-link `vite` for plugin authoring inside the Vite layer. |
| "Vite 5 → 6 migration" | **vite** primary; flag Environment API as biggest add. Most v5 configs forward-compatible; review `environments` if SSR. |
| "Tailwind 4 + Vite plugin" | **tailwind** primary (`integration-with-react.md`) + `vite` cross-link. Pattern: `@tailwindcss/vite` plugin in `plugins[]`. |
| "Cloudflare Workers build target" | **vite** primary (`environment-api.md` createEnvironment for workerd) + (no skill) for CF-specifics. |

## How to verify (manual)

1. Open a fresh session with this skill in `~/.claude/skills/vite/`.
2. Paste each Positive prompt → confirm:
   - The system reminder lists `vite` as an active skill
   - The response references files matching the "Expected behavior" column
3. Paste each Negative prompt → confirm `vite` does NOT appear in the routed skill response, and the suggested fallback skill is mentioned.
4. Edge cases: confirm response surfaces cross-link explicitly ("primary: vite, see also: astro/tailwind/vitest").

If a prompt routes wrong:
- Negative becoming Positive → tighten the `description` SKIP rules
- Positive becoming Negative → add the missing trigger term to `description`
- Edge routing only to one skill → enrich Related Skills cross-links

Run after any change to `SKILL.md` description or major reference restructure.
