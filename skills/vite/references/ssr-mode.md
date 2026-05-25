# Vite 7 — SSR Mode

Server-Side Rendering with Vite: dev middleware, vite-node, and production SSR builds.

## Architecture Overview

Two SSR approaches:

| Approach | Use case | How it works |
|---|---|---|
| **Dev middleware** (`createServer`) | Full-stack SSR apps (React, Vue) | Vite handles HMR while your Node server renders |
| **vite-node** | SSR frameworks, Vitest internals | Execute TS server code in Vite's module system |

Production: both produce a Node-compatible bundle via `vite build --ssr`.

## Dev Middleware Setup

```ts
// server.ts (your Node server)
import express from 'express'
import { createServer as createViteServer } from 'vite'

async function createServer() {
  const app = express()

  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom',   // Don't serve HTML — your server handles it
  })

  // Mount Vite's dev middleware (handles HMR, asset serving)
  app.use(vite.middlewares)

  app.use('*', async (req, res, next) => {
    const url = req.originalUrl

    try {
      // Read index.html and apply Vite HTML transforms
      let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8')
      template = await vite.transformIndexHtml(url, template)

      // Load the server entry — ssrLoadModule handles HMR, TS, etc.
      const { render } = await vite.ssrLoadModule('/src/entry-server.ts')

      // Render the app
      const appHtml = await render(url)
      const html = template.replace('<!--ssr-outlet-->', appHtml)

      res.status(200).set({ 'Content-Type': 'text/html' }).end(html)
    } catch (e) {
      // Let Vite fix the stack trace for source maps
      vite.ssrFixStacktrace(e as Error)
      next(e)
    }
  })

  app.listen(5173)
}

createServer()
```

### Entry files

Two entry points needed:

```ts
// src/entry-client.ts — browser entrypoint
import { hydrateRoot } from 'react-dom/client'
import { App } from './App'

hydrateRoot(document.getElementById('root')!, <App />)
```

```ts
// src/entry-server.ts — SSR render function
import { renderToString } from 'react-dom/server'
import { App } from './App'

export async function render(url: string): Promise<string> {
  return renderToString(<App url={url} />)
}
```

```html
<!-- index.html -->
<div id="root"><!--ssr-outlet--></div>
<script type="module" src="/src/entry-client.ts"></script>
```

## ssrLoadModule

`ssrLoadModule(url)` loads a module in Vite's SSR module system. Unlike `import()`, it:
- Bypasses the browser module cache
- Supports HMR invalidation
- Handles TypeScript, JSX, etc.
- Throws with source-mapped stack traces

```ts
// Each request gets a fresh module evaluation
const { render } = await vite.ssrLoadModule('/src/entry-server.ts')
```

**Gotcha**: `ssrLoadModule` re-evaluates the module on each call in development — this is intentional for HMR. Module-level side effects run on every load. Use lazy initialization patterns for expensive one-time setup.

## External vs Internal (SSR)

```ts
// vite.config.ts
export default defineConfig({
  ssr: {
    // These packages are NOT bundled — Node requires them directly
    external: ['lodash', 'express'],

    // These ARE bundled even though they're in node_modules
    // (needed for packages that publish ESM-only but expect bundling)
    noExternal: ['some-esm-only-package'],

    // Resolve conditions for SSR modules
    resolve: {
      conditions: ['node', 'module', 'browser', 'import'],
    },
  },
})
```

Default behavior: Node built-ins and packages in `node_modules` are external. ESM-only packages that fail to load may need `noExternal`.

## Production SSR Build

Two build passes — client and server:

```bash
# Build client (generates ssrManifest.json)
vite build --outDir dist/client

# Build server entry
vite build --ssr src/entry-server.ts --outDir dist/server
```

```ts
// vite.config.ts
export default defineConfig(({ command, isSsrBuild }) => ({
  build: {
    // Client build: generate SSR manifest for preload hints
    ssrManifest: !isSsrBuild,
    outDir: isSsrBuild ? 'dist/server' : 'dist/client',
  },
}))
```

### Using ssrManifest in production

The manifest maps module IDs to their preload assets:

```ts
import manifest from './dist/client/.vite/ssr-manifest.json'
import { renderToString } from 'react-dom/server'

export async function render(url: string) {
  const ctx = { modules: new Set<string>() }
  const html = renderToString(<App />)

  // Get preload links for modules used during this render
  const preloadLinks = renderPreloadLinks(ctx.modules, manifest)

  return { html, preloadLinks }
}

function renderPreloadLinks(modules: Set<string>, manifest: Record<string, string[]>) {
  let links = ''
  for (const id of modules) {
    const files = manifest[id]
    if (files) {
      for (const file of files) {
        if (file.endsWith('.js')) {
          links += `<link rel="modulepreload" href="${file}">`
        } else if (file.endsWith('.css')) {
          links += `<link rel="stylesheet" href="${file}">`
        }
      }
    }
  }
  return links
}
```

## vite-node

`vite-node` runs TypeScript/ESM files in Vite's module system — used internally by Vitest. For SSR use cases where you want HMR-aware server code without a full bundler pipeline.

```bash
npm install -D vite-node
npx vite-node src/server.ts
```

`vite-node` handles:
- TypeScript (via Vite's esbuild transform)
- ESM imports (no CJS/ESM interop issues)
- Path aliases from `vite.config.ts`
- Source maps in stack traces

**Use vite-node when**: running Node scripts that need Vite's transform pipeline (same aliases, same TS handling as the browser build) but don't need a full server.

## SSR-Specific Patterns

### Request context per render

Never use module-level singletons for per-request state in SSR — they bleed between requests:

```ts
// BAD: shared mutable state
let currentUser: User | null = null

// GOOD: pass context explicitly
export async function render(url: string, context: { user: User }) {
  return renderToString(<App url={url} user={context.user} />)
}
```

### Conditional browser/server code

```ts
if (import.meta.env.SSR) {
  // Server-only code
} else {
  // Browser-only code
}
```

This is tree-shaken in each respective build.

### Dynamic imports in SSR

Dynamic imports in SSR context load synchronously (Vite resolves them via `ssrLoadModule`). No need for special handling beyond what you'd do in browser code.

## Common SSR Errors

| Error | Cause | Fix |
|---|---|---|
| `window is not defined` | Browser API in SSR context | Guard with `if (typeof window !== 'undefined')` |
| Module not found in SSR | Package publishes CJS only | Add to `ssr.noExternal` |
| Hydration mismatch | Server/client render different HTML | Ensure same data on both sides |
| `ssrLoadModule` stack trace garbled | Error before `ssrFixStacktrace` | Call `vite.ssrFixStacktrace(e)` before re-throw |
