# vue-i18n — Vue 3.5 + Nuxt 4 integration

vue-i18n is the canonical i18n library for Vue. As of v11+, **Composition mode is the default** and the only fully-supported mode going forward — `legacy: false` is implicit. Use `@nuxtjs/i18n` for Nuxt apps (it wraps vue-i18n and adds routing).

## Decision: Nuxt module vs raw vue-i18n

| You have | Use |
|---|---|
| Nuxt 4 app | `@nuxtjs/i18n` (Nuxt module wrapping vue-i18n) |
| Vite + Vue 3.5 SPA | `vue-i18n` directly |
| Vue 2 / bridge / legacy | not covered here |

## Path A — Raw vue-i18n (Vue 3.5 SPA)

### 1. Install + bootstrap

```ts
// src/i18n.ts
import {createI18n} from 'vue-i18n';
import en from './locales/en.json';
import ru from './locales/ru.json';

export const i18n = createI18n({
  locale: 'en',
  fallbackLocale: 'en',
  messages: {en, ru},
  // legacy: false is implicit in v11+; Composition mode only
  // For Composer-only access patterns:
  globalInjection: true // adds $t, $n, $d to templates
});
```

```ts
// src/main.ts
import {createApp} from 'vue';
import App from './App.vue';
import {i18n} from './i18n';

createApp(App).use(i18n).mount('#app');
```

### 2. Use in components (Composition API)

```vue
<script setup lang="ts">
import {useI18n} from 'vue-i18n';

const {t, n, d, locale, availableLocales} = useI18n();
</script>

<template>
  <h1>{{ t('hello') }}</h1>
  <p>{{ t('greeting', {name: 'Кирилл'}) }}</p>
  <p>{{ n(1234.56, 'currency') }}</p>
  <p>{{ d(new Date(), 'long') }}</p>

  <select v-model="locale">
    <option v-for="loc in availableLocales" :key="loc" :value="loc">
      {{ loc }}
    </option>
  </select>
</template>
```

`globalInjection: true` also exposes `$t`, `$n`, `$d` in templates without calling `useI18n()` — handy for short templates but `useI18n()` is preferred for type safety.

### 3. Composer instance (global scope)

```ts
import {i18n} from './i18n';

// Access global Composer outside components (router guards, stores)
i18n.global.locale.value = 'ru'; // setter
i18n.global.t('hello');           // translate
```

In v11+ `i18n.global.locale` is a Ref — use `.value`. In legacy mode it was a plain string (don't use legacy mode for new code).

### 4. Local scope (component-specific messages)

```vue
<script setup>
import {useI18n} from 'vue-i18n';

const {t} = useI18n({
  inheritLocale: true,
  messages: {
    en: {welcome: 'Welcome to this component!'},
    ru: {welcome: 'Добро пожаловать в этот компонент!'}
  }
});
</script>
```

Or with SFC `<i18n>` block (needs `@intlify/unplugin-vue-i18n`):

```vue
<i18n lang="json">
{
  "en": {"hello": "hello world!"},
  "ru": {"hello": "привет, мир!"}
}
</i18n>
```

### 5. Number and date formats

```ts
export const i18n = createI18n({
  locale: 'en-US',
  numberFormats: {
    'en-US': {
      currency: {style: 'currency', currency: 'USD'},
      percent: {style: 'percent'}
    },
    'ru-RU': {
      currency: {style: 'currency', currency: 'RUB'},
      percent: {style: 'percent'}
    }
  },
  datetimeFormats: {
    'en-US': {
      short: {year: 'numeric', month: 'short', day: 'numeric'},
      long: {dateStyle: 'full', timeStyle: 'short'}
    },
    'ru-RU': {
      short: {year: 'numeric', month: 'short', day: 'numeric'},
      long: {dateStyle: 'full', timeStyle: 'short'}
    }
  }
});
```

Then `n(1000, 'currency')` and `d(new Date(), 'long')` use the right format per-locale.

### 6. Pluralization (default rule)

```json
{
  "items": "no items | one item | {count} items"
}
```

```vue
{{ t('items', count) }}
```

Default rule: `0 | 1 | other`. For Russian, plug a custom rule (see Troubleshooting).

### 7. Lazy locale loading

```ts
import {nextTick} from 'vue';
import {createI18n} from 'vue-i18n';

export const SUPPORT_LOCALES = ['en', 'ru', 'de'];

export const i18n = createI18n({
  locale: 'en',
  fallbackLocale: 'en',
  messages: {} // start empty
});

export async function loadLocaleMessages(locale: string) {
  const messages = await import(`./locales/${locale}.json`);
  i18n.global.setLocaleMessage(locale, messages.default);
  return nextTick();
}

export function setI18nLanguage(locale: string) {
  i18n.global.locale.value = locale;
  document.documentElement.setAttribute('lang', locale);
}
```

In a vue-router guard:

```ts
router.beforeEach(async (to, from, next) => {
  const locale = to.params.locale as string;
  if (!SUPPORT_LOCALES.includes(locale)) return next(`/${i18n.global.locale.value}`);
  if (!i18n.global.availableLocales.includes(locale)) {
    await loadLocaleMessages(locale);
  }
  setI18nLanguage(locale);
  return next();
});
```

### 8. Type-safe messages

```vue
<script setup lang="ts">
import {useI18n} from 'vue-i18n';
import enUS from './en-US.json';

type MessageSchema = typeof enUS;
type NumberSchema = {
  currency: {style: 'currency'; currencyDisplay: 'symbol'; currency: string};
};

const {t, n} = useI18n<
  {message: MessageSchema; number: NumberSchema},
  'en-US'
>({
  inheritLocale: true,
  messages: {'en-US': enUS},
  numberFormats: {
    'en-US': {currency: {style: 'currency', currencyDisplay: 'symbol', currency: 'USD'}}
  }
});
</script>
```

For global type augmentation, see official [TypeScript guide](https://vue-i18n.intlify.dev/guide/advanced/typescript.html).

---

## Path B — `@nuxtjs/i18n` (Nuxt 4)

### 1. Install + configure

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@nuxtjs/i18n'],
  i18n: {
    locales: [
      {code: 'en', file: 'en.json', name: 'English'},
      {code: 'ru', file: 'ru.json', name: 'Русский'},
      {code: 'de', file: 'de.json', name: 'Deutsch'}
    ],
    defaultLocale: 'en',
    strategy: 'prefix_except_default', // recommended
    langDir: 'locales/',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'root'
    }
  }
});
```

`strategy` options:
- `'no_prefix'` — `/about` for all locales, locale stored in cookie. Worst for SEO.
- `'prefix_except_default'` — `/about` for `en`, `/ru/about` for others. Best balance.
- `'prefix'` — `/en/about`, `/ru/about` for all. Best for explicit SEO.
- `'prefix_and_default'` — both `/about` and `/en/about` valid for default. SEO duplicate risk.

### 2. Locale files

```
i18n/
└── locales/
    ├── en.json
    ├── ru.json
    └── de.json
```

Lazy loading is automatic in `@nuxtjs/i18n` — each locale file is fetched on demand.

### 3. Use in pages

```vue
<script setup lang="ts">
const {t, locale, locales, setLocale} = useI18n();
const switchLocalePath = useSwitchLocalePath();
</script>

<template>
  <h1>{{ t('title') }}</h1>

  <!-- Locale switcher with path preservation -->
  <NuxtLink
    v-for="loc in locales"
    :key="loc.code"
    :to="switchLocalePath(loc.code)"
  >
    {{ loc.name }}
  </NuxtLink>
</template>
```

### 4. Localized routes (`defineI18nRoute`)

```vue
<script setup>
defineI18nRoute({
  paths: {
    en: '/about-us',
    ru: '/o-nas',
    de: '/ueber-uns'
  }
});
</script>
```

Or in `nuxt.config.ts` with `customRoutes: 'config'`:

```ts
i18n: {
  customRoutes: 'config',
  pages: {
    about: {
      en: '/about-us',
      ru: '/o-nas',
      de: '/ueber-uns'
    }
  }
}
```

### 5. `defineI18nConfig` (extra vue-i18n options)

```ts
// i18n/i18n.config.ts
export default defineI18nConfig(() => ({
  legacy: false,
  fallbackLocale: 'en',
  numberFormats: {
    en: {currency: {style: 'currency', currency: 'USD'}},
    ru: {currency: {style: 'currency', currency: 'RUB'}}
  }
}));
```

Referenced from `nuxt.config.ts`:

```ts
i18n: {
  vueI18n: './i18n/i18n.config.ts'
}
```

### 6. SEO (hreflang, canonical)

```vue
<script setup>
useLocaleHead({
  addDirAttribute: true,
  identifierAttribute: 'id',
  addSeoAttributes: true
});
</script>
```

Or in `app.vue`:

```vue
<template>
  <Html :lang="head.htmlAttrs.lang" :dir="head.htmlAttrs.dir">
    <Head>
      <template v-for="link in head.link" :key="link.id">
        <Link :id="link.id" :rel="link.rel" :href="link.href" :hreflang="link.hreflang" />
      </template>
    </Head>
    <Body>
      <NuxtLayout><NuxtPage /></NuxtLayout>
    </Body>
  </Html>
</template>
```

## Gotchas

- Using `legacy: true` on a new vue-i18n 11+ project — Composition is the only fully supported mode
- Forgetting `.value` on `i18n.global.locale` outside components (it's a Ref now, was a string in legacy)
- Mixing global and local scope messages — local `useI18n({messages})` does NOT inherit unless `inheritLocale: true`
- Skipping `@intlify/unplugin-vue-i18n` and trying to use SFC `<i18n>` blocks (won't compile)
- Default plural rule `0 | 1 | other` for Russian — wrong, need custom rule (see troubleshooting)

## Related

- [translation-files.md](translation-files.md) — JSON structure, ICU, plural rules
- [seo-and-routing.md](seo-and-routing.md) — hreflang, sitemap for Nuxt
- [dynamic-and-runtime.md](dynamic-and-runtime.md) — lazy loading patterns
- [troubleshooting.md](troubleshooting.md) — Russian plural rule, SSR hydration
