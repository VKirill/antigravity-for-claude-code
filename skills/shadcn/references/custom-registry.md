# shadcn/ui — Custom Registry

## What is a registry?

A registry is a JSON endpoint that describes components, their source files, and their dependencies. When you run `npx shadcn add <url>/component-name`, the CLI fetches the registry manifest, resolves dependencies, installs npm packages, and writes source files to your project.

Use cases:
- Distribute an internal design system across multiple projects without an npm package
- Share company-specific components (auth forms, data tables, branded buttons) via a URL
- Maintain a versioned component library with changelogs
- Override shadcn default components with your own versions

## Registry structure

```
my-registry/
├── registry.json              # root manifest (optional)
└── r/
    ├── index.json             # component index
    ├── button.json            # per-component manifest
    ├── data-table.json
    └── files/
        ├── button.tsx
        └── data-table.tsx
```

When hosted at `https://components.example.com`, users run:
```bash
npx shadcn add https://components.example.com/r/button
```

## Per-component manifest format

```json
{
  "$schema": "https://ui.shadcn.com/schema/registry-item.json",
  "name": "data-table",
  "type": "registry:component",
  "title": "Data Table",
  "description": "Sortable, filterable data table with pagination.",
  "dependencies": [
    "@tanstack/react-table"
  ],
  "devDependencies": [],
  "registryDependencies": [
    "button",
    "input",
    "select",
    "https://components.example.com/r/pagination"
  ],
  "files": [
    {
      "path": "components/ui/data-table.tsx",
      "type": "registry:component",
      "target": "components/ui/data-table.tsx"
    },
    {
      "path": "hooks/use-data-table.ts",
      "type": "registry:hook",
      "target": "hooks/use-data-table.ts"
    }
  ],
  "cssVars": {
    "theme": {
      "--table-header-background": "210 40% 96.1%"
    }
  },
  "meta": {
    "importedTypes": ["Column", "ColumnDef", "VisibilityState"]
  }
}
```

## Manifest field reference

| Field | Required | Description |
|---|---|---|
| `name` | yes | URL slug — used as CLI argument |
| `type` | yes | `registry:component`, `registry:hook`, `registry:lib`, `registry:block`, `registry:page`, `registry:theme`, `registry:style` |
| `title` | no | Human-readable display name |
| `description` | no | Short description |
| `dependencies` | no | npm packages to install (runtime) |
| `devDependencies` | no | npm packages to install (dev) |
| `registryDependencies` | no | Other components to install first. Use component name for default registry, full URL for custom registry components |
| `files` | yes | Array of source files to copy |
| `cssVars` | no | CSS variables to inject into `globals.css` |
| `tailwind` | no | Tailwind config extensions (v3 only) |
| `docs` | no | URL to documentation |
| `categories` | no | Array of category tags |

## File entry format

```json
{
  "path": "components/ui/button.tsx",
  "type": "registry:component",
  "target": "components/ui/button.tsx",
  "content": "..."
}
```

`target` is relative to the project root (resolved via `components.json` aliases). `content` is optional — if omitted, CLI fetches from registry URL. If included, content is inlined into the manifest.

## Type values

| Type | Where it goes |
|---|---|
| `registry:component` | `components/ui/` (via alias) |
| `registry:hook` | `hooks/` (via alias) |
| `registry:lib` | `lib/` (via alias) |
| `registry:block` | Complex multi-file blocks |
| `registry:page` | Full page components |
| `registry:theme` | CSS variable theme overrides |
| `registry:style` | Global CSS additions |

## Hosting options

### Static JSON on CDN / GitHub Pages

Simplest approach — build time generates static JSON files.

```bash
# Host on GitHub Pages at https://yourname.github.io/my-registry/r/
# Add registry.json and component manifests to /r/ directory
# Deploy with GitHub Actions to GitHub Pages
```

### Next.js Route Handlers

Dynamic registry that can version-stamp manifests:

```ts
// app/r/[name]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { components } from "@/lib/registry"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params
  const component = components[name]
  if (!component) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(component)
}
```

### Monorepo internal registry

For a monorepo, you can point the registry at a local file path:

```bash
npx shadcn add ./packages/design-system/r/button.json
```

## Building a registry from source

Use `shadcn build` (in the shadcn repo) or write a build script:

```ts
// scripts/build-registry.ts
import fs from "node:fs/promises"
import path from "node:path"

const components = ["button", "data-table", "user-avatar"]

for (const name of components) {
  const source = await fs.readFile(`src/components/ui/${name}.tsx`, "utf-8")
  
  const manifest = {
    "$schema": "https://ui.shadcn.com/schema/registry-item.json",
    name,
    type: "registry:component",
    files: [{
      path: `components/ui/${name}.tsx`,
      type: "registry:component",
      content: source,
    }],
  }
  
  await fs.writeFile(`public/r/${name}.json`, JSON.stringify(manifest, null, 2))
}
```

## Overriding default shadcn components

To override a shadcn default component (e.g., `button`) with your custom version, name your registry item `button` and include it as a `registryDependency` in other components. Users who add your component first get your button; if they already have shadcn's button, they'll be prompted to overwrite.

## cssVars injection

CSS variables in the manifest are merged into `globals.css` on install:

```json
{
  "cssVars": {
    "theme": {
      "--chart-1": "12 76% 61%",
      "--chart-2": "173 58% 39%"
    },
    "dark": {
      "--chart-1": "220 70% 50%"
    }
  }
}
```

Generates:
```css
:root { --chart-1: 12 76% 61%; --chart-2: 173 58% 39%; }
.dark { --chart-1: 220 70% 50%; }
```
