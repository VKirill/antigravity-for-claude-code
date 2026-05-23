# Semantic HTML

Выбор правильного HTML-элемента — основа доступности и SEO.

---

## `<button>` vs `<a>` vs `<div>`

Три элемента постоянно путают. Правило простое:

| Элемент | Когда использовать |
|---|---|
| `<button>` | Действие без навигации (отправить, удалить, открыть modal, переключить тему) |
| `<a href>` | Навигация: переход на другую страницу/URL, или якорь на той же |
| `<div>` | Чисто структурный контейнер без смысла и без интерактивности |

```html
<!-- ПЛОХО: <a href="#"> для действия -->
<a href="#" onclick="deleteItem()">Удалить</a>

<!-- ПЛОХО: <div onclick> для кнопки -->
<div class="btn" onclick="openModal()">Открыть</div>

<!-- ХОРОШО -->
<button type="button" onclick="deleteItem()">Удалить</button>
<button type="button" onclick="openModal()">Открыть</button>

<!-- ХОРОШО: <a> только для реальной навигации -->
<a href="/products/123">Смотреть товар</a>
<a href="#section-reviews">Читать отзывы</a>
```

---

## Списки: `<ul>` / `<ol>` vs `<div>`

```html
<!-- ПЛОХО: дивы для списка -->
<div class="features">
  <div class="feature-item">Быстрая доставка</div>
  <div class="feature-item">Возврат 30 дней</div>
  <div class="feature-item">Поддержка 24/7</div>
</div>

<!-- ХОРОШО: семантический список -->
<ul class="features">
  <li>Быстрая доставка</li>
  <li>Возврат 30 дней</li>
  <li>Поддержка 24/7</li>
</ul>

<!-- Упорядоченный список: шаги, ранжирование -->
<ol class="steps">
  <li>Выберите товар</li>
  <li>Добавьте в корзину</li>
  <li>Оформите заказ</li>
</ol>

<!-- Описательный список: термин + определение -->
<dl class="specs">
  <dt>Вес</dt>
  <dd>1.2 кг</dd>
  <dt>Размеры</dt>
  <dd>30 × 20 × 10 см</dd>
</dl>
```

---

## Heading Hierarchy

Один `<h1>` на страницу. Потом `<h2>`, `<h3>` без пропусков.

```html
<!-- ПЛОХО: пропуски в иерархии, несколько h1 -->
<h1>Интернет-магазин</h1>
<h3>Популярные товары</h3>  <!-- пропущен h2 -->
<h1>Категории</h1>           <!-- второй h1 — ошибка -->
<h4>Электроника</h4>         <!-- пропущены h2 и h3 -->

<!-- ХОРОШО: логическая иерархия -->
<h1>Каталог товаров</h1>

<section>
  <h2>Популярные товары</h2>
  <article>
    <h3>Название товара 1</h3>
  </article>
  <article>
    <h3>Название товара 2</h3>
  </article>
</section>

<section>
  <h2>Категории</h2>
  <section>
    <h3>Электроника</h3>
    <h4>Смартфоны</h4>
    <h4>Ноутбуки</h4>
  </section>
</section>
```

Не используй `<h2>` для визуального размера — для этого CSS. Heading hierarchy — структура документа.

---

## Формы

```html
<!-- ПЛОХО: form без семантики -->
<div class="form">
  <div>Email</div>
  <input placeholder="Введите email" />
  <div class="btn" onclick="submit()">Отправить</div>
</div>

<!-- ХОРОШО: полная семантика -->
<form method="post" action="/contact" novalidate>
  <fieldset>
    <legend>Контактные данные</legend>

    <div class="field">
      <!-- label явно связан с input через for/id -->
      <label for="name">Имя <span aria-hidden="true">*</span></label>
      <input
        type="text"
        id="name"
        name="name"
        required
        autocomplete="name"
        aria-required="true"
      />
    </div>

    <div class="field">
      <label for="email">Email</label>
      <input
        type="email"
        id="email"
        name="email"
        required
        autocomplete="email"
        aria-describedby="email-hint"
      />
      <p id="email-hint" class="field__hint">
        Мы не передаём данные третьим лицам
      </p>
    </div>

    <div class="field">
      <label for="message">Сообщение</label>
      <textarea
        id="message"
        name="message"
        rows="4"
        maxlength="1000"
      ></textarea>
    </div>
  </fieldset>

  <!-- type="submit", не <div onclick> -->
  <button type="submit">Отправить</button>
</form>
```

### Правильные `input type`

| Данные | `type` |
|---|---|
| Email | `type="email"` |
| Телефон | `type="tel"` |
| URL | `type="url"` |
| Число | `type="number"` |
| Пароль | `type="password"` |
| Дата | `type="date"` |
| Чекбокс | `type="checkbox"` |
| Радио | `type="radio"` |
| Файл | `type="file"` |
| Поиск | `type="search"` |
| Скрытое поле | `type="hidden"` |

---

## Секционные элементы

```html
<!-- <article> — самодостаточный контент (можно вырвать из контекста) -->
<article>
  <h2>Заголовок статьи</h2>
  <time datetime="2026-05-17">17 мая 2026</time>
  <p>Текст статьи...</p>
</article>

<!-- <section> — тематическая группа с заголовком -->
<section aria-labelledby="reviews-heading">
  <h2 id="reviews-heading">Отзывы покупателей</h2>
  <!-- отзывы... -->
</section>

<!-- <aside> — контент косвенно связанный с основным -->
<aside aria-label="Читайте также">
  <h2>Похожие статьи</h2>
</aside>

<!-- <nav> — навигационные ссылки -->
<nav aria-label="Хлебные крошки">
  <ol>
    <li><a href="/">Главная</a></li>
    <li><a href="/catalog">Каталог</a></li>
    <li aria-current="page">Смартфоны</li>
  </ol>
</nav>

<!-- <figure> + <figcaption> — изображение с подписью -->
<figure>
  <img src="chart.png" alt="График продаж 2026 года" />
  <figcaption>Рис. 1 — Динамика продаж по кварталам</figcaption>
</figure>

<!-- <time> — машиночитаемая дата -->
<time datetime="2026-05-17T10:00:00+03:00">17 мая 2026, 10:00</time>
```

---

## Microdata / Schema.org (для SEO)

```html
<!-- Продукт -->
<article itemscope itemtype="https://schema.org/Product">
  <h1 itemprop="name">Смартфон XYZ</h1>
  <img itemprop="image" src="phone.jpg" alt="Смартфон XYZ" />
  <p itemprop="description">Флагманский смартфон с 6.7" экраном</p>

  <div itemprop="offers" itemscope itemtype="https://schema.org/Offer">
    <span itemprop="priceCurrency" content="RUB">₽</span>
    <span itemprop="price" content="79990">79 990</span>
  </div>
</article>

<!-- Организация в footer -->
<footer itemscope itemtype="https://schema.org/Organization">
  <span itemprop="name">Компания ООО</span>
  <a itemprop="url" href="https://example.com">example.com</a>
  <a itemprop="telephone" href="tel:+78001234567">8 800 123-45-67</a>
</footer>
```

Детали по Schema.org — в скилле `seo-copywriting`.

---

## Когда НЕ применять

**Никогда.** Semantic HTML всегда лучше несемантического — для доступности, SEO и maintainability. Исключений нет.

---

## Типичные ошибки

1. **`<a href="#">` для кнопок** — создаёт ложную навигацию, добавляет `#` в URL, путает screen reader. Используй `<button>`.

2. **`<h2>` без `<h1>` на странице** — нарушает иерархию документа. Screen reader и поисковики не могут определить главный заголовок.

3. **`<div>` вместо `<button>` для кликабельных элементов** — div не получает фокус по умолчанию, не реагирует на Enter/Space, не объявляется screen reader как button.

4. **`<input>` без `<label>`** — `placeholder` не заменяет label. Placeholder исчезает при вводе, label остаётся видимым всегда.

5. **`<section>` без заголовка** — section без `<h2>`-`<h6>` внутри (или `aria-labelledby`) является неправильным использованием. Без заголовка используй `<div>`.

6. **Вложенные интерактивные элементы** — `<a><button>...</button></a>` или `<button><a>...</a></button>` — невалидный HTML, поведение непредсказуемо.

---

## Sources

- MDN — "HTML elements reference"
- HTML Living Standard — whatwg.org/html
- WebAIM — "Semantic Structure: Regions, Headings, and Lists"
- Schema.org — schema.org/docs/gs.html
- Google Search Central — "Understand how structured data works"
