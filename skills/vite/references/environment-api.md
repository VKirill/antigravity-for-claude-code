# Vite 7 — Environment API

Introduced in Vite 6, stabilized in Vite 7: first-class multi-environment support for client, SSR, and custom runtimes.

## Why Environment API

Before Vite 6, multi-environment builds (client + SSR) used implicit conventions (`ssr: true` flag, dual build passes). The Environment API makes environments explicit, composable, and extensible to custom runtimes like Cloudflare Workers, Deno, or edge functions. Vite 7 keeps the same surface as Vite 6 — no migration needed when bumping 6 → 7 for this API.

Each environment has its own:
- Module graph (no cross-contamination between client and server modules)
- Plugin pipeline (each plugin can opt into specific environments)
- Build configuration
- Runtime (browser, Node.js, workerd, etc.)

## Basic Configuration

```ts
// vite.config.ts
import { defineConfig } from 'vite'

export default defineConfig({
  environments: {
    // "client" is always present by default
    client: {
      build: {
        outDir: 'dist/client',
      },
    },
    // Add SSR environment
    ssr: {
      build: {
        outDir: 'dist/server',
        ssr: true,
        rollupOptions: {
          input: 'src/entry-server.ts',
        },
      },
    },
  },
})
```

## Environment-Aware Plugins

Plugins can restrict themselves to specific environments using `applyToEnvironment`:

```ts
import type { Plugin } from 'vite'

function ssrOnlyPlugin(): Plugin {
  return {
    name: 'ssr-only',

    applyToEnvironment(environment) {
      // Only run in the 'ssr' environment
      return environment.name === 'ssr'
    },

    transform(code, id) {
      // This transform only runs in SSR context
      return code
    },
  }
}
```

Available on all plugin hooks that have per-environment meaning: `transform`, `load`, `resolveId`, `handleHotUpdate`.

## Accessing Environment in Hooks

The current environment is available as `this.environment` inside hooks:

```ts
{
  name: 'env-aware-plugin',

  transform(code, id) {
    const env = this.environment
    if (env.name === 'client') {
      // Client-specific transform
    } else if (env.name === 'ssr') {
      // SSR-specific transform
    }
    return code
  },
}
```

## Custom Environments

Add environments for custom runtimes:

```ts
import { defineConfig, createNodeEnvironment } from 'vite'

export default defineConfig({
  environments: {
    client: {
      // browser environment (default)
    },
    ssr: {
      // Node.js SSR
      build: { ssr: true },
    },
    edge: {
      // Custom environment for edge runtime
      build: {
        outDir: 'dist/edge',
        rollupOptions: {
          input: 'src/entry-edge.ts',
          output: {
            format: 'esm',
          },
        },
      },
      resolve: {
        conditions: ['workerd', 'worker', 'browser', 'module', 'import'],
      },
    },
  },
})
```

## createEnvironment Factory

For fully custom runtimes, use `createEnvironment` to wrap a runtime adapter:

```ts
import { createEnvironment } from 'vite'
import { DenoEnvironment } from 'vite-deno-adapter'  // hypothetical

export default defineConfig({
  environments: {
    deno: createEnvironment(DenoEnvironment, {
      build: { outDir: 'dist/deno' },
    }),
  },
})
```

## Environment-Specific Resolve Conditions

Each environment can have different module resolution conditions:

```ts
environments: {
  client: {
    resolve: {
      conditions: ['browser', 'import', 'module'],
    },
  },
  ssr: {
    resolve: {
      conditions: ['node', 'import', 'module'],
      externalConditions: ['node'],  // used for external package resolution
    },
  },
}
```

## Dev Server Environment Access

In dev mode, access the environments from the dev server:

```ts
// In plugin configureServer hook:
configureServer(server) {
  const clientEnv = server.environments.client
  const ssrEnv = server.environments.ssr

  // Fetch a module from a specific environment
  server.middlewares.use(async (req, res) => {
    const mod = await ssrEnv.moduleGraph.getModuleByUrl('/src/entry.ts')
    // ...
  })
},
```

## Running Multiple Environments in Build

Build all environments in one pass:

```bash
vite build
# Builds all configured environments (client + ssr + any custom)
```

Or specify a single environment:

```bash
vite build --environment client
vite build --environment ssr
```

## Migration from Vite 5 SSR

Vite 5 SSR used `build.ssr` and separate config runs. Vite 6+ migration (still the recommended Vite 7 layout):

**Before (Vite 5):**
```ts
// Separate build commands:
// vite build
// vite build --ssr src/entry-server.ts

export default defineConfig({
  build: {
    ssr: process.env.BUILD_TARGET === 'server',
    outDir: process.env.BUILD_TARGET === 'server' ? 'dist/server' : 'dist/client',
  },
})
```

**After (Vite 6+ / Vite 7):**
```ts
export default defineConfig({
  environments: {
    client: { build: { outDir: 'dist/client' } },
    ssr: {
      build: {
        outDir: 'dist/server',
        ssr: true,
        rollupOptions: { input: 'src/entry-server.ts' },
      },
    },
  },
})
// Single command: vite build
```

## Environment API in Framework Authors

If you're building a Vite-based framework (not just using Vite in an app), the Environment API lets you define your environments in a plugin and expose them to users. See the [Vite Environment API docs](https://vite.dev/guide/api-environment) for the full plugin API surface (`createEnvironment`, `EnvironmentPlugin`, etc.).

## Checking Environment at Runtime

In source code, use `import.meta.env.SSR` for server detection:

```ts
if (import.meta.env.SSR) {
  // Server-side code — tree-shaken in client build
} else {
  // Client-side code — tree-shaken in SSR build
}
```

This works with both the old single-SSR-flag approach and the new Environment API.
