---
name: vite
description: "Vite 7 frontend build tool — fast HMR via native ESM, Rollup production builds, plugin ecosystem, modernized browser-target defaults. Use when: vite, vite.config.ts, vite dev, vite build, vite preview, HMR, hot module replacement, vite plugin, define, alias, resolve, server.proxy, build.target, build.rollupOptions, environment API, multi-page apps, SSR, library mode, asset handling, glob import, baseline-widely-available. SKIP: Webpack-specific (legacy), Turbopack (Next.js internal), Parcel."
stacks:
  - frontend
  - build-tooling
packages:
  - vite
  - "@vitejs/plugin-react"
  - "@vitejs/plugin-vue"
  - "@vitejs/plugin-svelte"
  - vite-node
tags:
  - vite
  - build
  - bundler
  - hmr
  - esm
  - frontend
  - dev-server
source: vechkasov-global-skills
risk: medium-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- Vite: `7.x`
- TypeScript: `6.0.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->

## Usage

Loaded automatically when its description matches the active task. Read only the section you need, then follow the link to the relevant reference file for full detail.

## Use this skill when

- Writing or debugging `vite.config.ts` — root, base, build, server, resolve, define
- Setting up HMR and `import.meta.hot` for custom module replacement logic
- Configuring official plugins: `@vitejs/plugin-react`, `@vitejs/plugin-vue`, `@vitejs/plugin-svelte`
- Writing a custom Vite plugin (transform hooks, virtual modules, resolveId)
- Configuring the Environment API (Vite 6 multi-environment builds for client + SSR + custom)
- Building an SSR app with Vite dev server as middleware (`ssrLoadModule`, `vite-node`)
- Creating a publishable library (`build.lib` mode with UMD/ES outputs)
- Setting up multi-page apps (multiple HTML entry points in `build.rollupOptions.input`)
- Using glob imports (`import.meta.glob`) for dynamic route/component discovery
- Handling env variables (`import.meta.env`, `VITE_` prefix, `.env.*` files)
- Proxying API requests in dev (`server.proxy`)
- Optimizing production builds (code splitting, chunk naming, `build.target`, source maps)
- Debugging HMR failures, slow builds, or missing dependency pre-bundling

## Do not use this skill when

- Task is Webpack config exclusively — different bundler, no overlap
- Task is Turbopack (Next.js 15+ internal bundler) — use `nextjs`
- Task is Parcel or esbuild used directly (not via Vite)
- Task is Vitest test configuration exclusively — use `vitest` (Vitest is Vite-powered but the test-runner skill is distinct)
- Task is a Next.js project using Turbopack — use `nextjs`
- Task is React component logic, hooks, or state — use `react`
- Task is Vue component composition — use `vue`
- Task is TypeScript type system design — use `typescript`

## Purpose

Vite 7 is the dominant frontend build tool for non-Next.js projects in 2026 — used by React, Vue, Svelte, Solid, Astro, and vanilla TS projects alike. In dev mode it bypasses bundling entirely: the browser loads native ES modules, and esbuild transforms individual files on request. This makes cold start essentially instant and HMR sub-50ms for most projects. Production builds use Rollup under the hood, producing optimized, tree-shaken output with automatic code splitting.

Vite 7 carries forward the **Environment API** (introduced in Vite 6) — a first-class abstraction for multi-environment builds (client, SSR, service worker, edge) within one config — and modernizes the **default browser target** to `baseline-widely-available` (Chrome 107 / Edge 107 / Firefox 104 / Safari 16.0). This skill covers the full lifecycle: dev server setup, plugin authoring, SSR integration, library mode, and production optimization. It hands off to narrower framework skills (`react`, `vue`, `vitest`) when the work is framework component logic or unit testing rather than build configuration.

> **Why pinned at Vite 7, not Vite 8?** Vite 8.0.13 ships but the downstream Vitest 4.x line **dropped Vite 8 beta support in v4.1.1** (Vitest 5 is still in beta). Bumping the skill recommendation to Vite 8 today would break the dominant Vite 7 + Vitest 4 pairing. Re-pin to 8.x once Vitest 5 reaches GA. Vite 8 also replaces esbuild+Rollup with **Rolldown + Oxc** and renames `build.rollupOptions` → `build.rolldownOptions` — a material rewrite of config-time API surface.

> **Vite 6 → Vite 7 breaking changes worth knowing**: Node 18 dropped (minimum **Node 20.19+ / 22.12+**); `splitVendorChunkPlugin` removed (use `build.rollupOptions.output.manualChunks`); Sass Legacy API removed (modern Sass API only); `transformIndexHtml` hooks use `order` / `handler` (not `enforce` / `transform`); `HotBroadcaster` and `experimental.skipSsrTransform` removed; default browser target now `baseline-widely-available`. Source: https://v7.vite.dev/guide/migration.html

## Capabilities

Each line below points to the canonical reference. The reference owns code, edge cases, and gotchas.

- **vite.config.ts** — TS-first via `defineConfig`. Top-level: `root`, `base` (sub-path deploys), `publicDir`, `envDir`. `build.{outDir, target, sourcemap, rollupOptions, minify}`. → [references/config-basics.md](references/config-basics.md)
- **HMR API** — `import.meta.hot.{accept, dispose, decline, invalidate, on, send}`. Always guard `if (import.meta.hot)` (production tree-shake). → [references/config-basics.md](references/config-basics.md)
- **Official plugins** — `@vitejs/plugin-react` (Babel) / `@vitejs/plugin-react-swc` (5-10× faster for large apps); `@vitejs/plugin-vue` (Vue 3 SFC `<script setup>`); `@vitejs/plugin-svelte` (Svelte 5 runes). → [references/plugins.md](references/plugins.md)
- **Custom plugins** — object with `name` + Rollup hooks superset + Vite-specific (`configureServer`, `transformIndexHtml`, `handleHotUpdate`). `enforce: 'pre' | 'post'` for ordering. → [examples/custom-plugin.md](examples/custom-plugin.md)
- **Environment API (Vite 6+, stable in Vite 7)** — first-class `environments: { client, ssr, ... }`; each env has own module graph + pipeline + target. Plugins opt-in via `applyToEnvironment(env)`. `createEnvironment` factory for custom runtimes (edge/Deno/workerd). → [references/environment-api.md](references/environment-api.md)
- **Modernized browser defaults (Vite 7)** — `build.target` aliases `'baseline-widely-available'` → Chrome 107 / Edge 107 / Firefox 104 / Safari 16.0. Override to ship to older browsers explicitly; legacy `'modules'` target is gone.
- **SSR** — (1) dev middleware (`createServer` + `ssrLoadModule`); (2) `vite-node` for runtime TS execution. Prod: `vite build --ssr src/entry-server.ts` + `ssrManifest: true`. → [references/ssr-mode.md](references/ssr-mode.md)
- **Library mode** — `build.lib.{entry, name, formats}`; externalize peer deps (React/Vue) via `rollupOptions.external`; `vite-plugin-dts` for `.d.ts`. → [references/library-mode.md](references/library-mode.md) / [templates/vite.lib.config.ts.template](templates/vite.lib.config.ts.template)
- **Glob imports** — `import.meta.glob(pattern, { eager, import })` resolved at build time. → [references/config-basics.md](references/config-basics.md)
- **Env vars** — `.env` → `.env.local` → `.env.[mode]` → `.env.[mode].local`; `VITE_*` exposed to client via `import.meta.env`. `define` for compile-time constants (wrap with `JSON.stringify`).
- **Dev proxy** — `server.proxy['/api'] = { target, changeOrigin }`; `ws: true` for WebSocket targets.
- **Production optimization** — `build.rollupOptions.output.manualChunks` (named vendor/app split); `build.assetsInlineLimit` (default 4kB); `build.chunkSizeWarningLimit` (default 500kB). → [references/performance.md](references/performance.md)

## Behavioral Traits

- Reads `vite.config.ts` before suggesting any config changes — never assumes defaults without seeing the file
- Recommends `@vitejs/plugin-react-swc` over Babel plugin for projects with >50 components
- Always externalize React/Vue/Svelte in library mode — never bundles framework peer deps
- Guards all `import.meta.hot` usage behind `if (import.meta.hot)` — production tree-shaking is load-bearing
- Checks `build.target` matches actual browser support requirements — defaults are often too conservative
- Uses `define` for compile-time constants, `import.meta.env` for runtime env vars — never conflates them
- Names chunks intentionally in `manualChunks` — avoids generic `chunk-[hash]` in production
- Adds `vite-plugin-dts` only in library mode builds, not app builds
- Prefers Environment API over `mode` hacks for true multi-environment needs in Vite 7
- Audits `build.target` against the new `baseline-widely-available` default before assuming older-browser support (Vite 7 baseline is Chrome 107+ / Safari 16.0+)
- Uses `transformIndexHtml` hooks with `{ order, handler }` (Vite 7) — not the legacy `{ enforce, transform }` shape
- Replaces `splitVendorChunkPlugin` (removed in Vite 7) with explicit `build.rollupOptions.output.manualChunks` config
- Validates `base` option whenever the app deploys to a sub-path — a wrong base silently breaks all asset URLs

## Important Constraints

- NEVER bundle React, Vue, or Svelte in library mode — always add them to `rollupOptions.external` and `peerDependencies`
- NEVER put `import.meta.hot` calls outside `if (import.meta.hot)` guard in production code
- NEVER commit `.env.local` or `.env.*.local` files — they are gitignore-listed for secrets
- NEVER use `define` to inject runtime values from `process.env` at server startup without `JSON.stringify` wrapping
- ALWAYS set `base` explicitly when deploying to a non-root path
- ALWAYS use `resolve.alias` with absolute paths (via `path.resolve(__dirname, ...)`) — relative aliases silently break in monorepos
- ALWAYS run `vite build` with `--mode production` when testing production behavior locally — dev mode skips many optimizations
- NEVER use `@rollup/plugin-*` packages directly unless Vite's built-in equivalents are insufficient — they may conflict with Vite's Rollup integration

## Related Skills

**90%-filter applied** — each entry is mainstream in 2026 (≥30% of Vite projects, or #1–2 choice in category).

### Language
- ✓ `typescript` — TS 6.0 (default pairing; >95% of new Vite projects)

### Frameworks (Vite serves as build tool)
- ✓ `react` — React 19 (most common Vite target)
- ✓ `vue` — Vue 3.5 (second most common)

### Testing (Vite-powered)
- ✓ `vitest` — Vitest 4 (shares Vite's config; the unit testing skill)

### Styling
- ✓ `tailwind` — Tailwind 4.3 (most common CSS framework in Vite projects)

### Meta-frameworks (use their own build integration, NOT this skill)
- ✓ `nextjs` — Next.js 16 uses Turbopack, not Vite — use nextjs skill instead
- ✓ `astro` — Astro 6 uses Vite internally but exposes its own config via `astro.config.mjs`

### Lint & format
- ✓ `biome` — Biome 2 (mainstream 2026 linter/formatter for TS projects)

## API Reference

Domain-specific references (Pattern 2) — load only what's relevant:

| Topic | File |
|---|---|
| Index + decision map — which file to open for any task | [references/REFERENCE.md](references/REFERENCE.md) |
| vite.config.ts fields, HMR API, env vars, dev server proxy | [references/config-basics.md](references/config-basics.md) |
| Official plugins (react, vue, svelte), plugin authoring API | [references/plugins.md](references/plugins.md) |
| SSR mode: dev middleware, vite-node, production SSR build | [references/ssr-mode.md](references/ssr-mode.md) |
| Library mode: build.lib, externals, vite-plugin-dts, dual CJS/ESM | [references/library-mode.md](references/library-mode.md) |
| Environment API: multi-environment config, client/ssr/custom envs | [references/environment-api.md](references/environment-api.md) |
| Build performance: dep pre-bundling, chunk splitting, warm cache | [references/performance.md](references/performance.md) |
| Troubleshooting: HMR failures, missing pre-bundle, CJS interop errors | [references/troubleshooting.md](references/troubleshooting.md) |
| Routing tests — positive/negative eval cases for skill routing | [references/eval-cases.md](references/eval-cases.md) |

### Templates

Production-ready boilerplates with `{{placeholder}}` markers:

| Template | File |
|---|---|
| App config: React plugin, alias, define, build optimization, proxy | [templates/vite.config.ts.template](templates/vite.config.ts.template) |
| Library config: build.lib, externals, vite-plugin-dts, dual output | [templates/vite.lib.config.ts.template](templates/vite.lib.config.ts.template) |

### Examples

End-to-end walkthroughs — complete flow, not just snippets:

| Scenario | File |
|---|---|
| Custom plugin: transform hook + virtual module + HMR update | [examples/custom-plugin.md](examples/custom-plugin.md) |
| Multi-page app: multiple HTML entries, shared chunk config | [examples/multi-page-app.md](examples/multi-page-app.md) |

**How to use**: navigate to the specific file for the topic you need. Don't load all files — look up only what's relevant.
