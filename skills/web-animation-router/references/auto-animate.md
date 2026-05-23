# AutoAnimate — Library Reference

**Purpose:** When and how to apply AutoAnimate to web animation tasks.

## Version & Size

Latest stable release. Small bundle (~kilobytes), minified. Zero dependencies.

## What It Does

AutoAnimate watches a parent element's immediate children. When children are added, removed,
or reordered in the DOM, it automatically applies smooth morph-style transitions — no
configuration required. It does not animate arbitrary CSS properties or handle scroll triggers.

## When to Pick AutoAnimate

- List items added or removed with no custom timing required.
- Accordion children appearing and disappearing.
- Conditional renders inside a container (show/hide cards, tabs).
- Retrofitting motion onto existing markup with minimal code change.
- "I just want something to animate nicely" with zero setup.

## Framework Adapters

| Framework | Usage |
|---|---|
| React | `useAutoAnimate()` hook |
| Vue | `v-auto-animate` directive or `useAutoAnimate` composable |
| Svelte | `autoAnimate` action |
| Preact | `useAutoAnimate()` hook |
| Solid | `createAutoAnimate` primitive |
| Angular | `AutoAnimateDirective` |
| Vanilla JS | `autoAnimate(parentEl)` function |

## Configuration

```ts
// React
const [listRef] = useAutoAnimate({ duration: 300, easing: 'ease-in-out' })
<ul ref={listRef}>...</ul>

// Custom KeyframeEffect for advanced cases
const [ref] = useAutoAnimate((el, action) => {
  return new KeyframeEffect(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 })
})

// Vanilla
import autoAnimate from '@formkit/auto-animate'
autoAnimate(document.querySelector('#list'))
```

## Accessibility

Respects `prefers-reduced-motion` by default — animations are suppressed when the user
has enabled the system setting. To override:

```ts
useAutoAnimate({ disrespectUserMotionPreference: true })
```

Do not set `disrespectUserMotionPreference: true` unless the animation conveys essential
information that cannot be communicated another way.

## Limitations

- **Immediate children only** — grandchildren and deeper descendants are not observed.
- **No arbitrary property animation** — cannot tween colors, opacity on non-child elements,
  transforms outside of add/remove/move transitions.
- **No timeline or sequencing** — every transition plays immediately with shared config.
- **No scroll-triggered animation** — it reacts to DOM mutations only.
- **`position: relative` injection** — if the parent element is statically positioned,
  AutoAnimate sets `position: relative` on it at runtime. Absolute-positioned children
  that relied on a static parent ancestor will shift.
- **Flexbox `flex-grow`** — items without explicit width inside a flex container may
  misbehave during add/remove transitions.
- **SSR** — the relative-position injection happens at runtime. Server-rendered HTML does
  not contain it; apply the hook client-side only to avoid hydration mismatches.

## Anti-patterns

- **Custom easing per element or duration per item** — AutoAnimate applies one config to all
  children; use Motion for per-element control.
- **Animating grandchildren, siblings, or non-child elements** — only immediate children
  of the registered parent are observed; use Motion or GSAP.
- **Exit timing coordination** — AutoAnimate removes nodes immediately; if you need to delay
  DOM removal until an exit animation finishes, use Motion `AnimatePresence`.
- **Scroll-triggered or timeline animation** — outside AutoAnimate's scope; use GSAP
  ScrollTrigger or Motion `useScroll`.
