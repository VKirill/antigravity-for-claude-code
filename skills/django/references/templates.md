# Templates

Django's template engine — the Django Template Language (DTL) — emphasizes logic-less templates with composable inheritance.

## Configuration

```python
# settings.py
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],     # project-wide templates
        "APP_DIRS": True,                     # also look in each app's templates/<app>/
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "django.template.context_processors.csrf",
            ],
        },
    },
]
```

Convention: `shop/templates/shop/product_list.html`. The duplicated `shop/` path namespaces templates so two apps can both define `product_list.html` without collision.

## Inheritance

`base.html`:

```django
<!DOCTYPE html>
<html lang="en">
<head>
  <title>{% block title %}MyApp{% endblock %}</title>
  {% block head %}{% endblock %}
</head>
<body>
  <nav>…</nav>
  <main>{% block content %}{% endblock %}</main>
</body>
</html>
```

`product_list.html`:

```django
{% extends "base.html" %}
{% load humanize %}

{% block title %}Products — {{ block.super }}{% endblock %}

{% block content %}
  <h1>Products</h1>
  <ul>
  {% for p in products %}
    <li>
      <a href="{% url 'shop:product_detail' pk=p.pk %}">{{ p.name }}</a>
      — {{ p.price_cents|intcomma }} ¢
    </li>
  {% empty %}
    <li>No products yet.</li>
  {% endfor %}
  </ul>
{% endblock %}
```

`{% extends %}` must be the **first** non-whitespace tag. `block.super` injects the parent block's content.

## Variables, filters, tags

```django
{{ user.username }}                          {# attribute / dict / method lookup #}
{{ price|floatformat:2 }}                    {# filters chain with | #}
{{ name|default:"Guest" }}
{{ html_content|safe }}                      {# disable autoescape for this var #}

{% if user.is_authenticated %}…{% endif %}
{% for item in items %}…{% empty %}…{% endfor %}
{% url 'shop:product_detail' pk=p.pk %}
{% include "shop/_product_card.html" with product=p %}
{% csrf_token %}
```

The `forloop` variable inside `{% for %}` exposes `counter`, `counter0`, `revcounter`, `first`, `last`, `length` (Django 6+ exposes `length` consistently).

## Autoescape

DTL escapes `&`, `<`, `>`, `"`, `'` by default. Mark a value as safe with the `|safe` filter or render with `format_html()` server-side. Never `|safe` user-provided HTML.

```python
# In a view — preferred over template-level |safe
from django.utils.html import format_html

message = format_html("<strong>{}</strong> joined", user.username)
```

## Custom template tags and filters

Create `<app>/templatetags/__init__.py` and `<app>/templatetags/shop_extras.py`:

```python
# shop/templatetags/shop_extras.py
from django import template
from django.utils.safestring import mark_safe

register = template.Library()

@register.filter
def percent(value, total) -> str:
    if not total:
        return "0%"
    return f"{value / total * 100:.1f}%"

@register.simple_tag(takes_context=True)
def active_link(context, url_name: str) -> str:
    request = context["request"]
    return "active" if request.resolver_match.url_name == url_name else ""

@register.inclusion_tag("shop/_product_card.html")
def product_card(product):
    return {"product": product}
```

```django
{% load shop_extras %}

<a class="{% active_link 'product_list' %}" href="{% url 'shop:product_list' %}">Products</a>
<span>{{ sold|percent:total }}</span>
{% product_card product=p %}
```

## Context processors

Functions that add variables to **every** template's context. Use sparingly — every request pays for every processor.

```python
# shop/context_processors.py
def site_settings(request):
    return {"SITE_NAME": "MyShop", "CART_COUNT": request.session.get("cart_count", 0)}
```

Register in `TEMPLATES["OPTIONS"]["context_processors"]`. Common built-ins: `request`, `auth`, `messages`, `csrf` (already in the snippet above).

## Template partials (Django 6)

Django 6 ships an official partials syntax — define + reuse a fragment inside the same template:

```django
{# product_list.html #}
{% partialdef row %}
  <li><a href="{% url 'shop:product_detail' pk=p.pk %}">{{ p.name }}</a></li>
{% endpartialdef %}

<ul>
  {% for p in products %}
    {% partial "row" p=p %}
  {% endfor %}
</ul>
```

You can also render a partial from another template using the `template#partial` syntax in `get_template()`, `render()`, and `{% include %}`. This is great for HTMX-style partial responses.

## Including & embedding

```django
{% include "shop/_product_card.html" with product=p %}
{% include "shop/_product_card.html" with product=p only %}   {# only the passed vars, no inherited context #}
```

Prefer composition over deep inheritance once a template has more than two `{% extends %}` layers.

## Jinja2 backend (alternative)

Django supports Jinja2 as a parallel template backend:

```python
TEMPLATES = [
    {"BACKEND": "django.template.backends.jinja2.Jinja2", "DIRS": [...], "APP_DIRS": True},
    {"BACKEND": "django.template.backends.django.DjangoTemplates", "DIRS": [...], "APP_DIRS": True},
]
```

When to pick Jinja2: faster rendering, richer expression syntax, ecosystem familiarity. Trade-off: third-party Django apps assume DTL and ship DTL templates — you'll still need DTL for admin / DRF browsable API.

Keep most projects on DTL unless rendering performance is a measured bottleneck.

## Performance tips

- Cache rendered fragments with `{% cache %}` (template fragment cache) — see [caching-and-sessions.md](caching-and-sessions.md)
- Avoid heavy database lookups inside templates; do the work in the view and pass primitives
- Don't iterate a queryset that lazy-loads relations — `select_related` / `prefetch_related` in the view
- `{% include %}` is more expensive than inline markup; use it when it earns reuse

## Common pitfalls

- Forgetting `{% csrf_token %}` inside a `<form method="post">` — request fails with 403
- Calling `{% url 'name' %}` without namespace when one exists — `NoReverseMatch`
- Using `|safe` on user input — XSS
- Putting business logic in templates instead of the view or a manager method — tests get harder
- `{% load %}`-ing a template tag library inside the wrong app — Django can't find it; use full dotted path or move the `templatetags/` package
