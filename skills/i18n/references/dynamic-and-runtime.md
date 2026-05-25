# Dynamic and runtime patterns

Lazy loading locales, code-splitting per namespace, locale switcher patterns, RSC vs Client boundaries, browser detection.

## Why lazy-load locales

If you have 8 locales with 100 KB of messages each, bundling all of them ships 800 KB of JSON for every user — but each user reads exactly one locale. Lazy load by default once total locale size crosses ~50 KB.

## next-intl — per-locale lazy loading

`getRequestConfig` runs on the server per request, so non-default locale JSON is only loaded when needed:

```ts
// src/i18n/request.ts
import {getRequestConfig} from 'next-intl/server';

export default getRequestConfig(async ({requestLocale}) => {
  const locale = (await requestLocale) ?? 'en';
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default
  };
});
```

Webpack/Turbopack auto-splits each `messages/${locale}.json` into its own chunk. Server-side, only the active locale is loaded into memory per request.

### Per-namespace lazy loading

For pages with very specific messages, load only what's needed:

```ts
export default getRequestConfig(async ({requestLocale, request}) => {
  const locale = (await requestLocale) ?? 'en';
  const pathname = request?.nextUrl?.pathname ?? '/';

  // Always load common
  const common = (await import(`../../messages/${locale}/common.json`)).default;

  // Conditionally load page-scoped messages
  let pageMessages = {};
  if (pathname.startsWith('/checkout')) {
    pageMessages = (await import(`../../messages/${locale}/checkout.json`)).default;
  } else if (pathname.startsWith('/blog')) {
    pageMessages = (await import(`../../messages/${locale}/blog.json`)).default;
  }

  return {locale, messages: {Common: common, ...pageMessages}};
});
```

### Client bundle slimming

Server Components don't ship messages to the browser. Only `NextIntlClientProvider` ships them. To minimize the client bundle, pass a subset:

```tsx
import {NextIntlClientProvider, useMessages} from 'next-intl';
import pick from 'lodash/pick';

export default function ClientArea({children}: {children: React.ReactNode}) {
  const messages = useMessages();
  return (
    <NextIntlClientProvider messages={pick(messages, 'LoginForm', 'Nav')}>
      {children}
    </NextIntlClientProvider>
  );
}
```

## vue-i18n — lazy loading

Built-in for `@nuxtjs/i18n` — declare locales with `file` and lazy is automatic in Nuxt 4.

Raw vue-i18n SPA:

```ts
import {nextTick} from 'vue';
import {createI18n} from 'vue-i18n';

export const SUPPORT_LOCALES = ['en', 'ru', 'de'];

export const i18n = createI18n({
  locale: 'en',
  fallbackLocale: 'en',
  messages: {} // empty — load on demand
});

export async function loadLocaleMessages(locale: string) {
  if (i18n.global.availableLocales.includes(locale)) return;
  const messages = await import(`./locales/${locale}.json`);
  i18n.global.setLocaleMessage(locale, messages.default);
  return nextTick();
}

export function setI18nLanguage(locale: string) {
  i18n.global.locale.value = locale;
  document.documentElement.setAttribute('lang', locale);
  // Persist to cookie/localStorage if needed
  document.cookie = `locale=${locale}; path=/; max-age=31536000`;
}
```

Vite/Webpack split `./locales/${locale}.json` into per-locale chunks automatically.

## RSC vs Client boundary — when to put what

| Component type | Use | Why |
|---|---|---|
| Server Component | `getTranslations` (next-intl) | Translates at render time, no client JS |
| Client Component | `useTranslations` (next-intl) | Hook needs reactivity for `useLocale()` etc. |
| Any Vue component | `useI18n()` | Vue has no server/client split — same API |

**Rule for next-intl:** push as many translations into Server Components as possible. Only wrap interactive subtrees with `'use client'`. The locale-aware `Link` from `@/i18n/navigation` works in both — it doesn't force a client boundary.

### Anti-pattern: passing messages as props through layers

```tsx
// ❌ Don't do this
<ClientChild messages={messages} />
```

The `NextIntlClientProvider` already provides messages via context. Use `useTranslations` in the client child directly.

## Locale switcher patterns

The switcher must:
1. Show available locales
2. Preserve current path and query
3. Update `hreflang` / `lang` attributes
4. Persist user choice (cookie) so refreshes stick

### next-intl

```tsx
'use client';
import {useLocale} from 'next-intl';
import {usePathname, useRouter} from '@/i18n/navigation';
import {routing} from '@/i18n/routing';

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <select
      value={locale}
      onChange={(e) => {
        const next = e.target.value;
        router.replace(pathname, {locale: next});
      }}
    >
      {routing.locales.map((loc) => (
        <option key={loc} value={loc}>{loc}</option>
      ))}
    </select>
  );
}
```

`router.replace(pathname, {locale})` does the right thing — keeps the path, switches the prefix, sets cookie automatically.

### Nuxt (`@nuxtjs/i18n`)

```vue
<script setup>
const {locale, locales} = useI18n();
const switchLocalePath = useSwitchLocalePath();
</script>

<template>
  <NuxtLink
    v-for="loc in locales"
    :key="loc.code"
    :to="switchLocalePath(loc.code)"
    rel="alternate"
    :hreflang="loc.code"
  >
    {{ loc.name }}
  </NuxtLink>
</template>
```

`useSwitchLocalePath()` returns the URL for the same page in a different locale. It handles localized `pathnames` correctly.

### Persisting the choice

Both libraries set a cookie when the user changes locale via `router.replace` / `setLocale`. To override, write your own cookie:

```ts
document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000; SameSite=Lax`;
```

next-intl middleware reads `NEXT_LOCALE` cookie to honor the user choice on subsequent visits.

Nuxt `@nuxtjs/i18n` uses `i18n_redirected` cookie by default; configurable.

## Browser language detection

Detect `Accept-Language` header on the first visit and redirect to the matching locale. Both libraries do this automatically when configured:

next-intl: `defineRouting({localeDetection: true})` (default).

Nuxt: `detectBrowserLanguage: {useCookie: true, redirectOn: 'root'}`.

**Critical:** detect ONLY on root path (`/`). Detecting on every URL breaks deep links from social media (`/ru/blog/post-1` shared to an English-speaking user would redirect away from the intended content).

## Programmatic locale change outside components

```ts
// next-intl — no programmatic global change; use router.replace
import {useRouter, usePathname} from '@/i18n/navigation';
// inside a client component:
router.replace(pathname, {locale: 'ru'});
```

```ts
// vue-i18n — set the Ref directly
i18n.global.locale.value = 'ru';
```

For Nuxt with `@nuxtjs/i18n`:

```ts
const {setLocale} = useI18n();
await setLocale('ru');  // updates URL + locale
```

`setLocale` (Nuxt module) updates URL via router navigation — it's path-aware. Don't manually set `locale.value` in Nuxt — use `setLocale`.

## Code-splitting per route

For very large apps, split messages by route segment so /checkout only loads checkout messages:

next-intl: see "Per-namespace lazy loading" above.

Nuxt: place per-page locale blocks in components (with `@intlify/unplugin-vue-i18n`):

```vue
<i18n lang="json" src="./locales/checkout.en.json"></i18n>
<i18n lang="json" src="./locales/checkout.ru.json"></i18n>
```

These are scoped to the component and bundled with it.

## Streaming and Suspense (next-intl + RSC)

`getTranslations` is `async` — works with Suspense:

```tsx
import {Suspense} from 'react';
import {getTranslations} from 'next-intl/server';

async function SlowSection() {
  const t = await getTranslations('Section');
  await fetchSlowData();
  return <p>{t('content')}</p>;
}

export default function Page() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <SlowSection />
    </Suspense>
  );
}
```

Make sure `setRequestLocale` runs in the layout/page above the Suspense boundary.

## Related

- [next-intl.md](next-intl.md) — setup, `setRequestLocale`, `NextIntlClientProvider`
- [vue-i18n.md](vue-i18n.md) — `createI18n`, lazy patterns
- [seo-and-routing.md](seo-and-routing.md) — locale-prefix strategy choice
- [troubleshooting.md](troubleshooting.md) — hydration on locale change
