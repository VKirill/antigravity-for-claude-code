# SEO with `useSeoMeta` in Nuxt 4

Full example: per-page SEO tags including Open Graph, Twitter Card, canonical URL, and structured data.

## Global defaults — `nuxt.config.ts`

```ts
export default defineNuxtConfig({
  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      htmlAttrs: { lang: 'en' },
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon.png' },
      ],
    }
  }
})
```

## `useSeoMeta` — per-page (recommended)

`useSeoMeta` is the type-safe composable for Open Graph / Twitter Card / canonical tags. It validates tag names at compile time:

```vue
<!-- app/pages/blog/[slug].vue -->
<script setup lang="ts">
const route = useRoute()
const config = useRuntimeConfig()

const { data: post } = await useFetch(`/api/blog/${route.params.slug}`)

useSeoMeta({
  // Standard
  title:              () => post.value?.title ?? 'Blog',
  description:        () => post.value?.excerpt ?? '',

  // Open Graph
  ogTitle:            () => post.value?.title ?? '',
  ogDescription:      () => post.value?.excerpt ?? '',
  ogImage:            () => post.value?.coverImage ?? `${config.public.siteUrl}/og-default.jpg`,
  ogType:             'article',
  ogUrl:              () => `${config.public.siteUrl}/blog/${route.params.slug}`,
  ogSiteName:         'My Blog',

  // Twitter Card
  twitterCard:        'summary_large_image',
  twitterTitle:       () => post.value?.title ?? '',
  twitterDescription: () => post.value?.excerpt ?? '',
  twitterImage:       () => post.value?.coverImage ?? `${config.public.siteUrl}/og-default.jpg`,

  // Canonical
  canonical:          () => `${config.public.siteUrl}/blog/${route.params.slug}`,

  // Article-specific
  articlePublishedTime: () => post.value?.publishedAt ?? '',
  articleAuthor:        () => [`${config.public.siteUrl}/about`],
})
</script>

<template>
  <article v-if="post">
    <h1>{{ post.title }}</h1>
    <p>{{ post.excerpt }}</p>
    <!-- ... -->
  </article>
</template>
```

## `useHead` — for advanced / non-standard tags

Use `useHead` when you need tags not covered by `useSeoMeta`, or need to inject scripts/links:

```vue
<script setup lang="ts">
const route = useRoute()
const post = /* ... */

// Combine with useSeoMeta — they stack, not override
useSeoMeta({
  title: post.value?.title,
  description: post.value?.excerpt,
})

useHead({
  // JSON-LD structured data
  script: [
    {
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: post.value?.title,
        description: post.value?.excerpt,
        datePublished: post.value?.publishedAt,
        author: { '@type': 'Person', name: post.value?.authorName },
      })
    }
  ],
  // Alternate language versions
  link: [
    { rel: 'alternate', hreflang: 'es', href: `https://es.example.com/blog/${route.params.slug}` },
  ],
})
</script>
```

## Dynamic title template — `app/app.vue`

Set a title template so every page appends the site name:

```vue
<!-- app/app.vue -->
<script setup lang="ts">
useHead({
  titleTemplate: (titleChunk) =>
    titleChunk ? `${titleChunk} — My Site` : 'My Site',
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
```

Now each page sets `title: 'About'` and the rendered `<title>` is `About — My Site`.

## Reactive SEO (updates on navigation)

`useSeoMeta` and `useHead` are reactive — pass getter functions (arrows) to auto-update when data changes:

```ts
useSeoMeta({
  title: () => product.value?.name,        // updates when product loads
  ogImage: () => product.value?.image,
})
```

Static strings are set once. Getters (`() => value`) re-evaluate when their dependencies change.

## Programmatic OG image (`@nuxtjs/og-image`)

```ts
// nuxt.config.ts
modules: ['nuxt-og-image'],

// In page
defineOgImage({
  component: 'BlogPost',  // app/components/OgImage/BlogPost.vue
  title: post.value?.title,
  description: post.value?.excerpt,
})
```

## SEO checklist for a Nuxt page

- [ ] `useSeoMeta` called with `title`, `description`, `ogTitle`, `ogDescription`, `ogImage`, `ogUrl`
- [ ] Twitter Card tags: `twitterCard`, `twitterTitle`, `twitterImage`
- [ ] `canonical` tag points to the canonical URL (avoids duplicate content)
- [ ] `ogType` set: `website` (default), `article` (blog posts), `product` (e-commerce)
- [ ] Title template in `app.vue` appends site name
- [ ] `lang` attribute on `<html>` via `nuxt.config.ts` `htmlAttrs`
- [ ] JSON-LD structured data for articles, products, breadcrumbs
