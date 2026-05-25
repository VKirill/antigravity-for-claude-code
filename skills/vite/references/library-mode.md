# Vite 7 — Library Mode

Building a publishable component library or utility package with Vite.

## build.lib Configuration

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'node:path'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    react(),
    dts({
      include: ['src'],
      outDir: 'dist/types',
    }),
  ],
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),  // library entry point
      name: 'MyLib',                                    // UMD global name
      fileName: (format) => `my-lib.${format}.js`,      // output filename pattern
      formats: ['es', 'umd'],                           // output formats
    },
    rollupOptions: {
      // Externalize framework deps — NEVER bundle them
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        // UMD build: provide globals for externalized deps
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'ReactJSXRuntime',
        },
      },
    },
    // Clear dist before build
    emptyOutDir: true,
  },
})
```

## Output Formats

| Format | Use case | Extension |
|---|---|---|
| `es` | Modern bundlers (webpack, Rollup, Vite consumers) | `.mjs` or `.js` |
| `cjs` | Node.js CommonJS, older bundlers | `.cjs` or `.js` |
| `umd` | Direct `<script>` tag, AMD, CJS fallback | `.js` |
| `iife` | Direct `<script>` tag only, smallest | `.js` |

**2026 recommendation**: ship `['es', 'cjs']` — most consumers use ESM bundlers, CJS for Node compatibility. Skip UMD unless you need `<script>` tag support.

```ts
formats: ['es', 'cjs'],
fileName: (format) => `my-lib.${format === 'es' ? 'mjs' : 'cjs'}`,
```

## Externals — Critical Rule

Never bundle your peer dependencies. Consumers install them separately:

```ts
rollupOptions: {
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    // Regex for deep imports:
    /^react\//,
    /^react-dom\//,
  ],
}
```

In `package.json`, declare as `peerDependencies` (not `dependencies`):

```json
{
  "peerDependencies": {
    "react": ">=18.0.0",
    "react-dom": ">=18.0.0"
  },
  "devDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

## package.json exports for Dual CJS/ESM

Modern Node and bundlers respect the `exports` field:

```json
{
  "name": "my-lib",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/my-lib.cjs",
  "module": "./dist/my-lib.mjs",
  "types": "./dist/types/index.d.ts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/types/index.d.ts",
        "default": "./dist/my-lib.mjs"
      },
      "require": {
        "types": "./dist/types/index.d.ts",
        "default": "./dist/my-lib.cjs"
      }
    }
  },
  "files": ["dist"],
  "sideEffects": false
}
```

`"sideEffects": false` enables aggressive tree-shaking by consumers. Only set this if your library has no side effects (no CSS injection, no global mutations at import time).

## vite-plugin-dts

Generates TypeScript declaration files from your source:

```bash
npm install -D vite-plugin-dts
```

```ts
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    dts({
      include: ['src'],          // source dirs to process
      outDir: 'dist/types',      // where to write .d.ts files
      insertTypesEntry: true,    // add index.d.ts at outDir root
      rollupTypes: true,         // bundle all .d.ts into one file (cleaner)
      tsconfigPath: './tsconfig.build.json',
    }),
  ],
})
```

`rollupTypes: true` produces a single `dist/types/index.d.ts` instead of the mirrored source tree. Recommended for published libraries.

## Multi-Entry Libraries

Expose multiple entry points for consumers who import sub-paths:

```ts
build: {
  lib: {
    entry: {
      index: path.resolve(__dirname, 'src/index.ts'),
      utils: path.resolve(__dirname, 'src/utils/index.ts'),
      components: path.resolve(__dirname, 'src/components/index.ts'),
    },
    formats: ['es', 'cjs'],
    fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'mjs' : 'cjs'}`,
  },
}
```

```json
{
  "exports": {
    ".": { "import": "./dist/index.mjs", "require": "./dist/index.cjs" },
    "./utils": { "import": "./dist/utils.mjs", "require": "./dist/utils.cjs" },
    "./components": { "import": "./dist/components.mjs", "require": "./dist/components.cjs" }
  }
}
```

## CSS in Libraries

If your library imports CSS, bundling it into the JS causes FOUC. Options:

**Option A: Separate CSS file** (recommended for component libs)

```ts
rollupOptions: {
  output: {
    assetFileNames: (assetInfo) => {
      if (assetInfo.name?.endsWith('.css')) return 'style.css'
      return assetInfo.name ?? 'asset'
    },
  },
}
```

Consumers import `import 'my-lib/dist/style.css'` manually.

**Option B: CSS-in-JS** (no separate file needed) — use a CSS-in-JS solution that injects styles at runtime.

## Separate tsconfig for Library Build

Keep a `tsconfig.build.json` that excludes test files:

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["**/*.test.ts", "**/*.spec.ts", "src/__tests__"]
}
```

Reference it in vite config: `plugins: [dts({ tsconfigPath: './tsconfig.build.json' })]`

## Checklist Before Publishing

- [ ] `peerDependencies` lists all framework deps (React, Vue, etc.)
- [ ] `rollupOptions.external` excludes all peerDependencies
- [ ] `package.json` has `"exports"` field with both `"import"` and `"require"`
- [ ] `"sideEffects": false` if applicable
- [ ] `"files": ["dist"]` prevents publishing source
- [ ] TypeScript types are generated and listed in `"types"` / `"exports.*.types"`
- [ ] Built output tested with `npm pack` + manual import test
