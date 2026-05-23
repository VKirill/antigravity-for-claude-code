---
name: web-animation-router
description: "Route AND implement web animation for 2026 — pick the right tool (CSS-native, Motion/motion.dev, GSAP, AutoAnimate, Rive, dotLottie) then apply production recipes. Covers: motion tokens & CSS native springs via linear(), scroll-driven animation (CSS scroll-timeline + GSAP/Lenis), page/View Transitions, kinetic typography & variable fonts, microinteraction catalog, AI-product UX motion (streaming/thinking states), motion accessibility & performance. Use when: animation library, framer motion, motion, gsap, lenis, autoanimate, rive, lottie, scroll animation, scroll-driven, view transition, svg morph, splittext, layout shift, timeline, springs, easing tokens, kinetic type, variable font animation, microinteraction, streaming UI, reduced-motion, INP, will-change. SKIP: canvas/WebGL 3D scenes (→three.js/r3f), video render (→remotion)."
stacks:
  - CSS-native
  - Motion
  - GSAP
  - Lenis
  - AutoAnimate
  - Rive
  - dotLottie
tags:
  - animation
  - motion
  - gsap
  - lenis
  - autoanimate
  - scroll
  - view-transitions
  - springs
  - tokens
  - kinetic-typography
  - microinteractions
  - ai-ux
  - accessibility
  - performance
  - ui
  - ux
source: vechkasov-global-skills
risk: low-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (verified via harvest 2026-05-22)

**Primary pins:**
- GSAP: `3.15.0` (released April 2026; all plugins free for commercial use post-Webflow acquisition — ScrollTrigger, Flip, SplitText, MorphSVG, DrawSVG, Observer, MotionPath, ScrambleText, `@gsap/react` useGSAP)
- Motion (motion.dev, ex-framer-motion): `12.x` (package `motion`; React entry `motion/react`, Vue `motion-v`; hybrid WAAPI/JS engine)
- Lenis (smooth scroll): `1.3.x` (package `lenis`; the old `@studio-freight/lenis` is deprecated)
- AutoAnimate: `0.9.x` (~2.3KB; immediate-children morph; respects prefers-reduced-motion by default)
- Rive: WASM runtime for interactive vector state machines; dotLottie: `@lottiefiles/dotlottie-web` for AE handoff (replaces heavy `lottie-web`)
- CSS-native: `linear()` springs, `animation-timeline: scroll()/view()`, `@starting-style`, `interpolate-size: allow-keywords`, cross-document View Transitions (verify per-browser support in references)

> Some design-system token VALUES in `references/motion-tokens-and-springs.md` are marked `[UNVERIFIED]` — confirm against the live design-system docs before quoting exact numbers.

<!-- versions:end -->

## Use this skill when

- Picking AND implementing an animation approach for a feature, section, or whole site
- Defining a **motion token system** (durations, easings, CSS native springs via `linear()`)
- **Scroll-driven** work: CSS scroll/view timelines, or GSAP ScrollTrigger pinning/scrubbing + Lenis
- **Page transitions**: same- or cross-document View Transitions API, or JS routers (swup/taxi/barba)
- **Kinetic typography**: variable-font axis animation, split/stagger reveals, text-on-path, marquee
- **Microinteractions**: buttons, toggles, inputs, tabs, accordion, tooltip, menu, card hover, etc.
- **AI-product UX motion**: thinking states, streaming token text, tool-use/agent indicators
- SVG morph, stroke draw-in, path-following; list add/remove/reorder; component enter/exit
- Enforcing **motion accessibility** (`prefers-reduced-motion`, vestibular safety, WCAG 2.2)
- Hitting **performance** budgets (compositor-only props, INP, RAF discipline) with motion

## Do not use this skill when

- Pure decorative CSS keyframes already suffice (a spinner, a shimmer) — just write the CSS
- 3D / WebGL / shader scenes are needed → `three.js` / `react-three-fiber` skills
- Programmatic video rendering → `remotion`

## Purpose

Route each motion task to the cheapest tool that satisfies it (CSS-first, escalate only when needed), then apply a verified 2026 recipe. The skill encodes: a token+spring foundation, a decision matrix across CSS/Motion/GSAP/AutoAnimate/Rive/dotLottie, deep per-library references, and cross-cutting discipline (accessibility, performance, interop). Strict rule: **one library per DOM element**, **CSS before JS**, **reduced-motion always gated**.

## Routing — the core decision

What is changing in the DOM, and how much control is needed?

- Hover/focus/toggle micro-state, color/opacity, accordion `height:auto` → **CSS-only** (transitions, `interpolate-size`, `@starting-style`, `linear()` springs)
- Simple scroll reveal / progress / parallax (no pinning) → **CSS scroll-driven** (`animation-timeline`)
- Complex scroll choreography (pin, scrub, snap, multi-trigger) → **GSAP ScrollTrigger + Lenis**
- List add/remove/reorder, zero-config → **AutoAnimate** (non-React or lightweight)
- State-driven UI, layout/shared-element morph, gestures, exit animations → **Motion** (`layout`/`layoutId`/`AnimatePresence`)
- Precise multi-step timelines, SVG morph/draw, text effects → **GSAP** (+plugins)
- Interactive vector with state logic (game-like) → **Rive**; After-Effects vector handoff → **dotLottie**

Full tree + scoring matrix + bundle costs: [references/animation-library-decision-matrix.md](references/animation-library-decision-matrix.md).

## Reference library

| Topic | File |
|---|---|
| **Decision matrix** — scoring, if/then tree, tool combos, "never use a lib when CSS suffices" | [references/animation-library-decision-matrix.md](references/animation-library-decision-matrix.md) |
| **Motion tokens & springs** — `tokens.css`, `linear()` spring generator + 6 tokens, real DS token sets (Carbon/Atlassian/M3/Primer/Polaris/Geist/Linear), recommended default set | [references/motion-tokens-and-springs.md](references/motion-tokens-and-springs.md) |
| **Scroll-driven animation** — CSS scroll/view timelines vs GSAP+Lenis, sync recipe, budgets | [references/scroll_driven_animations_2026.md](references/scroll_driven_animations_2026.md) |
| **GSAP 3.15 plugin recipes** — ScrollTrigger/Flip/SplitText/Observer/MotionPath/MorphSVG/DrawSVG/ScrambleText + useGSAP cleanup + Next/Astro gotchas | [references/gsap-315-plugin-recipes.md](references/gsap-315-plugin-recipes.md) |
| **Motion (motion.dev) v12 React** — layout/layoutId, AnimatePresence, gestures, useScroll/useSpring, variants, optimistic AI streaming | [references/motiondev-v12-react.md](references/motiondev-v12-react.md) |
| **Page transitions** — same/cross-document View Transitions, framework integration, JS routers, persistent-WebGL pattern | [references/page-transitions-2026.md](references/page-transitions-2026.md) |
| **Kinetic typography** — variable-font axis animation via scroll velocity, masked/stagger reveals, textPath, accessible marquee | [references/kinetic-typography.md](references/kinetic-typography.md) |
| **Microinteraction catalog** — per-control spec (trigger/property/duration/easing/reduced-motion) + code | [references/microinteractions-catalog.md](references/microinteractions-catalog.md) |
| **AI-product UX motion** — thinking states, streaming token text, tool-use/confidence/regeneration | [references/ai-ux-motion-patterns.md](references/ai-ux-motion-patterns.md) |
| **Motion accessibility** — correct reduced-motion fallbacks (not mute-all), vestibular thresholds, WCAG 2.2, focus mgmt | [references/motion-accessibility.md](references/motion-accessibility.md) |
| **AutoAnimate** — framework adapters, config, limitations | [references/auto-animate.md](references/auto-animate.md) |

## Cross-cutting discipline

### Interop hazards
- **Motion and GSAP must not animate the same element** — both write `style.transform`; last-writer wins → jitter. One library per element.
- **GSAP plugins require explicit `gsap.registerPlugin(...)`** — importing the file is not enough; missing registration silently no-ops.
- **AutoAnimate injects `position: relative`** on the parent at runtime (client-only) — apply client-side in SSR to avoid hydration mismatch; absolute children may shift.
- **Lenis + GSAP**: drive Lenis from the GSAP ticker and `ScrollTrigger.update` on Lenis scroll; `gsap.ticker.lagSmoothing(0)`. Never also enable CSS `scroll-behavior: smooth`.

### Accessibility gate (always)
- Motion: `useReducedMotion()` — drop spatial movement, keep opacity fades.
- AutoAnimate: respects the query by default; `disrespectUserMotionPreference: true` only if essential.
- GSAP / CSS: check `matchMedia('(prefers-reduced-motion: reduce)')`; reduce scrub/pinning. Never a global `* { animation: none }` reset — it breaks accordions/modals. See [references/motion-accessibility.md](references/motion-accessibility.md).

### Performance gate
- Animate compositor-only properties (`transform`, `opacity`, `filter`); never `width/height/top/left/margin`.
- `will-change` sparingly; RAF auto-pause on `document.hidden`; lazy-init via IntersectionObserver; clamp `Math.min(devicePixelRatio, 2)`.
- Keep INP < 200ms — prefer CSS/WAAPI off-main-thread for anything that can be declarative. (Perf depth lives in scroll + microinteraction references; a dedicated `motion-performance.md` is pending re-harvest.)

## Behavioral Traits

- Match task → decision tree before choosing a library; never start from a library preference.
- CSS-first: escalate to JS only when the matrix says so.
- One animation library per DOM element; comment the choice when mixing libraries in a file.
- Define motion tokens once (durations/easings/springs) and reuse — don't scatter magic numbers.
- Register every GSAP plugin at entry; use `useGSAP` for React cleanup.
- Gate all positional/decorative motion behind `prefers-reduced-motion`.

## Important Constraints

- NEVER apply both Motion and GSAP to the same element.
- NEVER import `gsap/all`; import only needed plugins.
- NEVER skip `gsap.registerPlugin()`.
- NEVER use a global motion-kill reset; use targeted reduced-motion fallbacks.
- ALWAYS use `AnimatePresence` for Motion exit animations.
- ALWAYS prefer CSS for non-state-driven decorative animation.
- ALWAYS verify `[UNVERIFIED]` token values before quoting exact numbers.

## Related Skills

- `react`, `vue`, `nextjs`, `nuxt`, `astro` — host runtimes (SSR caveats for AutoAnimate/ScrollTrigger/View Transitions)
- `css-architecture-2026` — OKLCH, layers, container queries, View Transitions overlap
- `tailwind`, `shadcn` — styling layer often paired with Motion
- `ui-craft` — verification/QA of the resulting motion
- `skill-evaluation` — authoring SKILL.md
