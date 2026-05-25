# Vite 7 — Config Basics

`vite.config.ts` reference: all common fields, HMR API, env variables, dev proxy.

## defineConfig

Always use `defineConfig` for IntelliSense:

```ts
import { defineConfig } from 'vite'

export default defineConfig({
  // config here
})
```

For conditional config:

```ts
export default defineConfig(({ command, mode, isSsrBuild }) => {
  if (command === 'serve') {
    return { /* dev-only config */ }
  } else {
    return { /* build-only config */ }
  }
})
```

## Root, Base, PublicDir

```ts
export default defineConfig({
  root: process.cwd(),         // project root (default)
  base: '/',                   // public URL prefix — CHANGE for sub-path deploys
  publicDir: 'public',         // static assets, copied as-is (default)
  envDir: process.cwd(),       // where .env files live
  cacheDir: '.vite',           // dep pre-bundle cache (default)
})
```

**`base` gotcha**: if your app deploys to `https://example.com/app/`, set `base: '/app/'`. Wrong base silently breaks all `<script>` and `<link>` URLs in production HTML.

## resolve.alias

Always use `path.resolve` — relative strings silently break in monorepos:

```ts
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@utils': path.resolve(__dirname, 'src/utils'),
    },
  },
})
```

For TypeScript: mirror aliases in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

## define — Compile-time Constants

`define` replaces identifiers at build time (like `#define` in C). The value is substituted literally — always `JSON.stringify` strings:

```ts
import pkg from './package.json' assert { type: 'json' }

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
    __FEATURE_FLAG__: 'true',         // raw boolean substitution
  },
})
```

**Not for runtime env vars**: `define` is a static substitution, not a runtime env injection. Use `import.meta.env` for runtime vars.

## Env Variables

Files (loaded in priority order, higher overrides lower):
1. `.env`
2. `.env.local` (gitignored — for secrets)
3. `.env.[mode]` (e.g., `.env.production`)
4. `.env.[mode].local`

**Only `VITE_`-prefixed vars are exposed to client code.** Vars without the prefix are server-only and not bundled.

```ts
// .env.production
VITE_API_URL=https://api.example.com
DATABASE_URL=postgres://...   # server-only, not bundled

// In source:
const api = import.meta.env.VITE_API_URL   // exposed
// import.meta.env.DATABASE_URL === undefined  // not exposed
```

Built-in env vars (always available):
- `import.meta.env.MODE` — `'development'` | `'production'` | custom string
- `import.meta.env.DEV` — boolean, true in dev
- `import.meta.env.PROD` — boolean, true in production
- `import.meta.env.SSR` — boolean, true in SSR context
- `import.meta.env.BASE_URL` — the `base` config value

### TypeScript env var types

Create `src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_APP_TITLE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

## Dev Server

```ts
export default defineConfig({
  server: {
    host: '0.0.0.0',    // expose to LAN (default: 'localhost')
    port: 5173,          // default
    strictPort: true,    // fail if port is taken (default: false, finds next free)
    open: true,          // open browser on start
    cors: true,          // enable CORS headers in dev
    https: {             // optional TLS
      key: fs.readFileSync('key.pem'),
      cert: fs.readFileSync('cert.pem'),
    },
  },
})
```

### server.proxy

```ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3001',
      changeOrigin: true,           // rewrite Host header (required for virtual-host backends)
      rewrite: (path) => path.replace(/^\/api/, ''),
    },
    '/ws': {
      target: 'ws://localhost:3001',
      ws: true,                     // proxy WebSocket connections
    },
    // Regex pattern proxy:
    '^/fallback/.*': {
      target: 'http://localhost:3002',
      changeOrigin: true,
    },
  },
},
```

Proxy is **dev-only**. It has no effect in `vite build`.

## Build Options

```ts
export default defineConfig({
  build: {
    outDir: 'dist',                   // output directory
    target: 'es2020',                 // JS syntax target (default: 'modules')
    sourcemap: true,                  // true | 'inline' | 'hidden' | false
    minify: 'esbuild',                // 'esbuild' (default) | 'terser' | false
    assetsInlineLimit: 4096,          // files < 4kB inlined as base64
    chunkSizeWarningLimit: 500,       // kB threshold (default: 500)
    emptyOutDir: true,                // clear outDir before build
    reportCompressedSize: true,       // show gzip sizes in output
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
})
```

### build.target values

| Target | Means |
|---|---|
| `'modules'` (default) | `es2015` + `import.meta` + dynamic import — Safari 10.1+, Chrome 61+ |
| `'esnext'` | Latest ES — no downleveling, smallest output |
| `'es2020'` | Explicit ES2020 support |
| `'chrome90'` | Specific browser |
| `['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14']` | Multi-target array |

Use `'esnext'` for modern-only deployments. Use `'es2015'` for IE11 polyfill compat.

## HMR API

`import.meta.hot` is the client-side HMR interface. Available only in dev — always guard it:

```ts
// Self-accept: this module handles its own updates
if (import.meta.hot) {
  import.meta.hot.accept((newModule) => {
    // Called when this module or its deps update
    // newModule is the updated version
    if (newModule) {
      // re-run initialization
    }
  })
}
```

### Accepting specific dependencies

```ts
if (import.meta.hot) {
  import.meta.hot.accept(['./foo', './bar'], ([newFoo, newBar]) => {
    // Handle updates from foo or bar
  })
}
```

### Cleanup on module disposal

```ts
let timer: ReturnType<typeof setInterval>
timer = setInterval(() => console.log('tick'), 1000)

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    clearInterval(timer)   // cleanup before this module is replaced
  })
}
```

### Force full page reload

```ts
if (import.meta.hot) {
  import.meta.hot.decline()   // this module cannot hot-update, force reload
}
```

### Invalidate module

```ts
if (import.meta.hot) {
  import.meta.hot.invalidate('Reason for invalidation')
  // Triggers a full reload cascade from this module upward
}
```

### Custom HMR events (plugin ↔ client)

```ts
// In client code:
if (import.meta.hot) {
  import.meta.hot.on('my-custom-event', (data) => {
    console.log('Received from server plugin:', data)
  })
}

// In plugin (server side):
server.hot.send('my-custom-event', { payload: 'value' })
```

## CSS Handling

Vite handles CSS out of the box:
- `.css` files: imported, injected via `<style>` tag, HMR-enabled
- `.module.css`: CSS Modules, returns object of hashed class names
- `.scss` / `.sass`: requires `sass` package installed
- PostCSS: auto-detected from `postcss.config.js` or `vite.config.ts`

```ts
// Enable PostCSS in config
export default defineConfig({
  css: {
    postcss: {
      plugins: [autoprefixer(), tailwindcss()],
    },
    modules: {
      localsConvention: 'camelCase',   // 'my-class' → 'myClass'
    },
    preprocessorOptions: {
      scss: {
        additionalData: '@use "@/styles/variables" as *;',
      },
    },
  },
})
```

## Static Assets

Files in `publicDir` are served at root and copied as-is (no hash):
- Use for `favicon.ico`, `robots.txt`, `manifest.json`
- Reference as `/favicon.ico` (absolute path)

Files imported in JS/CSS get content-hashed names:
```ts
import logoUrl from './logo.svg'   // → '/assets/logo-abc123.svg'
```

Force URL-only (no inline), override inline limit:
```ts
import largeImg from './bg.png?url'   // always URL, never inline
import smallIcon from './icon.svg?inline'  // always inline as base64
```

Raw file content:
```ts
import rawSvg from './icon.svg?raw'   // string of SVG markup
```

## Worker Threads (Web Workers)

```ts
// Import as constructor
import MyWorker from './worker.ts?worker'
const worker = new MyWorker()

// Import as URL
import workerUrl from './worker.ts?worker&url'
```

Inline workers (small, bundled into main chunk):
```ts
import InlineWorker from './worker.ts?worker&inline'
```
