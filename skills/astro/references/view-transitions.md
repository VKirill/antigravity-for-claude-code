# View Transitions

SPA-like navigation without becoming an SPA. Built on the browser's View Transitions API (with fallback). Astro 6.x renames `<ViewTransitions />` to `<ClientRouter />`.

## Setup

Add `<ClientRouter />` once in your root layout's `<head>`:

```astro
---
// src/layouts/Layout.astro
import { ClientRouter } from 'astro:transitions'
---
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <ClientRouter />
  </head>
  <body>
    <slot />
  </body>
</html>
```

That's it. All same-origin links now navigate via fetch + diff + transition, preserving the JS context.

## Per-element transitions

Mark elements that should animate across pages with `transition:name`. The browser pairs up elements with the same name on incoming/outgoing pages.

```astro
<img src={post.cover} alt={post.title} transition:name={`cover-${post.id}`} />
<h1 transition:name={`title-${post.id}`}>{post.title}</h1>
```

On the list page:

```astro
{posts.map((post) => (
  <a href={`/blog/${post.id}`}>
    <img src={post.cover} transition:name={`cover-${post.id}`} />
    <h2 transition:name={`title-${post.id}`}>{post.title}</h2>
  </a>
))}
```

Now the cover image and title morph from list item → detail page.

## Built-in animations

Use the `transition:animate` directive with a preset:

```astro
<main transition:animate="slide">...</main>
<aside transition:animate="fade">...</aside>
<header transition:animate="initial">...</header>     {/* browser default */}
<section transition:animate="none">...</section>      {/* don't animate */}
```

## Custom animations

```astro
---
import type { TransitionAnimationPair } from 'astro'

const bounce: TransitionAnimationPair = {
  old: {
    name: 'bounceOut',
    duration: '0.3s',
    easing: 'ease-in',
  },
  new: {
    name: 'bounceIn',
    duration: '0.4s',
    easing: 'ease-out',
  },
}
---
<main transition:animate={bounce}>...</main>

<style is:global>
  @keyframes bounceOut { /* ... */ }
  @keyframes bounceIn { /* ... */ }
</style>
```

## Persist state across pages

Marked elements keep their DOM (and JS state) when navigating — useful for video players, audio players, sticky widgets.

```astro
<audio controls src="/podcast.mp3" transition:persist></audio>
<aside transition:persist="sidebar">
  <ChatWidget client:load />
</aside>
```

The chat widget's React state survives the navigation.

## Lifecycle events

```ts
import { navigate } from 'astro:transitions/client'

document.addEventListener('astro:before-preparation', (e) => {
  // before fetching the next page
})
document.addEventListener('astro:after-preparation', (e) => {
  // got the response, before swap
})
document.addEventListener('astro:before-swap', (e) => {
  // about to swap DOMs
})
document.addEventListener('astro:after-swap', (e) => {
  // new DOM in place, transitions about to play
})
document.addEventListener('astro:page-load', (e) => {
  // navigation complete, idle
})
```

Use `astro:page-load` instead of `DOMContentLoaded` for code that re-runs on every navigation (analytics page-view, third-party widget init).

## Programmatic navigation

```ts
import { navigate } from 'astro:transitions/client'

await navigate('/dashboard')                    // SPA-style navigation
await navigate('/', { history: 'replace' })     // replaceState
await navigate('/login?next=' + location.pathname, { formData: new FormData(formEl) })
```

## Opt out per-link

```html
<a href="/external-app" data-astro-reload>Reload (no transition)</a>
```

## Form submissions

Forms inside transition-enabled pages submit via fetch and respect the transition flow. Add `data-astro-reload` to fall back to full reload (useful for file uploads with progress).

## Common pitfalls

- **Forgetting `<ClientRouter />` in layout** — directives like `transition:name` do nothing without it
- **Duplicate `transition:name` values on a page** — only the first match animates
- **Re-running `<script>` tags without `is:inline`** — by default Astro deduplicates inline scripts across navigations; mark them with `is:inline` if you want them to re-execute, or use `astro:page-load`
- **Third-party widgets breaking after navigation** — wrap init in `astro:page-load` listener or `transition:persist` the container
- **Animation flicker on mobile Safari** — older WebKit versions fall back to instant swap; that's OK
- **`<ClientRouter />` outside `<head>`** — it must be in `<head>` to attach to navigation events early enough
