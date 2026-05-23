---
name: frontend-craft
description: "Дисциплина вёрстки для worker-coder: БЭМ, design tokens, accessibility (WCAG AA), responsive (mobile-first), semantic HTML. Подгружай для любой HTML/CSS/JSX/Vue/Svelte/Astro работы."
tags: [frontend, css, html, accessibility, responsive, bem, design-tokens]
---

# frontend-craft — Дисциплина вёрстки

Практический свод правил для worker-coder. Подгружается автоматически при любой работе с разметкой и стилями. Цель — воспроизводимое, доступное, поддерживаемое UI.

---

## 1. Когда подгружать

Подгружай этот скилл при любой задаче, которая касается:

- HTML-разметки (`.html`, `.jsx`, `.tsx`, `.vue`, `.svelte`, `.astro`)
- CSS / SCSS / стилей (`.css`, `.scss`, `.sass`, `.less`, `<style>` блоков)
- CSS-in-JS (styled-components, emotion, vanilla-extract)
- Tailwind utility-классов в шаблонах
- Компонентов UI-библиотек (shadcn/ui, Radix, Headless UI, PrimeVue)
- Любых задач с токенами дизайн-системы, темизацией, responsive layout

**Сигналы в YAML-контракте:** `skill_hints` содержит `frontend`, `css`, `html`, `accessibility`, `responsive`, `bem`, `react`, `vue`, `svelte`, `astro`, `nextjs`, `nuxt`.

---

## 2. Когда НЕ применять

| Тип задачи | Причина |
|---|---|
| Бэкенд-логика без UI (API, БД, очереди) | Никакой разметки нет |
| Инфраструктурный код (CI, Dockerfile, nginx) | Не относится к вёрстке |
| Unit-тесты бизнес-логики | Не UI-тестирование |
| CLI-скрипты и утилиты без рендера | Нет визуального вывода |
| Pure TypeScript / Python без шаблонов | Нет разметки |

Если задача **частично** касается UI (например, компонент + API-обработчик), применяй правила только к UI-части.

---

## 3. Decision Table: задача → reference

| Задача | Какой reference читать |
|---|---|
| Именование классов, структура CSS без utility-фреймворка | `references/bem-and-naming.md` |
| CSS Custom Properties, темизация, spacing/type scale | `references/design-tokens.md` |
| ARIA, семантические роли, фокус, контраст, alt-тексты | `references/accessibility-a11y.md` |
| Breakpoints, mobile-first, container queries, fluid type | `references/responsive-design.md` |
| Выбор HTML-элемента, heading hierarchy, form структура | `references/semantic-html.md` |
| Проект использует Tailwind | `references/bem-and-naming.md` (раздел "Когда НЕ применять") + `references/design-tokens.md` |
| Тёмная тема / prefers-color-scheme | `references/design-tokens.md` (раздел Light/Dark) |
| Keyboard navigation, focus trap в modal | `references/accessibility-a11y.md` (раздел Keyboard) |
| SEO-разметка, Schema.org | `references/semantic-html.md` + `seo-copywriting` скилл |

---

## 4. Quick Checklist перед коммитом

Пробеги по каждому пункту. Если что-то не выполнено — исправь до коммита.

### Typo / Quality
- [ ] Нет опечаток в class-именах и атрибутах
- [ ] Нет захардкоженных значений цветов (`#fff`, `red`) там, где есть токен
- [ ] Нет `!important` без явной причины (зафиксируй причину в комментарии)
- [ ] Нет `px`-значений в шрифтах там, где нужен `rem`

### A11y
- [ ] Все интерактивные элементы достижимы с клавиатуры (tab order логичен)
- [ ] У кнопок и ссылок есть понятный текст или `aria-label`
- [ ] `<img>` имеет `alt` (описательный для контентных, `alt=""` для декоративных)
- [ ] Контраст фона/текста соответствует WCAG AA (4.5:1 для текста, 3:1 для крупного)
- [ ] Нет `outline: none` без `:focus-visible` замены

### Responsive
- [ ] Компонент проверен на 320px, 768px, 1280px (минимум)
- [ ] Нет горизонтального скролла на мобильных (`overflow-x: hidden` — не лечение)
- [ ] Breakpoints идут от маленьких к большим (`min-width`, mobile-first)

### Tokens
- [ ] Цвета через переменные / токены дизайн-системы
- [ ] Отступы из spacing scale (4/8/12/16/24/32/48/64)
- [ ] Размеры шрифтов из type scale или `clamp()`

### БЭМ (для проектов без utility-фреймворка)
- [ ] Классы следуют `.block__element--modifier` конвенции
- [ ] Нет вложенности `.block__el1__el2` — только `.block__el2`
- [ ] Нет утечки стилей между несвязанными блоками

---

## 5. Навигация по references

```
frontend-craft/
├── SKILL.md                      — этот файл, точка входа
└── references/
    ├── bem-and-naming.md         — БЭМ, naming conventions, когда применять
    ├── design-tokens.md          — CSS custom properties, themes, scale
    ├── accessibility-a11y.md     — WCAG AA, ARIA, keyboard, focus, contrast
    ├── responsive-design.md      — mobile-first, breakpoints, container queries
    └── semantic-html.md          — правильные элементы, heading hierarchy
```

Читай только нужный reference: не нужно читать все 5 для каждой задачи. Decision table выше подскажет.

---

## 6. Sources

Правила этого скилла основаны на:

- **MDN Web Docs** — HTML, CSS, ARIA спецификации (developer.mozilla.org)
- **WCAG 2.1 AA** — Web Content Accessibility Guidelines (w3.org/TR/WCAG21)
- **CSS Tricks / Lea Verou** — современные CSS patterns, custom properties
- **Brad Frost** — Atomic Design, компонентная архитектура
- **Heydon Pickering — "Inclusive Components"** — доступные UI-паттерны
- **Google Web.dev** — responsive design best practices, Core Web Vitals
- **Tailwind CSS docs** — utility-first philosophy, breakpoint conventions
- **БЭМ методология** — getbem.com
