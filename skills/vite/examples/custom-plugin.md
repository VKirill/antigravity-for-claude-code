# Custom Vite Plugin — Transform Hook + Virtual Module + HMR

End-to-end example of a plugin that transforms files, exposes a virtual module, and handles HMR updates.

## Scenario

We want a plugin that:
1. Transforms `.myext` files into JavaScript at build time
2. Exposes a `virtual:my-config` module populated from a `my.config.json` file
3. Invalidates the virtual module and triggers HMR when `my.config.json` changes

## The Plugin

```ts
// src/plugins/my-plugin.ts
import fs from 'node:fs'
import path from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MyPluginOptions {
  configFile?: string        // path to my.config.json (default: project root)
  transformFilter?: RegExp   // which files to transform (default: /\.myext$/)
}

interface MyConfig {
  apiUrl: string
  features: Record<string, boolean>
}

// ─── Virtual module IDs ───────────────────────────────────────────────────────

const VIRTUAL_ID = 'virtual:my-config'
const RESOLVED_VIRTUAL_ID = '\0' + VIRTUAL_ID   // \0 prefix prevents other plugins interfering

// ─── Plugin factory ───────────────────────────────────────────────────────────

export function myPlugin(options: MyPluginOptions = {}): Plugin {
  const filter = options.transformFilter ?? /\.myext$/
  let configFilePath: string
  let server: ViteDevServer | undefined

  // ─── Hook: config ────────────────────────────────────────────────────────
  // Runs first — lets us store the resolved root for later

  return {
    name: 'my-plugin',
    enforce: 'pre',   // run before Vite's own transforms

    config(config) {
      // Config is not yet resolved here — use for modifying it
      // Return partial config to merge with the user's config
      return {
        // Example: add a global define
        define: {
          __MY_PLUGIN_ENABLED__: 'true',
        },
      }
    },

    // ─── Hook: configResolved ──────────────────────────────────────────────
    // Config is fully resolved — store references we need later

    configResolved(resolvedConfig) {
      configFilePath = options.configFile
        ? path.resolve(resolvedConfig.root, options.configFile)
        : path.resolve(resolvedConfig.root, 'my.config.json')
    },

    // ─── Hook: configureServer ─────────────────────────────────────────────
    // Dev server is available — register custom middleware or event handlers

    configureServer(devServer) {
      server = devServer

      // Optional: custom dev-only API endpoint
      devServer.middlewares.use('/__my-plugin/status', (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ active: true }))
      })
    },

    // ─── Hook: resolveId ──────────────────────────────────────────────────
    // Claim ownership of virtual module imports

    resolveId(id) {
      if (id === VIRTUAL_ID) {
        return RESOLVED_VIRTUAL_ID
      }
    },

    // ─── Hook: load ───────────────────────────────────────────────────────
    // Provide content for claimed module IDs

    load(id) {
      if (id !== RESOLVED_VIRTUAL_ID) return

      // Watch the config file so HMR fires on change
      if (this.environment?.mode === 'dev') {
        this.addWatchFile(configFilePath)
      }

      // Load the config and expose it as a typed ESM module
      const config: MyConfig = fs.existsSync(configFilePath)
        ? JSON.parse(fs.readFileSync(configFilePath, 'utf-8'))
        : { apiUrl: '', features: {} }

      return `
        export const apiUrl = ${JSON.stringify(config.apiUrl)};
        export const features = ${JSON.stringify(config.features)};
        export default { apiUrl, features };
      `
    },

    // ─── Hook: transform ──────────────────────────────────────────────────
    // Transform matching source files

    transform(code, id) {
      if (!filter.test(id)) return null   // return null = no change

      // Example transform: convert .myext DSL to JavaScript
      // In practice, use a real parser
      const transformed = code
        .split('\n')
        .filter(line => !line.startsWith('#'))   // strip comments
        .map(line => {
          const match = line.match(/^(\w+)\s*=\s*(.+)$/)
          if (match) return `export const ${match[1]} = ${JSON.stringify(match[2].trim())};`
          return ''
        })
        .filter(Boolean)
        .join('\n')

      return {
        code: transformed,
        map: null,   // no source map (provide one for production use)
      }
    },

    // ─── Hook: handleHotUpdate ────────────────────────────────────────────
    // Custom HMR handling — runs when any watched file changes

    handleHotUpdate({ file, server: hmrServer, modules }) {
      // When my.config.json changes, invalidate the virtual module
      if (file === configFilePath) {
        const mod = hmrServer.moduleGraph.getModuleById(RESOLVED_VIRTUAL_ID)

        if (mod) {
          // Invalidate the virtual module so it's re-loaded
          hmrServer.moduleGraph.invalidateModule(mod)

          // Send a custom event to client (optional — for component-level handling)
          hmrServer.hot.send({
            type: 'custom',
            event: 'my-config-changed',
            data: { file },
          })

          // Return the invalidated module — Vite will propagate the update
          return [mod]
        }

        // If no consumers of the virtual module are active, force full reload
        hmrServer.hot.send({ type: 'full-reload' })
        return []
      }

      // For all other files, use default HMR behavior
      return modules
    },

    // ─── Hook: buildStart ─────────────────────────────────────────────────
    // Called at the beginning of each build pass

    buildStart() {
      if (!fs.existsSync(configFilePath)) {
        // Emit a warning (not error) — plugin is optional
        this.warn(`my-plugin: config file not found at ${configFilePath}, using defaults`)
      }
    },
  }
}
```

## Usage in vite.config.ts

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { myPlugin } from './src/plugins/my-plugin'

export default defineConfig({
  plugins: [
    react(),
    myPlugin({
      configFile: 'my.config.json',
      transformFilter: /\.myext$/,
    }),
  ],
})
```

## Consuming the Virtual Module

```ts
// src/api-client.ts
import { apiUrl, features } from 'virtual:my-config'

export const client = {
  baseUrl: apiUrl,
  featureEnabled: (name: string) => features[name] ?? false,
}
```

```ts
// src/vite-env.d.ts — declare virtual module types
declare module 'virtual:my-config' {
  export const apiUrl: string
  export const features: Record<string, boolean>
  const config: { apiUrl: string; features: Record<string, boolean> }
  export default config
}
```

## Client-Side HMR Handling

```ts
// src/api-client.ts — respond to config changes in dev
import { apiUrl, features } from 'virtual:my-config'

if (import.meta.hot) {
  import.meta.hot.on('my-config-changed', () => {
    // Optional: show a toast notification
    console.log('[my-plugin] config reloaded')
  })

  // Self-accept to prevent full-page reload when this module updates
  import.meta.hot.accept()
}
```

## Testing the Plugin

```bash
# 1. Start dev server
vite dev

# 2. Modify my.config.json in editor
# → Should see "[vite] hmr update" in terminal, not "page reload"

# 3. Build to verify transform output
vite build
# → .myext files should appear in dist as JavaScript

# 4. Check virtual module in browser
# → import { apiUrl } from 'virtual:my-config' should resolve
```

## Key Patterns Demonstrated

| Pattern | Where |
|---|---|
| `resolveId` + `\0` prefix for virtual modules | `resolveId` and `load` hooks |
| `addWatchFile` to trigger HMR on config changes | `load` hook |
| `handleHotUpdate` to invalidate specific modules | `handleHotUpdate` hook |
| Custom client events via `server.hot.send` | `handleHotUpdate` hook |
| `transform` returning `null` to skip non-matching files | `transform` hook |
| TypeScript declarations for virtual modules | `src/vite-env.d.ts` |
