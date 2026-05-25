# next-intl — Next.js 16 App Router integration

next-intl is the dominant i18n library for Next.js. It provides ICU MessageFormat, locale-prefixed routing, async server-component support, and type-safe translation keys.

## Project layout

```
src/
├── i18n/
│   ├── routing.ts            # defineRouting (locales, defaultLocale, pathnames)
│   ├── navigation.ts         # exports Link, redirect, usePathname, useRouter
│   └── request.ts            # getRequestConfig — loads messages for current locale
├── middleware.ts             # createMiddleware(routing)
├── messages/
│   ├── en.json
│   ├── ru.json
│   └── de.json
└── app/
    └── [locale]/
        ├── layout.tsx        # setRequestLocale + NextIntlClientProvider
        └── page.tsx          # getTranslations / useTranslations
```

## 1. `next.config.ts` plugin

```ts
import {NextConfig} from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // ...
};

export default withNextIntl(nextConfig);
```

## 2. Routing definition (`src/i18n/routing.ts`)

```ts
import {defineRouting} from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'ru', 'de'],
  defaultLocale: 'en',
  localePrefix: 'as-needed', // 'always' | 'as-needed' | 'never'

  // Optional: translated URLs
  pathnames: {
    '/': '/',
    '/about': {
      en: '/about',
      ru: '/o-nas',
      de: '/ueber-uns'
    },
    '/blog/[slug]': {
      en: '/blog/[slug]',
      ru: '/blog/[slug]',
      de: '/artikel/[slug]'
    }
  }
});
```

`localePrefix` choices:
- `'always'` — `/en/about`, `/ru/about` (best for SEO clarity)
- `'as-needed'` — `/about` for default locale, `/ru/about` for others
- `'never'` — locale stored in cookie/header only (worst for SEO, avoid for public sites)

## 3. Navigation helpers (`src/i18n/navigation.ts`)

```ts
import {createNavigation} from 'next-intl/navigation';
import {routing} from './routing';

export const {Link, redirect, usePathname, useRouter, getPathname} =
  createNavigation(routing);
```

Use these everywhere instead of `next/link` and `next/navigation`.

## 4. Middleware (`src/middleware.ts`)

```ts
import createMiddleware from 'next-intl/middleware';
import {routing} from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match all paths except _next, api, static files
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
```

To compose with other middleware (auth, headers):

```ts
import createMiddleware from 'next-intl/middleware';
import {NextRequest} from 'next/server';
import {routing} from './i18n/routing';

export default async function middleware(request: NextRequest) {
  const handleI18nRouting = createMiddleware(routing);
  const response = handleI18nRouting(request);
  // custom headers after i18n
  response.headers.set('x-locale', response.headers.get('x-next-intl-locale') || '');
  return response;
}
```

## 5. Request config (`src/i18n/request.ts`)

```ts
import {getRequestConfig} from 'next-intl/server';
import {hasLocale} from 'next-intl';
import {routing} from './routing';

export default getRequestConfig(async ({requestLocale}) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default
  };
});
```

## 6. Locale layout (`app/[locale]/layout.tsx`)

```tsx
import {NextIntlClientProvider} from 'next-intl';
import {setRequestLocale} from 'next-intl/server';
import {hasLocale} from 'next-intl';
import {notFound} from 'next/navigation';
import {routing} from '@/i18n/routing';

type Props = {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

export default async function LocaleLayout({children, params}: Props) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Enable static rendering — MUST be called before any next-intl hook
  setRequestLocale(locale);

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
```

Critical: `setRequestLocale` must run **before** any `getTranslations` / `useTranslations` call in the tree. Place it at the top of every layout/page that needs static rendering.

## 7. Server Components — `getTranslations`

```tsx
// app/[locale]/page.tsx
import {getTranslations, setRequestLocale} from 'next-intl/server';

type Props = {params: Promise<{locale: string}>};

export default async function HomePage({params}: Props) {
  const {locale} = await params;
  setRequestLocale(locale);

  const t = await getTranslations('HomePage');

  return (
    <main>
      <h1>{t('title')}</h1>
      <p>{t('welcome', {name: 'Кирилл'})}</p>
    </main>
  );
}
```

For dynamic metadata:

```tsx
import {getTranslations} from 'next-intl/server';

export async function generateMetadata({params}: Props) {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: 'HomePage'});
  return {title: t('metaTitle')};
}
```

## 8. Client Components — `useTranslations`

```tsx
'use client';
import {useTranslations} from 'next-intl';

export default function LoginForm() {
  const t = useTranslations('LoginForm');

  return (
    <form>
      <label>{t('emailLabel')}</label>
      <button>{t('submit')}</button>
    </form>
  );
}
```

Client components need a `NextIntlClientProvider` ancestor (set up in the locale layout). Messages are auto-passed by the provider — no extra wiring per route.

To pass only a subset of messages (smaller bundle):

```tsx
import {NextIntlClientProvider, useMessages} from 'next-intl';
import pick from 'lodash/pick';

export default function Layout({children}: {children: React.ReactNode}) {
  const messages = useMessages();
  return (
    <NextIntlClientProvider messages={pick(messages, 'LoginForm', 'Nav')}>
      {children}
    </NextIntlClientProvider>
  );
}
```

## 9. Localized `Link`

```tsx
import {Link} from '@/i18n/navigation';

<Link href="/about">About</Link>             // → /en/about or /about (as-needed)
<Link href="/about" locale="ru">По-русски</Link> // → /ru/o-nas (uses pathnames map)
<Link href={{pathname: '/blog/[slug]', params: {slug: 'hello'}}}>Post</Link>
```

The `Link` from `@/i18n/navigation` automatically sets `hreflang` when `locale` is overridden.

## 10. Route Handlers

```ts
import {NextResponse} from 'next/server';
import {hasLocale} from 'next-intl';
import {getTranslations} from 'next-intl/server';
import {routing} from '@/i18n/routing';

export async function GET(request: Request) {
  const {searchParams} = new URL(request.url);
  const locale = searchParams.get('locale');
  if (!hasLocale(routing.locales, locale)) {
    return NextResponse.json({error: 'Invalid locale'}, {status: 400});
  }

  const t = await getTranslations({locale, namespace: 'Email'});
  return NextResponse.json({subject: t('subject')});
}
```

## 11. ICU message format

```json
{
  "HomePage": {
    "title": "Welcome",
    "welcome": "Hello, {name}!",
    "items": "{count, plural, =0 {no items} one {# item} other {# items}}",
    "price": "{value, number, ::currency/USD}",
    "lastSeen": "{date, date, long}"
  }
}
```

Russian plurals (1, 2-4, 5+):
```json
{
  "messages": "{count, plural, one {# сообщение} few {# сообщения} many {# сообщений} other {# сообщения}}"
}
```

## 12. Type-safe keys

Augment the global type once:

```ts
// global.d.ts
import en from './messages/en.json';

type Messages = typeof en;
declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface IntlMessages extends Messages {}
}
```

Now `t('HomePage.title')` is type-checked and autocompleted.

## 13. Locale switcher

```tsx
'use client';
import {useLocale} from 'next-intl';
import {usePathname, useRouter} from '@/i18n/navigation';

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <select
      value={locale}
      onChange={(e) => router.replace(pathname, {locale: e.target.value})}
    >
      <option value="en">English</option>
      <option value="ru">Русский</option>
      <option value="de">Deutsch</option>
    </select>
  );
}
```

`router.replace(pathname, {locale})` preserves the path and query — the right primitive for a locale switcher.

## Gotchas

- Forgot `setRequestLocale` → static rendering disabled, dynamic on every request
- Used `next/link` instead of `Link` from `@/i18n/navigation` → no locale prefix preserved
- Mixed `'as-needed'` with localized `pathnames` → default locale URL collisions
- `IntlMessages` interface not augmented → no type safety on keys

See [troubleshooting.md](troubleshooting.md) for more.

## Related

- [translation-files.md](translation-files.md) — JSON structure and ICU details
- [seo-and-routing.md](seo-and-routing.md) — hreflang, sitemap, metadata
- [dynamic-and-runtime.md](dynamic-and-runtime.md) — lazy messages, locale switcher patterns
