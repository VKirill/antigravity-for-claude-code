# Vite 7 — Performance

Build performance, dev server startup, bundle optimization.

## Dev Server Architecture

Vite dev server does NOT bundle on startup. Instead:

1. **esbuild** pre-bundles `node_modules` dependencies once (saved to `.vite/deps`)
2. Browser requests individual source files
3. **esbuild** transforms each file on request (TypeScript, JSX, etc.)
4. HMR invalidates only changed modules

Cold start is fast because Vite doesn't bundle your app — it serves native ES modules directly.

## Dependency Pre-Bundling

Vite pre-bundles `node_modules` with esbuild for two reasons:
1. Convert CJS/UMD dependencies to ESM
2. Bundle packages with many internal modules into one (prevents hundreds of HTTP requests)

Pre-bundle cache lives in `node_modules/.vite/deps` (or `<cacheDir>/deps`).

### Force re-bundling

```bash
# Clear dep cache and restart
vite --force
```

### Configure pre-bundling

```ts
optimizeDeps: {
  // Extra deps to force-include (not auto-detected)
  include: ['lodash-es', 'some-cjs-package'],

  // Exclude from pre-bundling (rarely needed)
  exclude: ['@local/package'],

  // Pass options to esbuild for dep transforms
  esbuildOptions: {
    target: 'es2020',
  },

  // Discover and pre-bundle deps in these patterns
  entries: ['./src/**/*.ts', './src/**/*.tsx'],
}
```

**When to use `include`**: dynamic imports inside `try/catch`, packages not directly imported but needed at runtime, packages that esbuild fails to auto-detect.

### "New dependency discovered" restarts

When Vite detects a new dependency during dev, it restarts the server to re-bundle deps. To prevent this in large apps:

```ts
optimizeDeps: {
  // Pre-declare all deps you know will be used
  include: [...allKnownDeps],
}
```

## Chunk Splitting Strategy

Rollup's default auto-splitting is good but not always optimal. Use `manualChunks` for control:

```ts
build: {
  rollupOptions: {
    output: {
      manualChunks(id) {
        // Vendor chunk: all node_modules
        if (id.includes('node_modules')) {
          // Group large deps separately
          if (id.includes('react')) return 'react-vendor'
          if (id.includes('@radix-ui')) return 'radix-vendor'
          return 'vendor'
        }
        // App chunks by feature
        if (id.includes('/features/auth/')) return 'auth'
        if (id.includes('/features/dashboard/')) return 'dashboard'
      },
    },
  },
}
```

**Object form** (simpler but less control):

```ts
manualChunks: {
  'react-vendor': ['react', 'react-dom', 'react-router-dom'],
  'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
}
```

**Avoid**: putting all deps in one `vendor` chunk — it busts cache on every dep update. Split by change frequency.

## build.target

Setting the right target avoids unnecessary polyfills and transforms:

```ts
build: {
  // Modern-only (best for internal tools, greenfield apps)
  target: 'esnext',     // No transforms, ~15% smaller output

  // Safe for 2023+ browsers
  target: 'es2020',

  // Vite default — broadest compatibility
  target: 'modules',   // = ['es2015', 'import.meta', 'dynamic-import']
}
```

Check your actual browser support requirements before setting `esnext` in production.

## Source Maps

```ts
build: {
  sourcemap: true,          // Full external .map files (adds to build time)
  sourcemap: 'inline',      // Inline in each JS file (bigger files, good for lambda)
  sourcemap: 'hidden',      // External .map, no sourceMappingURL comment (for error tracking only)
}
```

In dev: source maps are always generated (fast, via esbuild).

In CI/production: only generate if you have an error tracking service ingesting them. `'hidden'` avoids exposing source to users while still sending maps to Sentry etc.

## Assets

```ts
build: {
  // Files smaller than this are inlined as base64 (default: 4096 bytes)
  assetsInlineLimit: 4096,

  // For SVG: often better to NOT inline (prevents CSP issues)
  assetsInlineLimit(filePath, content) {
    if (filePath.endsWith('.svg')) return false
    return content.length < 4096
  },
}
```

Content-hashed filenames in production:
```ts
rollupOptions: {
  output: {
    assetFileNames: 'assets/[name]-[hash][extname]',
    chunkFileNames: 'assets/[name]-[hash].js',
    entryFileNames: 'assets/[name]-[hash].js',
  },
}
```

## Minification

```ts
build: {
  minify: 'esbuild',      // Default — very fast, good compression
  minify: 'terser',       // Slower, ~5-10% smaller output — worth it for public libs
  minify: false,          // No minification (debugging production issues)

  // Terser options (only when minify: 'terser'):
  terserOptions: {
    compress: {
      drop_console: true,
      drop_debugger: true,
    },
  },
}
```

**Rule**: use `'esbuild'` for app builds. Use `'terser'` for published libraries where bundle size matters most.

## Warm Cache (Vite 6+, current in Vite 7)

Vite 6 introduced **warm cache** for dev: commonly imported modules are pre-transformed before the browser requests them. Vite 7 keeps the same `server.warmup` shape. Configure the warmup list:

```ts
server: {
  warmup: {
    // Pre-transform these modules on dev server start
    clientFiles: [
      './src/main.ts',
      './src/App.tsx',
      './src/components/**/*.tsx',
    ],
    // Pre-transform SSR modules (only used with ssrLoadModule)
    ssrFiles: [
      './src/entry-server.ts',
    ],
  },
}
```

This reduces first-request latency in large apps. Don't add every file — focus on the critical path.

## Analyzing Bundle Size

```bash
# Generate stats.html with bundle visualization
npx vite-bundle-visualizer
# or
npx rollup-plugin-visualizer
```

```ts
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    visualizer({
      filename: 'dist/stats.html',
      open: true,   // Auto-open after build
      gzipSize: true,
      brotliSize: true,
    }),
  ],
})
```

## Worker Threads for CPU Work

Vite itself runs transforms in worker threads (via esbuild). Your config runs in the main thread — keep it fast (no heavy synchronous work in `config` or `buildStart` hooks).

## Large Monorepo Tips

```ts
resolve: {
  // Reduce filesystem traversal in monorepos
  preserveSymlinks: true,   // Don't resolve symlinks (faster for pnpm workspaces)
}

server: {
  // Disable CORS for internal LAN dev (reduces OPTIONS preflight overhead)
  cors: false,

  // Watch fewer files to reduce inotify usage
  watch: {
    ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
  },
}
```
