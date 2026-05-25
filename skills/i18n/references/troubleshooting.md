# i18n troubleshooting

Common bugs across next-intl and vue-i18n with root causes and fixes.

## Hydration mismatch on locale change

**Symptom:** React/Vue throws hydration error after user switches locale, console shows "text mismatch".

**Causes:**
1. SSR rendered locale A but client picked locale B from cookie/localStorage
2. Translation in a Client Component used a value that's only available on server
3. `<html lang>` set on client only (not during SSR)

**Fix (next-intl):**
- Locale must come from URL (`[locale]` segment), not cookie
- `setRequestLocale(locale)` in the layout before any translation hook
- Don't set `lang` from `document.documentElement` in a `useEffect` — set it in the server-rendered `<html>`

**Fix (vue-i18n / Nuxt):**
- Use `@nuxtjs/i18n` for SSR — it handles locale-as-route correctly
- For raw vue-i18n + Nitro/SSR, set locale from request, not client storage
- `useLocaleHead` must be called in root layout, not deeply

## Missing key — what's the chain?

**Symptom:** UI shows raw key like `HomePage.title` or empty string.

**next-intl debug:**
```bash
NEXT_PUBLIC_NEXT_INTL_DEBUG=1 pnpm dev
```
Throws in dev with the full key path. In production, logs warning and falls back.

**vue-i18n debug:**
```ts
createI18n({
  missingWarn: true,
  fallbackWarn: true,
  silentFallbackWarn: false,
  missing: (locale, key) => {
    console.error(`Missing i18n key: ${locale}/${key}`);
    return `[${key}]`;
  }
});
```

**Fallback chain:**

```ts
// vue-i18n
fallbackLocale: {
  'ru-BY': ['ru', 'en'],
  'pt-BR': ['pt', 'en'],
  default: ['en']
}
```

next-intl uses a single `defaultLocale`. For multi-step fallback, do it in `getRequestConfig`:

```ts
export default getRequestConfig(async ({requestLocale}) => {
  const requested = (await requestLocale) ?? 'en';
  let messages;
  try {
    messages = (await import(`../../messages/${requested}.json`)).default;
  } catch {
    messages = (await import('../../messages/en.json')).default;
  }
  return {locale: requested, messages};
});
```

## Russian plural rule wrong in vue-i18n

**Symptom:** "2 сообщение" instead of "2 сообщения".

**Cause:** vue-i18n's default plural function uses `0 | 1 | other`. Russian needs `one | few | many | other`.

**Fix:** plug a custom rule into `createI18n`:

```ts
function russianPluralRule(choice: number, choicesLength: number) {
  if (choice === 0) return 0;
  const mod10 = choice % 10;
  const mod100 = choice % 100;
  const teen = mod100 >= 11 && mod100 <= 14;

  if (!teen && mod10 === 1) return 1;             // one
  if (!teen && mod10 >= 2 && mod10 <= 4) return 2; // few
  return choicesLength < 4 ? 2 : 3;                // many
}

createI18n({
  pluralizationRules: {
    ru: russianPluralRule
  }
});
```

Then in messages — comma-separated by index:

```json
{
  "items": "нет сообщений | {count} сообщение | {count} сообщения | {count} сообщений"
}
```

next-intl uses CLDR rules automatically — no custom function needed. The Russian message:

```json
{"items": "{count, plural, =0 {нет сообщений} one {# сообщение} few {# сообщения} many {# сообщений} other {# сообщения}}"}
```

## `setRequestLocale` called too late

**Symptom:** Page renders with default locale despite URL `[locale]=ru`. Or static rendering disabled.

**Cause:** `setRequestLocale(locale)` must run before any `getTranslations` / `useTranslations` call in the React tree.

**Fix:** call it as the first statement after locale validation in the locale layout:

```tsx
export default async function LocaleLayout({children, params}) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale); // ← FIRST, before any translation use
  return <html lang={locale}>...</html>;
}
```

Also call in every page that's a direct child of the locale segment if you want them statically rendered:

```tsx
export default async function HomePage({params}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const t = await getTranslations('HomePage');
  // ...
}
```

## ICU syntax error at build time

**Symptom:** Build fails with "Unmatched brace" or "Expected token".

**Common causes:**
- Forgot `=` prefix for literal zero: `=0 {none}` not `0 {none}`
- Unbalanced braces: `"{count, plural, one {item}"` (missing closing `}`)
- Stray `#` outside plural/select
- Variable name typo: `{userName}` in code, `{name}` in JSON

**Fix:** validate ICU with `@formatjs/cli`:

```bash
npx formatjs lint "messages/**/*.json"
```

Or in CI, parse each message through `intl-messageformat` and fail on parse errors.

## Type safety — `t` doesn't autocomplete keys

**Symptom:** TypeScript doesn't suggest keys, no error on typo.

**Fix (next-intl):**

```ts
// global.d.ts at repo root
import type en from './messages/en.json';

declare global {
  interface IntlMessages {
    [K in keyof typeof en]: typeof en[K];
  }
}
```

Restart the TS server. `useTranslations('HomePage')` then accepts only namespaces in your messages.

**Fix (vue-i18n):** pass schema type parameter:

```ts
const {t} = useI18n<{message: typeof enMessages}, 'en'>();
```

For global augmentation see https://vue-i18n.intlify.dev/guide/advanced/typescript.html.

## SSR locale leakage between requests

**Symptom:** User A's locale appears for User B in a serverless deployment.

**Cause:** Module-level state holding locale across requests. Happens with raw vue-i18n in SSR if `i18n.global.locale` is set globally without per-request isolation.

**Fix:**
- Use `@nuxtjs/i18n` (handles per-request isolation correctly)
- Or create a fresh i18n instance per request:

```ts
// server middleware
export default defineEventHandler((event) => {
  const i18n = createI18n({...}); // fresh per request
  event.context.i18n = i18n;
});
```

next-intl uses React's request context — no global state issue.

## Locale switcher loses query params

**Symptom:** `/blog?page=3` becomes `/ru/blog` after switching, query dropped.

**Fix (next-intl):**

```tsx
'use client';
import {useLocale} from 'next-intl';
import {usePathname, useRouter} from '@/i18n/navigation';
import {useSearchParams} from 'next/navigation';

const router = useRouter();
const pathname = usePathname();
const params = useSearchParams();

const switchLocale = (next: string) => {
  router.replace(`${pathname}?${params.toString()}`, {locale: next});
};
```

**Fix (Nuxt):** `useSwitchLocalePath()` preserves query by default. If it doesn't, append manually:

```vue
<NuxtLink :to="{path: switchLocalePath(loc.code), query: route.query}">
```

## Bundle size — locales blowing up the bundle

**Symptom:** First-page JS bundle is huge; all locales bundled.

**Causes:**
- `messages: {en, ru, de, ...}` in `createI18n` literal — bundles all at build time
- next-intl: messages re-exported from a `'use client'` boundary causing them to be inlined

**Fix:**
- vue-i18n: lazy-load all non-default locales (see [dynamic-and-runtime.md](dynamic-and-runtime.md))
- next-intl: keep `NextIntlClientProvider` near the leaves and pass `messages={pick(messages, ['Common', 'PageX'])}` to scope what's shipped

## `dir="rtl"` not applied

**Symptom:** Arabic page renders LTR.

**Fix:** set `dir` on `<html>` during SSR, not via `useEffect`:

```tsx
const RTL_LOCALES = new Set(['ar', 'he', 'fa']);
const dir = RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';
return <html lang={locale} dir={dir}>...</html>;
```

Nuxt: configure `dir` per locale:

```ts
i18n: {locales: [{code: 'ar', dir: 'rtl', file: 'ar.json'}]}
```

And use `useLocaleHead({addDirAttribute: true})`.

## Diagnostic checklist

When any i18n bug appears, walk through:

1. Is locale in URL? (If no → routing config wrong)
2. Is `<html lang>` correct in view source? (If no → layout `lang={locale}` missing)
3. Is hreflang in `<head>`? (If no → metadata or `useLocaleHead` not configured)
4. Does the bug repro in production build? (If only dev → check `pnpm build && pnpm start`)
5. Is the message present in the locale JSON? (If no → translator workflow issue)
6. Is the namespace correctly passed to `getTranslations('Foo')`? (Typo → silent miss)
7. Is there a hydration warning in console? (If yes → SSR/CSR mismatch — locale source disagreement)

## Related

- [next-intl.md](next-intl.md) — `setRequestLocale`, middleware
- [vue-i18n.md](vue-i18n.md) — Composer, plural rules
- [translation-files.md](translation-files.md) — ICU syntax
- [seo-and-routing.md](seo-and-routing.md) — hreflang, canonical
