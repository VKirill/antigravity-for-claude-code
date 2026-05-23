# Design Tokens и CSS Custom Properties

Структура токенов, naming convention, темизация, scale-системы.

---

## Что такое design token

Design token — именованное значение дизайн-системы: цвет, отступ, радиус, тень, шрифт. Хранится в одном месте, используется везде. Изменение токена меняет всё UI сразу.

```css
/* Определяем один раз — в :root или в tokens.css */
:root {
  /* Цвета */
  --color-text-primary: #111827;
  --color-text-secondary: #6b7280;
  --color-bg-surface: #ffffff;
  --color-accent: #2563eb;
  --color-accent-hover: #1d4ed8;
  --color-on-accent: #ffffff;
  --color-danger: #dc2626;
  --color-border: #e5e7eb;

  /* Отступы (4px базовая единица) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;
  --space-16: 64px;

  /* Шрифты */
  --text-xs: 0.75rem;    /* 12px */
  --text-sm: 0.875rem;   /* 14px */
  --text-base: 1rem;     /* 16px */
  --text-lg: 1.125rem;   /* 18px */
  --text-xl: 1.25rem;    /* 20px */
  --text-2xl: 1.5rem;    /* 24px */
  --text-3xl: 2rem;      /* 32px */
  --text-4xl: 3rem;      /* 48px */

  /* Радиусы */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;

  /* Тени */
  --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px rgb(0 0 0 / 0.07);
  --shadow-lg: 0 10px 15px rgb(0 0 0 / 0.1);
}
```

---

## Naming Convention: scope-property-variant

Формат: `--{scope}-{property}-{variant}`

```css
/* Правильно */
--color-text-primary      /* scope=color, property=text, variant=primary */
--color-bg-surface        /* scope=color, property=bg, variant=surface */
--space-4                 /* scope=space, variant=4 (steps в scale) */
--text-lg                 /* scope=text, variant=lg */
--radius-md               /* scope=radius, variant=md */

/* Неправильно */
--primaryTextColor        /* camelCase — CSS не использует camelCase в переменных */
--primary-color           /* слишком общее, не ясно где применяется */
--16px-spacing            /* значение в имени, не семантика */
--fontSizeLarge           /* camelCase + не следует scope-property-variant */
```

---

## Light / Dark Theme

### Через data-атрибут (рекомендуется)

```css
:root {
  /* Light theme — дефолт */
  --color-text-primary: #111827;
  --color-bg-surface: #ffffff;
  --color-bg-muted: #f9fafb;
  --color-border: #e5e7eb;
}

[data-theme="dark"] {
  --color-text-primary: #f9fafb;
  --color-bg-surface: #111827;
  --color-bg-muted: #1f2937;
  --color-border: #374151;
}
```

```js
// Переключение темы
document.documentElement.setAttribute('data-theme', 'dark');
```

### Через media query (автоматически)

```css
@media (prefers-color-scheme: dark) {
  :root {
    --color-text-primary: #f9fafb;
    --color-bg-surface: #111827;
    --color-border: #374151;
  }
}
```

### Комбо: data-атрибут + media query (рекомендуется)

```css
/* Автоматическая тема по умолчанию */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --color-text-primary: #f9fafb;
    --color-bg-surface: #111827;
  }
}

/* Явное переключение пользователем — имеет приоритет */
[data-theme="dark"] {
  --color-text-primary: #f9fafb;
  --color-bg-surface: #111827;
}

[data-theme="light"] {
  --color-text-primary: #111827;
  --color-bg-surface: #ffffff;
}
```

---

## Spacing Scale

Базовая единица — 4px. Каждый шаг умножает на 1.5-2x.

| Токен | Значение | Типичное использование |
|---|---|---|
| `--space-1` | 4px | Иконка + текст gap |
| `--space-2` | 8px | Padding маленьких бейджей |
| `--space-3` | 12px | Gap в inline списках |
| `--space-4` | 16px | Стандартный padding карточки |
| `--space-6` | 24px | Gap между секциями карточки |
| `--space-8` | 32px | Padding секции |
| `--space-12` | 48px | Gap между крупными блоками |
| `--space-16` | 64px | Padding hero-секции |

---

## Когда переиспользовать токены из существующей дизайн-системы

**Всегда**, если дизайн-система уже есть в проекте (Tailwind config, shadcn CSS vars, Ant Design tokens). Не вводи параллельные токены — один источник правды.

```css
/* shadcn/ui проект — токены уже определены, используй их */
.my-component {
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
}

/* НЕ делай */
.my-component {
  background: #ffffff;    /* дублирует --background */
  color: #111827;         /* дублирует --foreground */
}
```

---

## Когда НЕ применять токены

| Ситуация | Почему допустимо |
|---|---|
| Одноразовый прототип без дизайн-системы | Скорость важнее консистентности |
| Совсем маленький standalone компонент (< 10 строк CSS) | Оверхед от токенизации превышает пользу |
| Значение не повторяется нигде и специфично для одного элемента | `border-width: 3px` только в одном месте — не токен |

---

## Типичные ошибки

1. **Захардкоженные значения** — `padding: 16px` вместо `padding: var(--space-4)`. При смене scale надо найти все вхождения вручную.

2. **Токен ссылается на токен ссылается на токен (3+ уровня)** — `--color-btn: var(--color-accent); --color-accent: var(--blue-500); --blue-500: #2563eb`. Два уровня — норма, три и больше — запутывает дебаггинг.

3. **Токены в JS, а не в CSS** — передавать цвета через JS `const primaryColor = '#2563eb'` теряет преимущества каскада и темизации через CSS.

4. **Одинаковые значения под разными именами** — `--color-primary` и `--color-brand` равны одному цвету. Один концепт — один токен.

5. **Пропуск scope в имени** — `--primary` вместо `--color-text-primary`. Через полгода непонятно, это цвет, размер или что-то ещё.

6. **Токены за пределами `:root`** — определять кастомные свойства внутри компонента, когда нужны глобально. Глобальные токены — в `:root`.

---

## Sources

- MDN — "Using CSS custom properties (variables)"
- W3C CSS Custom Properties spec
- Style Dictionary — Token naming conventions (amzn.github.io/style-dictionary)
- Tailwind CSS — Design token philosophy
- shadcn/ui — CSS variables pattern
