# GSAP — Library Reference

**Purpose:** When and how to apply GSAP to web animation tasks.

## Licensing

Critical licensing change in the current GSAP release (post-Webflow ownership): **all premium plugins are now FREE
for commercial use**. No Club GSAP membership required.
Plugins are publicly distributed via npm and GitHub. Covered plugins include: SplitText,
MorphSVG, DrawSVG, MotionPathPlugin, ScrollTrigger, ScrollSmoother, ScrollTo, Flip,
Draggable, InertiaPlugin, Observer, ScrambleText, TextPlugin, Physics2D, PhysicsProps,
GSDevTools.

## When to Pick GSAP

- Multi-step timelines requiring precise sequencing, labels, or playback control.
- Scroll-pinned narratives, scrubbed timelines, multiple simultaneous triggers.
- SVG: path morphing, stroke draw-in, element along a path.
- Text effects: split by char/word/line, scramble, type-in.
- Drag with physics: inertia throw, snap, bounds.
- Framework-agnostic context (no React/Vue — plain JS, server-rendered HTML).

## Plugin Map

| Plugin | Use case |
|---|---|
| `ScrollTrigger` | Pin, scrub, snap, batch, multiple viewport triggers |
| `MorphSVGPlugin` | Morph `<path>` d attribute from one shape to another |
| `DrawSVGPlugin` | Animate SVG stroke draw-on |
| `MotionPathPlugin` | Move element along an SVG `<path>` |
| `SplitText` | Split text into chars / words / lines for stagger |
| `ScrambleText` | Cypher / scramble reveal effect |
| `Flip` | Record DOM state → mutate → animate transition (FLIP) |
| `Draggable` | Drag with bounds and optional inertia |
| `InertiaPlugin` | Physics-based throw / snap (used by Draggable) |
| `CustomEase` | Define arbitrary easing curve from SVG path |

## Core API Surface

```js
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin'

// Always register plugins before use
gsap.registerPlugin(ScrollTrigger, MorphSVGPlugin)

// Basic tweens
gsap.to('.box', { x: 200, duration: 0.6, ease: 'power2.out' })
gsap.from('.card', { opacity: 0, y: 40, stagger: 0.1 })
gsap.fromTo('.hero', { opacity: 0 }, { opacity: 1, duration: 1 })

// Timeline — sequencing
const tl = gsap.timeline({ defaults: { ease: 'power2.out' } })
tl.from('.title', { y: 60, opacity: 0 })
  .from('.subtitle', { y: 40, opacity: 0 }, '-=0.2')
  .from('.cta', { scale: 0.8, opacity: 0 }, '<')

// ScrollTrigger
gsap.to('.panel', {
  scrollTrigger: {
    trigger: '.panel',
    pin: true,
    scrub: 1,
    start: 'top top',
    end: '+=500',
  },
  x: 500,
})

// React hook
import { useGSAP } from '@gsap/react'
useGSAP(() => {
  gsap.to('.box', { rotation: 360, duration: 1 })
}, { scope: containerRef })
```

## Accessibility

GSAP has no built-in `prefers-reduced-motion` gate. Check manually:

```js
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
if (!prefersReduced) {
  gsap.from('.hero', { y: 80, opacity: 0, duration: 1 })
}
```

For `ScrollTrigger`, consider reducing `scrub` intensity or skipping pin when motion is reduced.

## Bundle

Core `gsap` package: ~30KB gzipped. Each plugin adds 5–15KB. Import only the plugins you use:

```js
// Good — import only what you need
import { ScrollTrigger } from 'gsap/ScrollTrigger'

// Bad — pulls every plugin
import 'gsap/all'
```

## Anti-patterns

- **Simple React state transitions** — Motion handles lifecycle natively; GSAP requires manual
  ref management and cleanup via `useGSAP` or `useEffect` + `kill()`.
- **Trivial list add/remove** — AutoAnimate delivers zero-config DOM-mutation animation in a small bundle;
  GSAP is overkill and requires manual DOM observation.
- **Combining with Motion on the same element** — both write `style.transform` from JS;
  the last write wins, producing unpredictable results.
- **Importing `gsap/all`** — pulls all plugins regardless of use; import individually.
- **Forgetting `gsap.registerPlugin()`** — the plugin file must be imported AND registered;
  omitting registration silently disables the plugin with no error.
