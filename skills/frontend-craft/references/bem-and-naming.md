# БЭМ и именование классов

Практическое руководство по БЭМ-методологии для проектов с собственным CSS.

---

## Базовая структура

```
.block                   — независимый компонент
.block__element          — часть блока, не используется вне блока
.block--modifier         — вариация блока (состояние, тема, размер)
.block__element--modifier — вариация элемента
```

### Примеры

```html
<!-- Карточка продукта — block -->
<div class="product-card product-card--featured">
  <!-- Заголовок — element -->
  <h2 class="product-card__title">Название товара</h2>

  <!-- Цена — element -->
  <span class="product-card__price product-card__price--sale">990 ₽</span>

  <!-- Кнопка — element с модификатором -->
  <button class="product-card__btn product-card__btn--primary">
    Купить
  </button>
</div>
```

```css
.product-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
}

.product-card--featured {
  border-color: var(--color-accent);
  box-shadow: var(--shadow-lg);
}

.product-card__title {
  font-size: var(--text-lg);
  font-weight: 600;
  margin: 0 0 var(--space-2);
}

.product-card__price {
  color: var(--color-text-secondary);
}

.product-card__price--sale {
  color: var(--color-danger);
  font-weight: 700;
}

.product-card__btn {
  display: inline-flex;
  align-items: center;
  padding: var(--space-2) var(--space-4);
}

.product-card__btn--primary {
  background: var(--color-accent);
  color: var(--color-on-accent);
}
```

---

## Когда применять БЭМ

БЭМ оправдан когда:

- Проект пишет **собственный CSS** без utility-first фреймворка
- Несколько разработчиков работают над одной кодовой базой
- Компоненты переиспользуются в разных контекстах
- Требуется предсказуемая специфичность (все селекторы одного уровня)

---

## Когда НЕ применять

| Ситуация | Что использовать вместо |
|---|---|
| Tailwind проект | Utility-классы Tailwind, БЭМ не нужен |
| styled-components / emotion | CSS-in-JS scope изолирует стили, БЭМ избыточен |
| Astro / Svelte / Vue SFC с `scoped` | `<style scoped>` изолирует, БЭМ не нужен |
| CSS Modules (`.module.css`) | Модули дают уникальные имена автоматически |
| Прототип / throwaway код | Не стоит вкладываться в naming discipline |

В Tailwind проекте вместо `.card__title` пишешь `class="text-lg font-semibold mb-2"`. Это правильно.

---

## Вложенность: НЕ `.block__el__sub`

Одна из самых частых ошибок — отражать DOM-дерево в именах классов.

```html
<!-- ПЛОХО: Глубокая вложенность в имени -->
<nav class="nav">
  <ul class="nav__list">
    <li class="nav__list__item">         <!-- nav__list__item — ОШИБКА -->
      <a class="nav__list__item__link">  <!-- три уровня — ОШИБКА -->
        Главная
      </a>
    </li>
  </ul>
</nav>

<!-- ХОРОШО: Плоская структура имён -->
<nav class="nav">
  <ul class="nav__list">
    <li class="nav__item">              <!-- nav__item, не nav__list__item -->
      <a class="nav__link">             <!-- nav__link, не nav__list__item__link -->
        Главная
      </a>
    </li>
  </ul>
</nav>
```

Правило: имя элемента отражает его **роль в блоке**, не его позицию в DOM.

---

## Правильно vs. неправильно: ещё пример

```html
<!-- ПЛОХО: множественные модификаторы без БЭМ-структуры -->
<button class="btn btn-red btn-rounded btn-large btn-with-icon">
  Отправить
</button>

<!-- Проблемы:
  - нет разделения block/element/modifier
  - неясно, какой класс — вариация, какой — независимый блок
  - специфичность CSS непредсказуема
-->

<!-- ХОРОШО: БЭМ-структура -->
<button class="btn btn--danger btn--lg btn--icon-left">
  <svg class="btn__icon" aria-hidden="true">...</svg>
  Отправить
</button>

<!-- CSS: -->
<!-- .btn — базовые стили кнопки -->
<!-- .btn--danger — цветовая вариация -->
<!-- .btn--lg — размерная вариация -->
<!-- .btn--icon-left — структурная вариация (с иконкой слева) -->
<!-- .btn__icon — элемент внутри кнопки -->
```

---

## Типичные ошибки

1. **Вложенные имена** `.nav__list__item` — отражает DOM, не роль. Исправь на `.nav__item`.

2. **Глобальные утилитарные классы рядом с БЭМ** — `.card .mt-4 .text-red` нарушает предсказуемость. В БЭМ-проекте делай `.card--spaced` или `.card__price--alert`.

3. **Модификатор без базового класса** — `<div class="card--featured">` без `card`. Всегда ставь оба: `class="card card--featured"`.

4. **Именование через состояние JS** — `.is-active`, `.has-error` — допустимо только для временных состояний, добавляемых через JS. Не для постоянных вариаций.

5. **`camelCase` в CSS** — `.productCard__itemTitle`. CSS конвенция — kebab-case: `.product-card__item-title`.

6. **Блок внутри блока использует элемент родителя** — `.card__btn.btn--primary` — кнопка внутри карточки должна быть самостоятельным блоком `.btn`, не элементом `.card__btn`.

---

## Sources

- getbem.com — официальная документация БЭМ
- CSS Tricks — "BEM 101" by Robin Rendle
- Yandex Engineering Blog — оригинальная методология
