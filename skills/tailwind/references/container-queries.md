# Tailwind 4 — Container Queries

Container queries are **built in** to Tailwind 4. No plugin installation required.

## Basic usage

Mark a parent with `@container`, then use `@{breakpoint}:` on its children:

```html
<div class="@container">
  <div class="grid grid-cols-1 @sm:grid-cols-2 @lg:grid-cols-3 gap-4">
    <article>…</article>
    <article>…</article>
  </div>
</div>
```

The grid responds to the **container's width**, not the viewport width. This is the key difference from `sm:`, `md:`, `lg:` (which are viewport-based).

## Container breakpoints

Tailwind 4 default container breakpoints:

| Variant | Min-width |
|---|---|
| `@xs:` | 20rem (320px) |
| `@sm:` | 24rem (384px) |
| `@md:` | 28rem (448px) |
| `@lg:` | 32rem (512px) |
| `@xl:` | 36rem (576px) |
| `@2xl:` | 42rem (672px) |
| `@3xl:` | 48rem (768px) |
| `@4xl:` | 56rem (896px) |
| `@5xl:` | 64rem (1024px) |
| `@6xl:` | 72rem (1152px) |
| `@7xl:` | 80rem (1280px) |

Custom thresholds: `@[200px]:`, `@[50rem]:`, `@[calc(50%-1rem)]:`

---

## Named containers

Name a container to target it specifically from deeply nested children:

```html
<div class="@container/sidebar">
  <nav class="@container/sidebar-nav">
    <!-- target the outer container by name -->
    <ul class="@md/sidebar:flex @md/sidebar:flex-row flex-col">…</ul>
  </nav>
</div>
```

Syntax: `@container/{name}` on parent, `@{breakpoint}/{name}:` on child.

Use named containers when:
- Multiple nested `@container` elements could match
- You want to target a specific ancestor from a deeply nested child
- The component is reusable and might appear at different depths

---

## Inline-size vs block-size

By default `@container` creates a container query context on the **inline axis** (width). For height-based queries:

```css
@utility container-block {
  container-type: block-size;
}
```

```html
<div class="container-block @container h-64">
  <p class="@[100px]:text-sm @[200px]:text-base">Adapts to height</p>
</div>
```

---

## Container query units

CSS container query units work in arbitrary values:

```html
<div class="@container">
  <!-- w-[50cqw] = 50% of container width -->
  <div class="w-[50cqw] h-[25cqh]">…</div>
</div>
```

| Unit | Meaning |
|---|---|
| `cqw` | 1% of container query inline size (width) |
| `cqh` | 1% of container query block size (height) |
| `cqi` | 1% of container query inline size |
| `cqb` | 1% of container query block size |
| `cqmin` | Smaller of `cqi` or `cqb` |
| `cqmax` | Larger of `cqi` or `cqb` |

---

## Style queries (experimental)

Query a container's CSS custom property value (not just size):

```css
/* Only works if container has container-type set */
@container style(--variant: compact) {
  .card-body { padding: 0.5rem; }
}
```

Tailwind 4 supports style queries via arbitrary values:
```html
<div class="@container [--variant:compact]">
  <div class="@[style(--variant:compact)]:p-2 p-4">…</div>
</div>
```

Style queries have limited browser support — check caniuse before using in production.

---

## Common patterns

### Card that reflows based on available space

```html
<div class="@container rounded-xl border bg-card">
  <div class="flex flex-col @sm:flex-row gap-4 p-4">
    <img class="@sm:w-32 @sm:h-32 w-full h-48 object-cover rounded-lg" />
    <div class="flex flex-col gap-2">
      <h3 class="@sm:text-xl text-lg font-semibold">Title</h3>
      <p class="text-muted-fg @sm:line-clamp-3 line-clamp-2">Description</p>
    </div>
  </div>
</div>
```

### Sidebar that collapses at narrow widths

```html
<aside class="@container/sidebar w-64 data-[collapsed]:w-16">
  <nav class="p-4 @[64px]/sidebar:p-2">
    <a class="flex items-center gap-3 @[64px]/sidebar:justify-center">
      <Icon />
      <span class="@[64px]/sidebar:hidden">Dashboard</span>
    </a>
  </nav>
</aside>
```

### Grid that adapts to its container

```html
<section class="@container">
  <div class="
    grid gap-4
    grid-cols-1
    @sm:grid-cols-2
    @lg:grid-cols-3
    @2xl:grid-cols-4
  ">
    <!-- items -->
  </div>
</section>
```

---

## Container queries vs viewport queries

| Use viewport (`sm:`, `md:`) | Use container (`@sm:`, `@lg:`) |
|---|---|
| Page-level layout (header, main, sidebar widths) | Component-level layout (card internals, nav items) |
| Components that are always full-width | Reusable components placed at varying widths |
| Simple responsive breakpoints for top-level structure | Components inside sidebars, modals, drawers |

Rule of thumb: **viewport queries for structure, container queries for components**.

---

## Gotchas

- A container query element cannot query itself — `@container` creates a context, and child elements respond to it, but the container itself cannot use `@{bp}:` based on its own size
- Container size is affected by padding — use `box-sizing: border-box` (Tailwind's default via Preflight)
- `overflow: hidden` on the container does NOT prevent container query detection
- Container queries do NOT work on the `:root` or `html` element
