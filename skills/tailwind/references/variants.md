# Tailwind 4 — Variants, @utility, @variant

## Built-in variant categories

### State variants (unchanged from v3)
`hover:`, `focus:`, `focus-within:`, `focus-visible:`, `active:`, `visited:`, `checked:`, `disabled:`, `enabled:`, `placeholder:`, `required:`, `valid:`, `invalid:`, `readonly:`

### Responsive (breakpoints)
`sm:`, `md:`, `lg:`, `xl:`, `2xl:` — mobile-first (apply at breakpoint and above)

Arbitrary: `min-[900px]:`, `max-[600px]:`, `@[200px]:` (container)

### Dark mode
`dark:` — see [dark-mode-setup.md](../examples/dark-mode-setup.md) for the two strategies

---

## New in Tailwind 4

### has-[selector]:

Style an element when any of its **descendants** match the selector:

```html
<!-- Checkbox checked → highlight parent card -->
<div class="has-[:checked]:bg-blue-50 has-[:checked]:border-blue-300 border rounded p-4">
  <input type="checkbox" />
  <span>Option</span>
</div>

<!-- Input focused → change label color -->
<label class="has-[:focus]:text-blue-600">
  <span>Email</span>
  <input type="email" />
</label>
```

Group/peer form: `group-has-[selector]:`, `peer-has-[selector]:`

```html
<div class="group">
  <input type="checkbox" />
  <span class="group-has-[:checked]:line-through">Task</span>
</div>
```

### not-[selector]:

Style when the element does **not** match a selector:

```html
<!-- Show placeholder only when list is empty -->
<ul class="not-[:has(li)]:flex not-[:has(li)]:items-center not-[:has(li)]:justify-center">
  <!-- items here -->
</ul>

<!-- Disabled button different opacity -->
<button class="not-[:disabled]:hover:bg-blue-600 disabled:opacity-50">Click</button>
```

### in-[selector]:

Style when an **ancestor** matches (similar to `group-*` but arbitrary):

```html
<p class="in-[.card-compact]:text-sm in-[.card-large]:text-base">Adaptive text</p>
```

### starting:

CSS `@starting-style` for **enter animations** (first render / display:none → visible):

```html
<dialog class="
  open:opacity-100 open:translate-y-0
  starting:open:opacity-0 starting:open:translate-y-4
  transition-all duration-200
">…</dialog>

<div class="
  opacity-100 scale-100
  starting:opacity-0 starting:scale-95
  transition-all duration-150
">Fade-in on mount</div>
```

`starting:` works with any CSS transition — no JS animation library needed for simple enter effects.

---

## Variant stacking

Variants compose left-to-right (read conditions right-to-left):

```html
dark:hover:focus:bg-blue-900
<!-- = bg-blue-900 when: dark mode AND hovered AND focused -->

@lg:has-[:checked]:grid-cols-3
<!-- = grid-cols-3 when: container ≥ lg AND has checked descendant -->

group-hover:dark:starting:opacity-0
<!-- = opacity-0 when: group hovered AND dark mode AND first render -->
```

---

## @utility — custom utilities

Replaces `plugin()` API. Custom utilities defined via `@utility` are:
- Automatically responsive (`sm:`, `md:`, etc.)
- Automatically dark-mode-aware
- Tree-shaken if unused

```css
@utility scrollbar-hide {
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
}

@utility truncate-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

@utility text-balance {
  text-wrap: balance;
}

@utility glass {
  background: oklch(100% 0 0 / 0.1);
  backdrop-filter: blur(12px);
  border: 1px solid oklch(100% 0 0 / 0.2);
}
```

Usage: `<p class="truncate-2">`, `<h1 class="text-balance">`, `<div class="glass">`

### Dynamic @utility (functional)

```css
@utility tab-{n} {
  tab-size: --value(integer);
}

@utility opacity-{n} {
  /* override built-in with custom logic */
  opacity: --value([percentage]);
}
```

`--value(integer)` captures the suffix as an integer. `--value([percentage])` accepts arbitrary values.

---

## @custom-variant — custom variants

Replaces `addVariant()` plugin API. (Tailwind 4: `@custom-variant` registers a NEW variant; `@variant` applies an existing variant inside custom CSS.)

```css
/* Enable `dark:` via class strategy */
@custom-variant dark (&:where(.dark, .dark *));

/* Logged-in state */
@custom-variant logged-in (:root.logged-in &);

/* High-contrast mode */
@variant high-contrast (@media (forced-colors: active) { & });

/* Print-only */
@variant print (@media print { & });

/* Reduced motion */
@variant motion-safe (@media (prefers-reduced-motion: no-preference) { & });
@variant motion-reduce (@media (prefers-reduced-motion: reduce) { & });
```

Usage: `<div class="logged-in:block hidden">Profile</div>`

### @variant with nesting

```css
/* Parent selector variant */
@variant sidebar-collapsed (:root:has([data-sidebar=collapsed]) &);
```

```html
<nav class="sidebar-collapsed:hidden w-64">…</nav>
```

---

## Arbitrary variants

One-off conditions without registering a @variant:

```html
<!-- Apply when nth-child(odd) -->
<li class="[&:nth-child(odd)]:bg-gray-50">…</li>

<!-- Apply when data attribute set -->
<div class="data-[state=open]:rotate-180">…</div>

<!-- Apply to direct children -->
<ul class="[&>li]:py-2 [&>li]:border-b">…</ul>

<!-- Apply inside a specific ancestor -->
<p class="[.theme-compact_&]:text-sm">…</p>
```

---

## @plugin — third-party plugins

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
@plugin "@tailwindcss/forms";
@plugin "./my-local-plugin.js";
```

The `@plugin` directive is the v4 way to register external utility/variant providers.
