# Vite 7 — Troubleshooting

Common Vite errors, HMR failures, and fix patterns.

## HMR Not Working

### Symptoms
- Page doesn't update on file save, or requires full reload

### Diagnosis
1. Check browser console for HMR messages
2. Check terminal for `[vite] hmr update` lines
3. Check if module uses `import.meta.hot`

### Fixes

**Module not accepting updates** (most common):

The module updated but nothing accepted the change — Vite falls back to full reload. Add self-accept in the module or an ancestor:

```ts
// Option A: self-accept in the changed module
if (import.meta.hot) {
  import.meta.hot.accept()
}

// Option B: framework plugin handles it automatically
// @vitejs/plugin-react-swc inserts accept() calls for you
```

**Circular dependency breaking HMR boundary**:

A → B → A circular imports prevent HMR from knowing where to stop. Break the circle.

**HMR boundary exceeded**:

```
[vite] page reload src/data/constants.ts
```

`constants.ts` updated but the HMR chain reached the root without finding an acceptor — full reload. Move the constant to a module that self-accepts, or put it in a virtual module.

**File outside root**:

Vite only watches files inside `root`. Symlinked packages from a monorepo need:

```ts
server: {
  watch: {
    // Watch symlink targets
    followSymlinks: true,
  },
}
```

Or: `resolve: { preserveSymlinks: true }`.

---

## CJS/ESM Interop Errors

### Error: `require is not defined in ES module scope`

Your code runs in ESM context but imports a CJS package that uses `require`.

**Fix 1**: The package is already ESM — use `import` directly.

**Fix 2**: If the package is CJS-only and not in `node_modules`, add to `optimizeDeps.include`:

```ts
optimizeDeps: {
  include: ['my-cjs-package'],
}
```

Pre-bundling converts CJS to ESM.

### Error: `does not provide an export named 'default'`

Package has a CJS default export but you're importing it as ESM:

```ts
// This fails if the package is CJS-only:
import { something } from 'cjs-package'

// Fix:
import cjsPkg from 'cjs-package'
const { something } = cjsPkg
```

Or add to `optimizeDeps.include` so Vite converts it.

### Error: `Module externalized for browser compatibility`

Node built-in (`fs`, `path`, `crypto`) imported in browser code:

```
Module "fs" has been externalized for browser compatibility. Cannot access "fs.readFileSync" in client code.
```

**Fix**: the imported module should not be running in the browser. Either:
- Separate server and client code
- Use the browser-compatible alternative (e.g., `SubtleCrypto` instead of `node:crypto`)
- Guard with `if (import.meta.env.SSR)`

---

## Alias Not Resolving

### Symptom
Import with `@/` alias throws "Cannot find module"

### Common Cause
Alias uses relative path instead of absolute:

```ts
// BAD — relative paths silently break in monorepos/unusual setups
resolve: { alias: { '@': './src' } }

// GOOD — always absolute
import path from 'node:path'
resolve: { alias: { '@': path.resolve(__dirname, 'src') } }
// or with import.meta.url:
resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } }
```

### Also check
- TypeScript `paths` in `tsconfig.json` matches the Vite alias
- `tsconfig.json` is in the project root (or `vite.config.ts` resolves the right one)

---

## "New dependency detected. Restarting server"

Vite re-bundles deps when it discovers new ones dynamically. In large apps this can happen on every page navigation.

**Fix**: pre-declare all deps:

```ts
optimizeDeps: {
  include: ['lodash-es', 'date-fns', /* all dynamic deps */],
}
```

Or set `optimizeDeps.holdUntilCrawlEnd: false` to avoid the restart at the cost of loading some deps unbundled initially.

---

## Missing Environment Variables

### Symptom
`import.meta.env.VITE_MY_VAR` is `undefined`

### Checklist
1. Variable name starts with `VITE_`
2. `.env` file is in `envDir` (default: project root)
3. Mode matches — `.env.production` only loads with `vite build`
4. Restart the dev server after adding new `.env` vars (Vite reads them on start)

---

## `base` URL Broken in Production

### Symptom
Assets 404 in production; works fine in dev

### Cause
App deployed to sub-path but `base` not set:

```ts
// For https://example.com/my-app/
export default defineConfig({
  base: '/my-app/',   // must match deployment path, including trailing slash
})
```

**Verify**: run `vite preview` locally and check URLs in generated HTML.

---

## `vite build` Much Slower Than Expected

### Causes and fixes

**Terser minification**: switch to esbuild:
```ts
build: { minify: 'esbuild' }
```

**Source maps**: disable if not needed:
```ts
build: { sourcemap: false }
```

**Large vendor chunk**: check bundle visualizer — a massive vendor bundle means all deps are in one entry. Use `manualChunks`.

**Type checking in build**: Vite doesn't type-check by default. If you added `tsc` as a pre-build step, that's the bottleneck. Move type-checking to CI-only or `vite-plugin-checker` in background.

---

## `import.meta.glob` Returns Empty Object

### Cause
Pattern doesn't match any files, or files are outside `root`.

### Debug
```ts
// Log what glob returns
const modules = import.meta.glob('./pages/**/*.tsx')
console.log(Object.keys(modules))
```

Globs are relative to the **importing file**, not project root. `./pages/**/*.tsx` from `src/router.ts` resolves to `src/pages/**/*.tsx`.

---

## Port Already in Use

```bash
Error: listen EADDRINUSE: address already in use :::5173
```

**Fix**:
```ts
server: { port: 5174 }   // or any other port

// Or auto-find next free port:
server: { port: 5173, strictPort: false }  // default behavior
```

---

## "Failed to fetch dynamically imported module"

### In production

Usually means code-split chunk URL is wrong due to incorrect `base`. Fix: set `base` explicitly.

### In dev

Module has a syntax error — browser failed to parse it. Check the console for the actual parse error.

---

## Large CSS Bundle After Tailwind

Tailwind 4.x with Vite: ensure you're using the Vite plugin, not PostCSS-only:

```ts
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss()],  // uses Vite-native integration, faster + tree-shaken
})
```

Do NOT use `@tailwindcss/postcss` via `css.postcss` in Vite — it's slower and can produce duplicate CSS.
