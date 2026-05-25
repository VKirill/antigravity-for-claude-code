# Multi-Page App (MPA) with Vite

Multiple HTML entry points in one Vite project with shared chunk configuration.

## Scenario

A project with three separate HTML pages (not an SPA with client-side routing):
- `index.html` — marketing landing page
- `app/index.html` — dashboard application
- `admin/index.html` — admin panel

Each page loads its own JS/CSS bundle, with shared vendor code extracted into a common chunk.

## Project Structure

```
project/
├── index.html              ← landing page entry
├── app/
│   └── index.html          ← dashboard entry
├── admin/
│   └── index.html          ← admin entry
├── src/
│   ├── main-landing.ts     ← landing page JS
│   ├── main-app.ts         ← dashboard JS
│   ├── main-admin.ts       ← admin JS
│   └── shared/             ← shared utilities
│       ├── api.ts
│       └── utils.ts
├── vite.config.ts
└── package.json
```

## HTML Entry Points

```html
<!-- index.html (landing) -->
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Landing</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main-landing.ts"></script>
  </body>
</html>
```

```html
<!-- app/index.html (dashboard) -->
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Dashboard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main-app.ts"></script>
  </body>
</html>
```

## vite.config.ts

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'node:path'

export default defineConfig({
  root: process.cwd(),
  base: '/',

  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,

    rollupOptions: {
      // Multiple HTML entry points — Rollup builds each as a separate page
      input: {
        landing: path.resolve(__dirname, 'index.html'),
        app:     path.resolve(__dirname, 'app/index.html'),
        admin:   path.resolve(__dirname, 'admin/index.html'),
      },

      output: {
        // Content-hashed filenames
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',

        // Manual chunk splitting
        manualChunks(id) {
          // All node_modules → vendor chunk (shared by all pages)
          if (id.includes('node_modules')) {
            if (id.includes('react')) return 'react-vendor'
            return 'vendor'
          }
          // Shared source code → common chunk
          if (id.includes('/src/shared/')) return 'common'
        },
      },
    },
  },

  // Dev server: Vite serves all HTML files automatically
  // Navigate to:
  //   http://localhost:5173/          → landing
  //   http://localhost:5173/app/      → dashboard
  //   http://localhost:5173/admin/    → admin
  server: {
    port: 5173,
  },
})
```

## Output Structure

After `vite build`:

```
dist/
├── index.html                 ← landing page (scripts updated to hashed paths)
├── app/
│   └── index.html             ← dashboard
├── admin/
│   └── index.html             ← admin
└── assets/
    ├── react-vendor-abc123.js ← React + ReactDOM (shared)
    ├── vendor-def456.js       ← other node_modules (shared)
    ├── common-ghi789.js       ← src/shared/ (shared)
    ├── landing-jkl012.js      ← landing-only JS
    ├── app-mno345.js          ← dashboard-only JS
    └── admin-pqr678.js        ← admin-only JS
```

Each page's HTML file automatically gets `<script>` tags pointing to its entry chunk + the shared chunks it needs (Rollup figures out the dependency graph).

## Dev Server Navigation

In dev mode, all three pages are served automatically:
- `http://localhost:5173/` → landing
- `http://localhost:5173/app/` → dashboard
- `http://localhost:5173/admin/` → admin

No extra config needed — Vite serves HTML files by their filesystem path.

## Per-Page Plugins

To apply a plugin to only specific pages, use the `apply` option with a custom check:

```ts
function adminOnlyPlugin(): Plugin {
  return {
    name: 'admin-only',
    transformIndexHtml: {
      handler(html, ctx) {
        // Only transform the admin page HTML
        if (!ctx.filename.includes('admin')) return html
        return html.replace('</head>', `<meta name="robots" content="noindex" /></head>`)
      },
    },
  }
}
```

## TypeScript for Multiple Entries

If each page uses a different TS config (e.g., stricter settings for admin), use `tsconfig.json` references:

```json
// tsconfig.json (root — includes all)
{
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.admin.json" }
  ]
}
```

Vite resolves the nearest `tsconfig.json` automatically — no extra config needed.

## When to Use MPA vs SPA

| Use MPA when | Use SPA (with client router) when |
|---|---|
| Pages have completely different JS bundles | Pages share significant UI and state |
| SEO or crawlability per page matters | Routes need instant transitions without full reloads |
| Different tech stacks per page (e.g., React landing, Vue app) | Auth state needs to persist across routes |
| Admin is a separate security context | Deep linking and back-button behavior needed |
