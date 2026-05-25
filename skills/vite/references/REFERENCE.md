# Vite 7 — Reference Index

> Vite 7.x · TypeScript 6.0.x · Updated: 2026-05-16
>
> Skill pinned at Vite 7; Vite 8 (Rolldown + Oxc) is blocked by downstream Vitest 4 compat — see SKILL.md.

Split into focused files. Read only the file relevant to your task.

## Decision Map

| Task | File |
|---|---|
| Setting up `vite.config.ts` from scratch | `config-basics.md` |
| Adding React/Vue/Svelte plugin | `plugins.md` |
| Writing a custom plugin (transform, virtual module) | `plugins.md` |
| SSR dev server or `vite-node` | `ssr-mode.md` |
| Publishing a component library | `library-mode.md` |
| Multi-environment builds (Environment API, introduced in Vite 6, stable in Vite 7) | `environment-api.md` |
| Slow builds, large bundles, pre-bundling issues | `performance.md` |
| HMR not working, CJS errors, dep resolution failures | `troubleshooting.md` |

## File Coverage

| File | Coverage |
|---|---|
| `config-basics.md` | defineConfig, root/base/publicDir, resolve.alias, define, env vars, server.proxy, HMR API, build options |
| `plugins.md` | @vitejs/plugin-react (Babel + SWC), @vitejs/plugin-vue, @vitejs/plugin-svelte, plugin authoring API |
| `ssr-mode.md` | createServer + ssrLoadModule, vite-node, production SSR build, ssrManifest |
| `library-mode.md` | build.lib, formats, externals, vite-plugin-dts, dual CJS/ESM, package.json exports |
| `environment-api.md` | Environment API: environments config, client/ssr envs, applyToEnvironment, createEnvironment |
| `performance.md` | optimizeDeps, manualChunks, assetInlineLimit, build.target, warm cache, worker threads |
| `troubleshooting.md` | HMR failures, CJS/ESM interop errors, pre-bundle misses, alias not resolving, base URL bugs |

---

## Quick Patterns

### Minimal React config

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
})
```

### Env variable access

```ts
// .env.production
VITE_API_URL=https://api.example.com

// in source
const url = import.meta.env.VITE_API_URL  // string | undefined
```

### Dev proxy

```ts
server: {
  proxy: {
    '/api': { target: 'http://localhost:3001', changeOrigin: true },
  },
}
```

### Glob import (lazy routes)

```ts
const pages = import.meta.glob('./pages/**/*.tsx')
// { './pages/Home.tsx': () => import('./pages/Home.tsx'), ... }
```

### HMR self-accept pattern

```ts
export const state = reactive({ count: 0 })

if (import.meta.hot) {
  import.meta.hot.accept((newModule) => {
    // handle update
  })
}
```
