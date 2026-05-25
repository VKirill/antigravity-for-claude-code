# Content Collections (Content Layer API)

Type-safe content management. Define collections in `src/content.config.ts` with Zod schemas + a `loader`. Query with `getCollection()`/`getEntry()`. Auto-generated types via `astro sync`.

## Define a collection

```ts
// src/content.config.ts
import { defineCollection, z } from 'astro:content'
import { glob, file } from 'astro/loaders'

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/data/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string().max(160),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    author: z.string().default('Anonymous'),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    cover: z.object({
      src: z.string(),
      alt: z.string(),
    }).optional(),
  }),
})

const authors = defineCollection({
  loader: file('./src/data/authors.json'),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
    bio: z.string().optional(),
  }),
})

export const collections = { blog, authors }
```

After editing, run `astro sync` (or just `astro dev` — happens automatically) to regenerate types.

## Loaders

| Loader | Source |
|---|---|
| `glob({ pattern, base })` | Markdown/MDX/JSON files matching pattern |
| `file('./path.json')` | Single JSON file with array of entries |
| Custom loader function | API, CMS, database — see below |

## Custom loader (remote source)

```ts
import { defineCollection, z } from 'astro:content'
import type { Loader } from 'astro/loaders'

const productsLoader: Loader = {
  name: 'shopify-products',
  load: async ({ store, parseData, generateDigest }) => {
    const res = await fetch('https://shop.example.com/api/products.json')
    const products = await res.json()
    store.clear()
    for (const p of products) {
      const data = await parseData({ id: p.id, data: p })
      store.set({ id: p.id, data, digest: generateDigest(data) })
    }
  },
}

const products = defineCollection({
  loader: productsLoader,
  schema: z.object({
    id: z.string(),
    title: z.string(),
    price: z.number(),
    image: z.string().url(),
  }),
})
```

Use this pattern for headless CMS (Contentful, Sanity, Storyblok, Strapi) — install `@astrojs/contentful` etc. as ready-made loaders, or write your own.

## Querying collections

```astro
---
// src/pages/blog/index.astro
import { getCollection } from 'astro:content'

const posts = await getCollection('blog', ({ data }) => !data.draft)
const sorted = posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
---
<ul>
  {sorted.map((post) => (
    <li>
      <a href={`/blog/${post.id}`}>{post.data.title}</a>
      <time datetime={post.data.pubDate.toISOString()}>
        {post.data.pubDate.toLocaleDateString()}
      </time>
    </li>
  ))}
</ul>
```

```astro
---
// single entry
import { getEntry } from 'astro:content'

const author = await getEntry('authors', 'jane-doe')
---
<p>{author?.data.name}</p>
```

## Rendering markdown content

```astro
---
import { getEntry, render } from 'astro:content'

const post = await getEntry('blog', Astro.params.slug)
if (!post) return Astro.redirect('/404')

const { Content, headings, remarkPluginFrontmatter } = await render(post)
---
<article>
  <h1>{post.data.title}</h1>
  <Content />
</article>
```

`headings` returns `{ depth, slug, text }[]` — use for table-of-contents. `remarkPluginFrontmatter` includes any data injected by remark plugins (reading-time, etc.).

## Relations between collections

```ts
import { defineCollection, z, reference } from 'astro:content'

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/data/blog' }),
  schema: z.object({
    title: z.string(),
    author: reference('authors'),        // FK to authors collection
    related: z.array(reference('blog')).default([]),
  }),
})
```

Resolve on read:

```astro
---
import { getEntry, getEntries } from 'astro:content'

const post = await getEntry('blog', 'hello-world')
const author = await getEntry(post.data.author)         // resolves the reference
const related = await getEntries(post.data.related)
---
```

## Schema validation gotchas

- `z.coerce.date()` accepts ISO strings AND Date objects — use this for frontmatter dates
- `z.string().url()` validates absolute URLs only — for relative paths use `z.string().startsWith('/')`
- Image fields use the special `image()` helper:

```ts
import { defineCollection, z } from 'astro:content'

const blog = defineCollection({
  loader: /* ... */,
  schema: ({ image }) => z.object({
    title: z.string(),
    cover: image(),                       // resolves to ImageMetadata
    coverAlt: z.string(),
  }),
})
```

Then in the page:

```astro
---
import { Image } from 'astro:assets'
const { Content, data } = await render(post)
---
<Image src={data.cover} alt={data.coverAlt} />
```

## Common pitfalls

- Forgetting `astro sync` after editing `content.config.ts` → stale types
- Using `getCollection('blog')` with a filter that runs on every request in SSR — collections are loaded at build/server-start, not per-request
- Storing huge content collections in memory — `glob` materializes all entries; for >10k items use a paginated DB-backed loader
- Mixing draft posts into prod builds — filter `({ data }) => !data.draft` consistently
- Forgetting that `post.id` replaced `post.slug` in the Content Layer API
