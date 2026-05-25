# Integrations

Add framework support, MDX, Tailwind, and ecosystem helpers via `astro add <integration>`.

## Framework integrations

```bash
astro add react
astro add vue
astro add svelte
astro add solid
astro add preact
```

This installs the integration package, adds it to `astro.config.mjs`, and updates `tsconfig.json` for JSX. Multiple frameworks coexist — each island picks its own.

```js
// astro.config.mjs
import react from '@astrojs/react'
import vue from '@astrojs/vue'

export default defineConfig({
  integrations: [react(), vue()],
})
```

## MDX

```bash
astro add mdx
```

```mdx
---
title: A post with components
---
import { Counter } from '../components/Counter'

# {frontmatter.title}

A regular paragraph.

<Counter client:visible initial={5} />
```

MDX files participate in Content Collections like markdown — use the same `glob` loader.

### MDX with components shortcut

```ts
// src/content.config.ts
import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

const docs = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/data/docs' }),
  schema: z.object({ title: z.string() }),
})
```

Render with `render(entry)` returning `{ Content }`, which includes MDX components.

## Tailwind 4 (Vite plugin path)

Tailwind 4 uses a Vite plugin instead of the legacy `@astrojs/tailwind`:

```bash
npm install tailwindcss @tailwindcss/vite
```

```js
// astro.config.mjs
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  vite: { plugins: [tailwindcss()] },
})
```

```css
/* src/styles/global.css */
@import "tailwindcss";

@theme {
  --color-brand-50: oklch(0.97 0.03 220);
  --color-brand-500: oklch(0.55 0.18 220);
  --font-display: "Inter", sans-serif;
}
```

```astro
---
// src/layouts/Layout.astro
import '../styles/global.css'
---
<html>
  <head><slot name="head" /></head>
  <body class="bg-brand-50 font-display"><slot /></body>
</html>
```

## SEO helpers

### Sitemap

```bash
astro add sitemap
```

Auto-generates `dist/sitemap-index.xml` for static + prerendered pages. Set `site` in config:

```js
export default defineConfig({
  site: 'https://example.com',
  integrations: [sitemap()],
})
```

### RSS feed

```bash
npm install @astrojs/rss
```

```ts
// src/pages/rss.xml.ts
import rss from '@astrojs/rss'
import { getCollection } from 'astro:content'

export async function GET(context) {
  const posts = await getCollection('blog', ({ data }) => !data.draft)
  return rss({
    title: 'My Blog',
    description: 'Tech notes',
    site: context.site!.toString(),
    items: posts.map((p) => ({
      title: p.data.title,
      pubDate: p.data.pubDate,
      description: p.data.description,
      link: `/blog/${p.id}/`,
    })),
  })
}
```

### Open Graph & meta tags

No official integration — use `astro-seo` (community) or hand-roll:

```astro
---
// src/components/Seo.astro
interface Props {
  title: string
  description: string
  image?: string
}
const { title, description, image } = Astro.props
const url = new URL(Astro.url.pathname, Astro.site).toString()
---
<title>{title}</title>
<meta name="description" content={description} />
<link rel="canonical" href={url} />
<meta property="og:title" content={title} />
<meta property="og:description" content={description} />
<meta property="og:url" content={url} />
{image && <meta property="og:image" content={new URL(image, Astro.site).toString()} />}
<meta name="twitter:card" content="summary_large_image" />
```

## Images — `astro:assets`

Built-in, no integration needed. Use the `<Image />` component:

```astro
---
import { Image } from 'astro:assets'
import hero from '../assets/hero.jpg'
---
<Image src={hero} alt="Hero" widths={[400, 800, 1200]} sizes="(max-width: 768px) 100vw, 800px" />
```

Astro auto-generates responsive `srcset`, lazy-loads, and converts to WebP/AVIF. For remote images, configure `image.remotePatterns`:

```js
export default defineConfig({
  image: {
    remotePatterns: [{ protocol: 'https', hostname: '*.imgix.net' }],
  },
})
```

Then: `<Image src="https://cdn.imgix.net/photo.jpg" alt="..." width={800} height={600} />`.

## CMS integrations

Use community loaders or built-in `loader` functions:

| CMS | Loader |
|---|---|
| Contentful | `@astrojs/contentful` |
| Sanity | `@sanity/astro` |
| Storyblok | `@storyblok/astro` |
| Strapi | Community loader or fetch in custom loader |
| WordPress | REST API in custom loader (see `wordpress-developer` skill) |

## Other useful integrations

- `@astrojs/partytown` — runs third-party scripts in web worker
- `@astrojs/db` — Astro DB (libsql)
- `@playform/compress` — output HTML/CSS/JS minification
- `astro-icon` — Iconify integration

## Common pitfalls

- **Mixing legacy `@astrojs/tailwind` with Tailwind 4** — use the Vite plugin path
- **Heavy MDX components hydrated everywhere** — add `client:visible` per usage, not at the layout
- **Multiple Image processing services** — pick one; Sharp (Node) for build-time, or Cloudinary/Imgix for runtime
- **Sitemap missing pages** — sitemap only includes static + prerendered routes by default; configure `customPages` for SSR-only paths
- **`astro add` failing on a clean repo** — run `npm install` first; the CLI assumes a working node_modules
