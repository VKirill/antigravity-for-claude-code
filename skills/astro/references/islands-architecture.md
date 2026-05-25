# Islands Architecture

Astro's zero-JS-by-default model and the `client:*` directives that opt components into hydration.

## Mental model

A page is **HTML by default**. Anywhere you want JavaScript to ship to the browser, you mark a single component with a `client:*` directive. Each marked component is an **island** — a self-contained interactive widget surrounded by static HTML.

Astro components (`.astro` files) **never ship JavaScript**. Only framework components (React/Vue/Svelte/Solid) inside `.astro` files can be islands.

## `client:*` directives

| Directive | When it hydrates | Use for |
|---|---|---|
| `client:load` | Immediately at page load | Critical above-the-fold interactivity (top nav, cart counter) |
| `client:idle` | When `requestIdleCallback` fires | Non-critical visible widgets |
| `client:visible` | When IntersectionObserver fires | Anything below the fold |
| `client:visible={{rootMargin}}` | Scroll into view with margin | Pre-hydrate just before visible |
| `client:media={query}` | When media query matches | Mobile menu, desktop sidebar |
| `client:only={framework}` | Skip SSR entirely | Components that crash on SSR (canvas, browser APIs) |

## Examples

```astro
---
import Counter from '../components/Counter.tsx'
import Carousel from '../components/Carousel.tsx'
import MobileMenu from '../components/MobileMenu.tsx'
---
<header>
  <Counter client:load />           {/* above the fold, critical */}
  <MobileMenu client:media="(max-width: 768px)" />
</header>
<main>
  <article>... static content ...</article>
  <Carousel client:visible />       {/* below fold, lazy */}
</main>
```

## `client:only` for client-rendered components

```astro
<!-- This component uses window/document at top level -->
<ChartJS client:only="react" />
```

You must specify the framework so Astro knows which hydration runtime to load.

## Sharing state between islands

Islands are **independent** by default — two `<Counter client:load />` instances don't share state.

For cross-island state use **nano stores** (`nanostores` + `@nanostores/react`/`@nanostores/vue`) or Solid signals from `@nanostores/solid`. Each island subscribes to the same store atom.

```ts
// src/stores/cart.ts
import { atom } from 'nanostores'
export const cart = atom<CartItem[]>([])
```

```tsx
// CartCount.tsx (island A)
import { useStore } from '@nanostores/react'
import { cart } from '../stores/cart'
export default function CartCount() {
  const $cart = useStore(cart)
  return <span>{$cart.length}</span>
}
```

```tsx
// AddToCart.tsx (island B)
import { cart } from '../stores/cart'
export default function AddToCart({ item }) {
  return <button onClick={() => cart.set([...cart.get(), item])}>Add</button>
}
```

## Passing props to islands

Props are serialized to JSON and embedded in the HTML, then re-hydrated. Constraints:

- Props must be JSON-serializable (no functions, no DOM nodes, no Date — use ISO strings)
- Large prop blobs balloon HTML size — fetch on the client for big data
- `Set`/`Map` work but become arrays/objects in JSON

```astro
---
const posts = await getCollection('blog')
---
<PostList client:visible posts={posts.slice(0, 10)} />
```

## Slots in framework islands

Astro slots **don't pass children into client-only-hydrated islands** the way React children work. Slot content is rendered as static HTML and inserted as `<slot />` markers.

```astro
<ReactCard client:load>
  <h2>This is static HTML, not React children</h2>
  <p>It renders fine but React won't see it as JSX children.</p>
</ReactCard>
```

For interactive children patterns, restructure as a single React component or pass props.

## Common mistakes

- **`client:load` everywhere** — defeats the zero-JS benefit. Audit with `astro build --analyze` (or Lighthouse).
- **Hydrating static components** — if a `Card` component never has event handlers, write it as `.astro`, not as `.tsx` with `client:load`.
- **Forgetting `client:only` for browser-only libraries** — chart libraries that touch `window` at module-eval time crash SSR.
- **Mixing frameworks for a single feature** — React `Counter` + Vue `CartCount` is fine (different islands) but rendering one inside the other isn't supported.

## Performance check

A well-architected Astro page ships <30 KB of JS for typical content sites. If your bundle is bigger, run:

```bash
npm run build -- --verbose
```

and review which components are hydrated. Replace `client:load` with `client:visible` wherever possible, and convert leaf components from `.tsx` to `.astro`.
