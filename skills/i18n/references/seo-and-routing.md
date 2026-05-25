# SEO and routing

Locale-prefixed URLs, hreflang, sitemap, canonical, redirect strategies. Applies to both next-intl and `@nuxtjs/i18n`.

## URL strategy decision

Three viable strategies:

| Strategy | URL example | Pro | Con |
|---|---|---|---|
| `always` / `prefix` | `/en/about`, `/ru/about` | Clearest for crawlers, no ambiguity | Default-locale users see prefix |
| `as-needed` / `prefix_except_default` | `/about` (en), `/ru/about` | Clean default URL, prefix only for non-default | Default locale is implicit |
| `never` / `no_prefix` | `/about` (locale in cookie) | Pretty URLs | Bad for SEO — same URL serves different content |

**Recommendation:**
- Public marketing sites with SEO requirements → `always` (next-intl) / `prefix` (Nuxt)
- App-first products where the default locale dominates → `as-needed` / `prefix_except_default`
- Never `no_prefix` for public sites

Mixing strategies in one app is a configuration smell — don't.

## hreflang — what Google needs

For every page that exists in multiple locales, emit `<link rel="alternate" hreflang="..." href="...">` for each language version PLUS `x-default`:

```html
<link rel="alternate" hreflang="en" href="https://example.com/about" />
<link rel="alternate" hreflang="ru" href="https://example.com/ru/about" />
<link rel="alternate" hreflang="de" href="https://example.com/de/ueber-uns" />
<link rel="alternate" hreflang="x-default" href="https://example.com/about" />
```

`x-default` tells search engines which URL to show when no language matches.

### next-intl — hreflang via metadata

```tsx
// app/[locale]/about/page.tsx
import {getTranslations} from 'next-intl/server';
import {routing} from '@/i18n/routing';
import {getPathname} from '@/i18n/navigation';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: 'AboutPage'});

  const languages = Object.fromEntries(
    routing.locales.map((loc) => [loc, getPathname({locale: loc, href: '/about'})])
  );

  return {
    title: t('title'),
    alternates: {
      canonical: getPathname({locale, href: '/about'}),
      languages: {
        ...languages,
        'x-default': getPathname({locale: routing.defaultLocale, href: '/about'})
      }
    }
  };
}
```

Next.js converts `alternates.languages` to `<link rel="alternate" hreflang="...">` tags.

### Nuxt — hreflang via `useLocaleHead`

```vue
<script setup>
const head = useLocaleHead({addSeoAttributes: true});
</script>

<template>
  <Html :lang="head.htmlAttrs.lang" :dir="head.htmlAttrs.dir">
    <Head>
      <template v-for="link in head.link" :key="link.id">
        <Link :id="link.id" :rel="link.rel" :href="link.href" :hreflang="link.hreflang" />
      </template>
      <template v-for="meta in head.meta" :key="meta.id">
        <Meta :id="meta.id" :property="meta.property" :content="meta.content" />
      </template>
    </Head>
  </Html>
</template>
```

`@nuxtjs/i18n` emits the `<link rel="alternate">` tags automatically when `useLocaleHead({addSeoAttributes: true})` is called.

## Canonical URLs

Each locale page is its own canonical URL — never canonicalize `/ru/about` → `/about`. That would tell search engines "ignore my Russian version".

```html
<!-- on /ru/about -->
<link rel="canonical" href="https://example.com/ru/about" />
```

Both next-intl (`alternates.canonical`) and Nuxt (`useLocaleHead`) emit this correctly when configured.

## `<html lang>` and `<html dir>`

Always set:

```html
<html lang="ru" dir="ltr">
<html lang="ar" dir="rtl">
```

### next-intl

```tsx
// app/[locale]/layout.tsx
export default async function LocaleLayout({children, params}: Props) {
  const {locale} = await params;
  return <html lang={locale}>{/* ... */}</html>;
}
```

For RTL, map locale → direction:

```tsx
const dir = ['ar', 'he', 'fa'].includes(locale) ? 'rtl' : 'ltr';
return <html lang={locale} dir={dir}>...</html>;
```

### Nuxt

Set `dir` on each locale in `nuxt.config.ts`:

```ts
i18n: {
  locales: [
    {code: 'en', dir: 'ltr', file: 'en.json'},
    {code: 'ar', dir: 'rtl', file: 'ar.json'}
  ]
}
```

`useLocaleHead({addDirAttribute: true})` will set `dir` on `<html>`.

## Sitemap per locale

Search engines expect one sitemap entry per locale per page, OR a single entry with `xhtml:link` siblings.

### next-intl — `app/sitemap.ts`

```ts
import {MetadataRoute} from 'next';
import {routing} from '@/i18n/routing';
import {getPathname} from '@/i18n/navigation';

const HOST = 'https://example.com';

function localizedUrl(href: string) {
  return {
    url: `${HOST}${getPathname({locale: routing.defaultLocale, href})}`,
    alternates: {
      languages: Object.fromEntries(
        routing.locales.map((locale) => [locale, `${HOST}${getPathname({locale, href})}`])
      )
    }
  };
}

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    localizedUrl('/'),
    localizedUrl('/about'),
    localizedUrl('/blog')
  ];
}
```

### Nuxt — `@nuxtjs/sitemap` integration

`@nuxtjs/i18n` 8+ integrates automatically with `@nuxtjs/sitemap` when both are installed. URLs are emitted per locale.

## `robots.txt`

```
User-agent: *
Allow: /

Sitemap: https://example.com/sitemap.xml
```

A single sitemap covers all locales when `alternates.languages` is used (see above). No need for per-locale sitemaps unless the site is huge.

## Redirects

### Root URL → default locale

For `prefix` / `always` strategies, `/` should redirect to `/en/`:

next-intl middleware does this automatically (`localePrefix: 'always'`).

Nuxt `@nuxtjs/i18n` `rootRedirect`:

```ts
i18n: {
  strategy: 'prefix',
  rootRedirect: {statusCode: 301, path: '/en'}
}
```

### Browser language detection

Detect `Accept-Language` and redirect first-time visitors to their preferred locale.

next-intl `defineRouting`:

```ts
defineRouting({
  locales: ['en', 'ru'],
  defaultLocale: 'en',
  localeDetection: true // default
});
```

Nuxt:

```ts
i18n: {
  detectBrowserLanguage: {
    useCookie: true,
    cookieKey: 'i18n_redirected',
    redirectOn: 'root',           // only redirect from /, never deeper
    fallbackLocale: 'en'
  }
}
```

**Important:** `redirectOn: 'root'` is recommended for SEO — redirecting on every path breaks deep links and creates duplicate-content signals.

## Locale in URL — encoding

Locale codes follow BCP 47:
- Language only: `en`, `ru`, `de`
- Language + region: `en-US`, `pt-BR`, `zh-Hans`

URLs use the literal code: `/en-US/about`, NOT `/en_US/about` or `/enUS/about`.

For language+region pages, decide whether to keep all (e.g., `en-US` and `en-GB` as separate locales) or collapse to `en` and use a country selector. Separate locales = better translation control; more files to maintain.

## Common mistakes

- Same URL serving different languages based on cookie → Google indexes one version only
- Missing `x-default` hreflang → search engine has no preference signal for unknown-language users
- Canonical pointing to default locale from all pages → non-default versions get de-indexed
- `hreflang="en_US"` instead of `hreflang="en-US"` → invalid, ignored
- Forgetting `<html lang>` → screen readers and search engines treat as default language
- RTL not setting `dir="rtl"` → broken layout, search engine still indexes but rankings suffer

See [troubleshooting.md](troubleshooting.md) for diagnostic checklist.

## Related

- [next-intl.md](next-intl.md) — middleware, `pathnames`, navigation helpers
- [vue-i18n.md](vue-i18n.md) — Nuxt `strategy`, `useLocaleHead`
- [dynamic-and-runtime.md](dynamic-and-runtime.md) — locale switcher that preserves path
