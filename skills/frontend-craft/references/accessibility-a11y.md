# Accessibility (a11y) — WCAG AA

Практический гид по доступности. A11y не опционален — это минимальный профессиональный стандарт.

---

## Semantic HTML — первая линия защиты

Правильный HTML-элемент даёт доступность бесплатно. ARIA нужен только там, где семантики не хватает.

```html
<!-- ПЛОХО: div для всего -->
<div class="btn" onclick="submit()">Отправить</div>
<div class="nav-link" onclick="go('/home')">Главная</div>
<div class="heading">Заголовок раздела</div>

<!-- ХОРОШО: нативные элементы -->
<button type="button" onclick="submit()">Отправить</button>
<a href="/home">Главная</a>
<h2>Заголовок раздела</h2>
```

### Когда `<div>` ОК

- Чисто структурный/layout контейнер без семантической роли
- Группировка для стилей без смыслового значения
- Слой для позиционирования декоративных элементов

### Когда `<div>` НЕ ОК

- Кликабельный элемент — нужен `<button>` или `<a>`
- Элемент списка — нужен `<li>` внутри `<ul>`/`<ol>`
- Поле ввода — нужен `<input>`, `<textarea>`, `<select>`
- Секция контента со смыслом — нужен `<section>`, `<article>`, `<aside>`

---

## Landmark-элементы

```html
<body>
  <!-- Skip-link для keyboard users -->
  <a href="#main-content" class="skip-link">Перейти к содержимому</a>

  <header>
    <nav aria-label="Главная навигация">
      <ul>
        <li><a href="/" aria-current="page">Главная</a></li>
        <li><a href="/about">О нас</a></li>
      </ul>
    </nav>
  </header>

  <main id="main-content">
    <article>
      <h1>Заголовок статьи</h1>
      <section aria-labelledby="section-heading">
        <h2 id="section-heading">Раздел</h2>
        <p>Контент...</p>
      </section>
    </article>

    <aside aria-label="Связанные материалы">
      <h2>Читайте также</h2>
    </aside>
  </main>

  <footer>
    <nav aria-label="Дополнительная навигация">...</nav>
  </footer>
</body>
```

---

## ARIA: только когда семантики недостаточно

```html
<!-- aria-label: когда текст не виден или недостаточно описателен -->
<button aria-label="Закрыть модальное окно">
  <svg aria-hidden="true">...</svg>  <!-- иконка декоративная -->
</button>

<!-- aria-describedby: дополнительное описание к элементу -->
<input
  id="email"
  type="email"
  aria-describedby="email-hint email-error"
/>
<p id="email-hint">Мы не передаём email третьим лицам</p>
<p id="email-error" role="alert" aria-live="polite">
  Введите корректный email-адрес
</p>

<!-- aria-live: динамически обновляемый контент -->
<div aria-live="polite" aria-atomic="true">
  <!-- Сообщения, которые screen reader должен озвучить -->
  Форма успешно отправлена
</div>

<!-- aria-current: текущий элемент в наборе (nav, breadcrumb, pagination) -->
<nav>
  <a href="/" aria-current="page">Главная</a>
  <a href="/about">О нас</a>
</nav>

<!-- aria-expanded: состояние раскрытых элементов -->
<button aria-expanded="false" aria-controls="dropdown-menu">
  Меню
</button>
<ul id="dropdown-menu" hidden>...</ul>

<!-- aria-hidden: скрыть декоративные элементы от screen reader -->
<span aria-hidden="true">👋</span>
```

---

## Focus: видимый и предсказуемый

```css
/* ПЛОХО: убрать outline без замены */
* {
  outline: none; /* screen reader users теряют ориентацию */
}
button:focus {
  outline: none; /* НИКОГДА */
}

/* ХОРОШО: заменить на кастомный focus-visible */
/* :focus-visible — только для keyboard navigation, не для mouse click */
:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
  border-radius: 2px;
}

/* Или через box-shadow для скруглённых элементов */
.btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--color-accent-focus);
}
```

---

## Keyboard Navigation

```html
<!-- Modal с focus trap -->
<dialog
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
>
  <h2 id="modal-title">Подтверждение</h2>
  <p>Вы уверены?</p>
  <button type="button" onclick="confirm()">Да</button>
  <button type="button" onclick="closeModal()">Отмена</button>
</dialog>
```

```js
// ESC закрывает modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isModalOpen) {
    closeModal();
  }
});

// Focus trap внутри modal
function trapFocus(element) {
  const focusable = element.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  element.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === first) {
        last.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    }
  });
}
```

---

## WCAG AA Contrast

| Тип элемента | Минимальный контраст |
|---|---|
| Обычный текст (< 18pt / < 14pt bold) | **4.5 : 1** |
| Крупный текст (≥ 18pt или ≥ 14pt bold) | **3 : 1** |
| UI компоненты (кнопки, формы, иконки) | **3 : 1** |
| Декоративные элементы | Не требуется |
| Текст на изображении / логотипе | Не требуется |

Инструменты проверки:
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- Chrome DevTools → Inspect element → Accessibility → Contrast ratio
- [APCA Contrast Calculator](https://www.myndex.com/APCA/) (продвинутый стандарт)

---

## Alt-тексты для изображений

```html
<!-- Контентное изображение: alt описывает смысл -->
<img
  src="team-meeting.jpg"
  alt="Команда из пяти человек обсуждает проект на доске"
/>

<!-- Функциональное изображение (кнопка/ссылка): alt описывает действие -->
<a href="/">
  <img src="logo.svg" alt="Вернуться на главную страницу" />
</a>

<!-- Декоративное изображение: alt="" (пустой, не отсутствующий!) -->
<img src="decorative-divider.png" alt="" role="presentation" />

<!-- Иконка внутри кнопки с видимым текстом: иконка декоративна -->
<button>
  <svg aria-hidden="true" focusable="false">...</svg>
  Сохранить
</button>

<!-- Иконка без текста: aria-label на родителе -->
<button aria-label="Удалить файл">
  <svg aria-hidden="true" focusable="false">...</svg>
</button>
```

---

## Skip-links

```html
<!-- В самом начале <body> -->
<a href="#main-content" class="skip-link">
  Перейти к основному содержимому
</a>
```

```css
.skip-link {
  position: absolute;
  top: -100%;
  left: 1rem;
  padding: 0.5rem 1rem;
  background: var(--color-accent);
  color: var(--color-on-accent);
  border-radius: var(--radius-md);
  text-decoration: none;
  z-index: 9999;
}

/* Показывать только при фокусе (keyboard navigation) */
.skip-link:focus {
  top: 1rem;
}
```

---

## Когда НЕ применять

**Никогда.** A11y — не фича, а базовое требование качества. Даже для внутреннего инструмента.

Если времени нет — приоритет:
1. Semantic HTML (бесплатно, всегда)
2. Keyboard navigation для основных flows
3. Контраст (быстро проверяется DevTools)
4. Alt-тексты для изображений
5. ARIA и focus trap — для сложных компонентов

---

## Типичные ошибки

1. **`<div onclick>` вместо `<button>`** — div не получает фокус, не активируется Enter/Space, не читается screen reader как кнопка.

2. **`<a href="#" onclick="...">` вместо `<button>`** — якорь для действия (не навигации) путает screen reader. Используй `<button>`.

3. **`outline: none` без замены** — keyboard user теряет ориентацию на странице.

4. **`alt` отсутствует у `<img>`** — без alt атрибута screen reader читает src (`team-meeting.jpg`). Всегда alt, даже `alt=""`.

5. **Динамический контент без `aria-live`** — toast, статус формы, ошибки добавленные в DOM не объявляются screen reader без `aria-live`.

6. **Модальное окно без focus trap** — keyboard user уходит за пределы modal через Tab, теряет контекст.

---

## Sources

- WCAG 2.1 — w3.org/TR/WCAG21
- MDN — "ARIA" guide
- Heydon Pickering — "Inclusive Components" (inclusive-components.design)
- WebAIM — webaim.org/techniques
- ARIA Authoring Practices Guide — w3.org/WAI/ARIA/apg
