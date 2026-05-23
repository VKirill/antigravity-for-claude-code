# Responsive Design — Mobile-First

Breakpoints, mobile-first подход, container queries, fluid typography.

---

## Принцип Mobile-First

Пиши базовые стили для наименьшего экрана. Добавляй `@media (min-width: ...)` для больших.

```css
/* ПЛОХО: desktop-first */
.card {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;  /* Desktop */
  gap: var(--space-6);
}

@media (max-width: 768px) {
  .card {
    grid-template-columns: 1fr;  /* Перекрываем для мобильных */
    gap: var(--space-4);
  }
}

/* ХОРОШО: mobile-first */
.card-grid {
  display: grid;
  grid-template-columns: 1fr;      /* Мобильные: 1 колонка */
  gap: var(--space-4);
}

@media (min-width: 768px) {
  .card-grid {
    grid-template-columns: 1fr 1fr;   /* Планшет: 2 колонки */
  }
}

@media (min-width: 1024px) {
  .card-grid {
    grid-template-columns: 1fr 1fr 1fr;  /* Десктоп: 3 колонки */
    gap: var(--space-6);
  }
}
```

---

## Breakpoints (Tailwind-aligned)

| Имя | min-width | Целевое устройство |
|---|---|---|
| (base) | 0px | Мобильный (≤320px–639px) |
| `sm` | 640px | Мобильный landscape / большой телефон |
| `md` | 768px | Планшет portrait |
| `lg` | 1024px | Планшет landscape / маленький ноутбук |
| `xl` | 1280px | Ноутбук / десктоп |
| `2xl` | 1536px | Широкий десктоп |

```css
/* CSS Custom Properties для breakpoints */
:root {
  --bp-sm: 640px;
  --bp-md: 768px;
  --bp-lg: 1024px;
  --bp-xl: 1280px;
}

/* Использование */
@media (min-width: 768px) { ... }   /* md */
@media (min-width: 1024px) { ... }  /* lg */
```

---

## Flexbox vs Grid

### Flexbox — для 1D раскладки (строка или колонка)

```css
/* Навигация: элементы в ряд с гибкими промежутками */
.nav {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

/* Карточка: вертикальная раскладка с кнопкой прижатой к низу */
.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.card__actions {
  margin-top: auto;  /* Прижимает к низу карточки */
}
```

### Grid — для 2D раскладки (строки + колонки)

```css
/* Страничный layout */
.page-layout {
  display: grid;
  grid-template-areas:
    "header header"
    "sidebar main"
    "footer footer";
  grid-template-columns: 240px 1fr;
  grid-template-rows: auto 1fr auto;
  min-height: 100vh;
}

.page-header { grid-area: header; }
.page-sidebar { grid-area: sidebar; }
.page-main { grid-area: main; }
.page-footer { grid-area: footer; }

/* auto-fit: колонки подстраиваются под контейнер */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-6);
}

/* auto-fill: создаёт пустые колонки (полезно для выравнивания) */
.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-4);
}
```

---

## Container Queries

Когда компонент должен реагировать на размер **своего контейнера**, а не всего viewport.

```css
/* Шаг 1: Определить containment context */
.card-wrapper {
  container-type: inline-size;
  container-name: card;  /* опционально, для именованных запросов */
}

/* Шаг 2: Стили внутри @container */
.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* Когда контейнер шире 400px — раскладка в строку */
@container (min-width: 400px) {
  .card {
    flex-direction: row;
    align-items: center;
  }
}

/* Именованный запрос */
@container card (min-width: 600px) {
  .card__title {
    font-size: var(--text-xl);
  }
}
```

Когда использовать container queries вместо media queries:
- Компонент используется в разных контекстах (сайдбар / основной контент / modal)
- Размер компонента зависит от его окружения, а не от viewport

---

## Fluid Typography

```css
/* clamp(min, preferred, max) */
/* preferred = fluid часть, масштабируется между min и max */

h1 {
  /* 1.5rem (24px) на 320px → 3rem (48px) на 1280px */
  font-size: clamp(1.5rem, 2.5vw + 1rem, 3rem);
}

h2 {
  /* 1.25rem → 2rem */
  font-size: clamp(1.25rem, 2vw + 0.75rem, 2rem);
}

body {
  /* 0.875rem → 1.125rem */
  font-size: clamp(0.875rem, 1vw + 0.625rem, 1.125rem);
}

/* Fluid spacing */
.section {
  padding-block: clamp(var(--space-8), 5vw, var(--space-16));
}
```

Как считать формулу `clamp`:
```
preferred = (max - min) / (max-viewport - min-viewport) * 100vw + C
C = min - (max - min) / (max-viewport - min-viewport) * min-viewport
```
Или использовать: utopia.fyi/type/calculator

---

## Тестирование Responsive

Минимальные точки проверки:

| Ширина | Что тестировать |
|---|---|
| 320px | Самый маленький телефон (iPhone SE) |
| 375px | iPhone 12/13 portrait |
| 768px | iPad portrait |
| 1024px | iPad landscape / ноутбук |
| 1280px | Стандартный десктоп |
| 1920px | Full HD монитор |

```bash
# Быстрая проверка в браузере:
# Chrome DevTools → Toggle Device Toolbar (Ctrl+Shift+M)
# Responsive → ввести ширину вручную
```

---

## Когда НЕ применять

| Ситуация | Почему допустимо |
|---|---|
| Десктоп-only internal tool (HR system, CRM с известным viewport) | Пользователи всегда на десктопе, mobile не нужен |
| Canvas/WebGL приложение | Своя система координат, CSS responsive не применим |
| Email templates | Email clients имеют свои ограничения, другой подход |

---

## Типичные ошибки

1. **Desktop-first медиазапросы** — `@media (max-width: 768px)` вместо `min-width`. Desktop-first сложнее поддерживать, перекрывающих стилей становится больше.

2. **Горизонтальный скролл на мобильных** — элемент шире viewport. Проверяй с `overflow-x: hidden` только как диагностику, не как лечение. Найди и исправь виновный элемент.

3. **Фиксированные px-размеры для шрифтов** — `font-size: 14px` не масштабируется с пользовательскими настройками браузера. Используй `rem`.

4. **Изображения без `max-width: 100%`** — `img` может выйти за пределы контейнера.
   ```css
   img, video, svg { max-width: 100%; height: auto; }
   ```

5. **Отсутствие `viewport` meta-тега** — без него mobile браузеры симулируют широкий viewport.
   ```html
   <meta name="viewport" content="width=device-width, initial-scale=1">
   ```

6. **Touch targets меньше 44×44px** — WCAG требует минимум 44px для кликабельных элементов на тач-устройствах.
   ```css
   .btn { min-height: 44px; min-width: 44px; }
   ```

---

## Sources

- MDN — "Responsive design" guide
- Google web.dev — "Responsive design" fundamentals
- Tailwind CSS — Breakpoint documentation
- CSS Tricks — "A Complete Guide to CSS Grid" / "A Complete Guide to Flexbox"
- utopia.fyi — Fluid type and space calculator
- W3C CSS Containment spec — Container Queries
