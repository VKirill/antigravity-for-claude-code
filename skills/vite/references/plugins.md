# Vite 7 — Plugins

Official framework plugins and custom plugin authoring API.

## Official Plugins

### @vitejs/plugin-react (Babel)

Default React plugin. Uses Babel for Fast Refresh and JSX transform.

```bash
npm install -D @vitejs/plugin-react
```

```ts
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react({
      // Optional: enable Fast Refresh for specific patterns
      include: '**/*.{jsx,tsx}',
      // Optional: Babel config
      babel: {
        plugins: ['babel-plugin-styled-components'],
      },
    }),
  ],
})
```

### @vitejs/plugin-react-swc (Recommended for large projects)

Uses SWC instead of Babel. 5–10× faster transform. Drop-in replacement.

```bash
npm install -D @vitejs/plugin-react-swc
```

```ts
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  plugins: [react()],
})
```

Limitation: SWC doesn't support all Babel plugins. If you need `styled-components` Babel plugin or similar, stay with the Babel plugin.

**Rule of thumb**: use SWC unless you have a specific Babel plugin dependency.

### @vitejs/plugin-vue

Vue 3 SFCs, `<script setup>`, TypeScript, custom blocks.

```bash
npm install -D @vitejs/plugin-vue
```

```ts
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [
    vue({
      // Optional: custom block transforms
      customElement: false,            // treat .ce.vue as custom elements
      reactivityTransform: false,      // deprecated in Vue 3.4+, use <script setup>
    }),
  ],
})
```

### @vitejs/plugin-svelte

Svelte 5 runes, HMR, preprocessors.

```bash
npm install -D @sveltejs/vite-plugin-svelte
```

```ts
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte()],
})
```

## Custom Plugin Authoring

A Vite plugin is a plain object (or function returning one) with a `name` and optional hooks.

```ts
import type { Plugin } from 'vite'

function myPlugin(): Plugin {
  return {
    name: 'my-plugin',     // required, shown in errors/warnings
    enforce: 'pre',         // 'pre' | 'post' — optional execution order

    // Vite-specific hooks:
    config(config, env) {
      // Modify the resolved config before Vite processes it
      // Return partial config to merge, or mutate in place
    },

    configResolved(resolvedConfig) {
      // Called after config is fully resolved
      // Good for caching the config for use in other hooks
    },

    configureServer(server) {
      // Access to Vite dev server
      // Add custom middleware, handle routes, etc.
      server.middlewares.use('/my-route', (req, res) => {
        res.end('custom response')
      })
    },

    transformIndexHtml(html) {
      // Transform index.html — runs for every HTML entrypoint
      return html.replace(/__TITLE__/g, 'My App')
      // Or return { html, tags: [{ ... }] } for tag injection
    },

    handleHotUpdate({ file, server, modules }) {
      // Custom HMR handling — return [] to suppress default, or modules to force update
      if (file.endsWith('.special')) {
        server.hot.send({ type: 'full-reload' })
        return []
      }
    },

    // Rollup hooks (also available in plugins):
    resolveId(source, importer) {
      // Intercept module resolution
      if (source === 'virtual:my-module') {
        return source   // Return non-null to claim this module
      }
    },

    load(id) {
      // Provide module content for claimed IDs
      if (id === 'virtual:my-module') {
        return 'export const value = 42'
      }
    },

    transform(code, id) {
      // Transform source code for any module
      if (!id.endsWith('.ts')) return
      return {
        code: code.replace(/REPLACE_ME/g, 'replaced'),
        map: null,   // source map (optional)
      }
    },

    buildStart() {
      // Called at the start of each build
    },

    buildEnd() {
      // Called at the end of each build
    },

    closeBundle() {
      // Called when build finishes (after writeBundle)
    },
  }
}
```

## Plugin Order and enforce

Plugins without `enforce` run in the order they appear in the array.

- `enforce: 'pre'` — runs before Vite's core transforms
- `enforce: 'post'` — runs after Vite's core transforms (including `esbuild`)

The full order:
1. Alias resolution
2. `enforce: 'pre'` user plugins
3. Vite core (ESM transforms, asset handling, JSON, CSS)
4. User plugins (no enforce)
5. `enforce: 'post'` user plugins
6. Build-specific post-plugins

## Virtual Modules

Virtual modules are imported with a special ID (commonly prefixed with `virtual:`). Convention: prefix the internal resolved ID with `\0` to prevent other plugins from intercepting it.

```ts
function virtualPlugin(): Plugin {
  const virtualModuleId = 'virtual:my-config'
  const resolvedVirtualModuleId = '\0' + virtualModuleId

  return {
    name: 'virtual-config',

    resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId
      }
    },

    load(id) {
      if (id === resolvedVirtualModuleId) {
        return `
          export const config = ${JSON.stringify({ version: '1.0' })}
        `
      }
    },
  }
}

// Usage in app code:
// import { config } from 'virtual:my-config'
```

## Hot Update for Virtual Modules

To invalidate virtual modules on file change:

```ts
function virtualPlugin(): Plugin {
  let configFile = ''

  return {
    name: 'virtual-config',

    configResolved(config) {
      configFile = path.resolve(config.root, 'my.config.json')
    },

    resolveId(id) {
      if (id === 'virtual:my-config') return '\0virtual:my-config'
    },

    load(id) {
      if (id !== '\0virtual:my-config') return
      // Register this file as a dependency of the virtual module
      this.addWatchFile(configFile)
      const data = JSON.parse(fs.readFileSync(configFile, 'utf-8'))
      return `export default ${JSON.stringify(data)}`
    },

    handleHotUpdate({ file, server }) {
      if (file === configFile) {
        // Invalidate the virtual module
        const mod = server.moduleGraph.getModuleById('\0virtual:my-config')
        if (mod) server.moduleGraph.invalidateModule(mod)
        server.hot.send({ type: 'full-reload' })
      }
    },
  }
}
```

## Plugin Factory Pattern

Plugins that accept options should return a factory function:

```ts
interface MyPluginOptions {
  filter?: RegExp
  transform?: (code: string) => string
}

export function myPlugin(options: MyPluginOptions = {}): Plugin {
  const filter = options.filter ?? /\.(js|ts)$/

  return {
    name: 'my-plugin',
    transform(code, id) {
      if (!filter.test(id)) return
      return options.transform ? options.transform(code) : code
    },
  }
}
```

## apply — Limit Plugin to Dev or Build

```ts
{
  name: 'dev-only-plugin',
  apply: 'serve',   // only in dev server ('serve' | 'build')

  // Or a function for more control:
  apply(config, { command }) {
    return command === 'build' && config.mode === 'production'
  },
}
```

## Accessing Server in Transform

The dev server is available in transform via `this.environment` (Vite 6+, current in Vite 7):

```ts
transform(code, id) {
  if (this.environment?.mode === 'dev') {
    // Dev-only transform logic
  }
}
```

## Common Third-Party Plugins

| Plugin | Purpose |
|---|---|
| `vite-plugin-dts` | Generate `.d.ts` files in library mode |
| `@vitejs/plugin-legacy` | IE11 / old browser support via Babel |
| `vite-plugin-pwa` | Service Worker + Web App Manifest |
| `vite-plugin-checker` | TypeScript type-check in dev server |
| `unplugin-vue-components` | Auto-import Vue components |
| `unplugin-auto-import` | Auto-import composables/APIs |

Install these as `devDependencies` only.
