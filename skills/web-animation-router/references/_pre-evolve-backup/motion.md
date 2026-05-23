# Motion (motion.dev) — Library Reference

**Purpose:** When and how to apply Motion to web animation tasks.

## Package

Formerly published as `framer-motion`; rebranded and republished as `motion` (current Motion release).
Import paths: `motion/react` (React), `motion-v` (Vue).

## When to Pick Motion

- Component lifecycle animations: mount, unmount, conditional render.
- State-driven UI: modals, drawers, accordions, toasts, hover states.
- Layout transitions: FLIP-style position changes via `layout` / `layoutId`.
- Shared-element transitions across routes.
- Gesture-driven micro-interactions: `whileHover`, `whileTap`, `whileDrag`.
- Simple scroll effects: parallax, fade-on-enter.
- Stagger reveals with React `variants` and `staggerChildren`.

## Sweet Spot

React (or Vue) apps where animations map directly to component state. Motion reads React
lifecycle events natively — no imperative cleanup needed. For teams already using React,
Motion is the lowest-friction choice for anything that is not complex SVG or scroll pinning.

## Core API Surface

```ts
// Declarative component
<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />

// Exit on unmount
<AnimatePresence>
  {isVisible && <motion.div exit={{ opacity: 0 }} />}
</AnimatePresence>

// Layout / FLIP
<motion.div layout layoutId="hero-image" />

// Gesture shortcuts
<motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} />

// Imperative one-off
import { animate } from 'motion'
animate(element, { x: 100 }, { duration: 0.4 })

// Scroll hooks
const { scrollYProgress } = useScroll()
const opacity = useTransform(scrollYProgress, [0, 1], [0, 1])

// Spring
<motion.div animate={{ x: 200 }} transition={{ type: 'spring', stiffness: 300 }} />
```

## Accessibility

```ts
import { useReducedMotion } from 'motion/react'

function Card() {
  const shouldReduce = useReducedMotion()
  return (
    <motion.div
      animate={{ opacity: 1, y: shouldReduce ? 0 : -20 }}
    />
  )
}
```

Gate all positional / decorative animations behind `useReducedMotion()`. Opacity fades are
generally acceptable even when motion is reduced.

## Bundle Discipline

| Import style | Approx. gzipped size |
|---|---|
| `import { motion } from 'motion/react'` | ~50KB |
| `LazyMotion` + `domAnimation` + `m.div` | ~20-25KB |

```tsx
// Optimised bundle
import { LazyMotion, domAnimation, m } from 'motion/react'

<LazyMotion features={domAnimation}>
  <m.div animate={{ opacity: 1 }} />
</LazyMotion>
```

Use `domMax` instead of `domAnimation` only when you need drag gestures — it adds ~5KB.

## Anti-patterns

- **Long timeline orchestration** — Motion has no `timeline()` equivalent with seek/labels;
  switch to GSAP for anything beyond simple `transition.delay` chaining.
- **SVG path-to-path morphing** — Motion has no MorphSVG capability; use GSAP MorphSVGPlugin.
- **Pinned scroll sections** — `useScroll` does not pin; GSAP ScrollTrigger is the tool.
- **Animating `width`, `height`, `top`, `left`** — these trigger layout reflow and break GPU
  compositing; animate `transform: scaleX/scaleY/translateX/translateY` instead.
- **Combining with GSAP on the same element** — both write `style.transform` imperatively;
  assign exactly one library per DOM element.
