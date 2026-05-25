# Translation files — structure, formats, ICU

Framework-agnostic guidance for organizing message catalogs. Applies to both next-intl and vue-i18n.

## JSON vs YAML vs TS

| Format | Pro | Con | Use when |
|---|---|---|---|
| JSON | Native to both libs, simple, tool-friendly | No comments | Default choice, CI/CD friendly |
| YAML | Comments, less noise | Needs parser plugin in vue-i18n; not native in next-intl | Translator-edited files, lots of comments |
| TS/JS | Type inference, can compute values | Not directly consumable by SaaS translation tools | Internal-only, no translator workflow |

**Recommended:** JSON. It's the lingua franca of every translation management platform (Crowdin, Lokalise, Tolgee, Phrase). Both next-intl and vue-i18n accept it natively.

## File organization — by feature vs by page

### Option A: one file per locale (small apps)

```
messages/
├── en.json
├── ru.json
└── de.json
```

```json
// en.json
{
  "Common": {
    "save": "Save",
    "cancel": "Cancel"
  },
  "HomePage": {
    "title": "Welcome",
    "subtitle": "..."
  },
  "LoginForm": {
    "email": "Email",
    "submit": "Sign in"
  }
}
```

Pro: simple. Con: file grows linearly with app; harder for translators to scope work.

### Option B: split by namespace (mid/large apps)

```
messages/
├── en/
│   ├── common.json
│   ├── home.json
│   └── auth.json
├── ru/
│   ├── common.json
│   ├── home.json
│   └── auth.json
```

Then merge at load:

```ts
// next-intl: src/i18n/request.ts
export default getRequestConfig(async ({requestLocale}) => {
  const locale = await requestLocale;
  const [common, home, auth] = await Promise.all([
    import(`../../messages/${locale}/common.json`),
    import(`../../messages/${locale}/home.json`),
    import(`../../messages/${locale}/auth.json`)
  ]);
  return {
    locale,
    messages: {
      Common: common.default,
      HomePage: home.default,
      Auth: auth.default
    }
  };
});
```

Pro: parallel translator work, clearer ownership. Con: more bookkeeping.

### Option C: per-page namespaces with route-scoped loading

Only load `messages/<locale>/<page>.json` for the page being rendered. Smallest bundles. Used when locales are very large (e.g., >100 KB per locale). See [dynamic-and-runtime.md](dynamic-and-runtime.md).

## Naming conventions

- **Namespaces:** `PascalCase` matching component or feature (`HomePage`, `LoginForm`, `Common`)
- **Keys:** `camelCase` for short identifiers (`submitButton`, `emailLabel`)
- **Nested keys:** allowed for hierarchy (`error.notFound`, `error.serverError`)
- **No spaces, no dashes** in keys — they break tooling

## ICU MessageFormat

ICU is the standard. next-intl supports it natively. vue-i18n needs `@intlify/message-format` or uses its built-in syntax (which is ICU-compatible for plurals, select, interpolation).

### Interpolation

```json
{"greeting": "Hello, {name}!"}
```

```ts
t('greeting', {name: 'Кирилл'});
```

### Plural

```json
{"items": "{count, plural, =0 {no items} one {# item} other {# items}}"}
```

Categories: `zero` `one` `two` `few` `many` `other`, plus literals `=0`, `=1`, etc. `#` is the count.

Use `=0` for "explicit zero" message; `zero` is for languages where zero has a grammatical category (Arabic).

### Select

```json
{"role": "{gender, select, female {She is} male {He is} other {They are}} admin"}
```

### Ordinal

```json
{"rank": "{place, selectordinal, one {#st} two {#nd} few {#rd} other {#th}} place"}
```

### Date / time / number

next-intl (ICU skeleton):
```json
{
  "lastSeen": "{date, date, long}",
  "price": "{value, number, ::currency/USD}",
  "percent": "{value, number, ::percent}"
}
```

vue-i18n uses named formats from `datetimeFormats` / `numberFormats`:
```vue
{{ d(new Date(), 'long') }}
{{ n(1234, 'currency') }}
```

### Nested ICU (avoid)

ICU supports nesting (plural inside select inside plural). Avoid more than one level — translators struggle, errors compound. Refactor into multiple keys.

## Russian-specific plural rules

Russian has three productive plural forms — `one`, `few`, `many` — plus `other` (decimals).

```json
{
  "messages": "{count, plural, one {# сообщение} few {# сообщения} many {# сообщений} other {# сообщения}}"
}
```

Rule logic (CLDR):
- `one`: `n mod 10 == 1 && n mod 100 != 11` → 1, 21, 31, ...
- `few`: `n mod 10` in 2..4 && `n mod 100` not in 12..14 → 2, 3, 4, 22, 23, ...
- `many`: everything else integer → 0, 5..20, 25..30, ...
- `other`: decimals like 1.5

**next-intl** uses CLDR automatically. **vue-i18n** default rule does NOT cover Russian — need custom rule (see [troubleshooting.md](troubleshooting.md)).

## Currency, units, percent

Always go through `Intl.NumberFormat` (which both libs wrap):

```json
{"total": "{value, number, ::currency/USD}"}
{"weight": "{value, number, ::unit/kilogram}"}
{"discount": "{value, number, ::percent}"}
```

Never concatenate `"$" + amount` — currency symbol, decimal separator, and group separator are locale-dependent.

## Dates

```json
{"created": "{date, date, medium}"}        // ICU style
{"createdLong": "{date, date, long}"}
{"createdCustom": "{date, date, ::yyyyMMMd}"}  // skeleton
```

Pass `Date` objects, not strings:

```ts
t('created', {date: new Date('2026-05-16')});
```

## Rich text and HTML

next-intl supports rich text via component callbacks:

```json
{"agree": "I agree to the <terms>terms</terms> and <privacy>privacy policy</privacy>."}
```

```tsx
t.rich('agree', {
  terms: (chunks) => <Link href="/terms">{chunks}</Link>,
  privacy: (chunks) => <Link href="/privacy">{chunks}</Link>
});
```

vue-i18n uses `<i18n-t>`:

```vue
<i18n-t keypath="agree" tag="p">
  <template #terms>
    <RouterLink to="/terms">{{ t('terms') }}</RouterLink>
  </template>
</i18n-t>
```

**Never** inject raw HTML via `v-html` or `dangerouslySetInnerHTML` — XSS risk.

## Missing key behavior

| Lib | Default |
|---|---|
| next-intl | Throws in development, logs warning in production, falls back to key |
| vue-i18n | Warns; renders key. Configure `missing` handler or `missingWarn: false` |

Configure fallback locale chain:

```ts
// vue-i18n
fallbackLocale: {
  'ru-BY': ['ru', 'en'],
  'ru-UA': ['ru', 'en'],
  default: ['en']
}
```

next-intl uses a single `defaultLocale`; multi-step fallback is custom logic in `getRequestConfig`.

## Type safety

- next-intl: augment `IntlMessages` global interface from `typeof messagesEn`. Build-time check on every `t('...')`
- vue-i18n: pass `MessageSchema` type parameter to `useI18n<{message: MessageSchema}>()` for per-component checks, or augment global types

## Validation in CI

Add a script to fail CI when:
1. Keys exist in one locale but not another
2. ICU placeholders differ across locales (`{name}` in `en` but missing in `ru`)
3. JSON is invalid

next-intl ships `@formatjs/cli` integration. For vue-i18n use `@intlify/unplugin-vue-i18n` build-time check or a custom script.

## Related

- [next-intl.md](next-intl.md) — JSON loading via `getRequestConfig`
- [vue-i18n.md](vue-i18n.md) — `createI18n({messages})` and lazy load
- [dynamic-and-runtime.md](dynamic-and-runtime.md) — code-splitting per namespace
- [troubleshooting.md](troubleshooting.md) — Russian plural, missing key chain
