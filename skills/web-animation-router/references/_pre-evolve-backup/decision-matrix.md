# Decision Matrix — Task to Animation Library

**Purpose:** Route a specific animation task to the correct library.

All three libraries in scope: Motion, GSAP, AutoAnimate.
For full library details see sibling reference files.

| Task | Pick | Rationale |
|---|---|---|
| Hover micro-interaction (button scale, glow) | CSS / Motion | CSS handles hover free; Motion if state-driven |
| Modal open/close with backdrop fade | Motion | AnimatePresence manages exit animations on unmount |
| List item add/remove, no custom timing | AutoAnimate | Zero-config, small bundle, automatic DOM-mutation watch |
| List reorder by drag-and-drop | Motion Reorder or GSAP Flip | Motion if React-native; GSAP Flip for framework-agnostic |
| Drawer / sidebar slide-in | Motion | Declarative state-driven, integrates with React lifecycle |
| Page route transition | Motion | View Transitions API + Motion fallback covers most cases |
| Scroll-pinned narrative section | GSAP ScrollTrigger | Motion cannot pin; ScrollTrigger purpose-built |
| Scroll-fade-in on viewport enter | Motion useScroll | Simpler than ScrollTrigger for single-trigger fade |
| SVG icon path morph (hamburger to close) | GSAP MorphSVGPlugin | Only tool that morphs SVG d attribute paths |
| SVG logo stroke draw-on-mount | GSAP DrawSVGPlugin | Only tool for SVG stroke draw animation |
| Element follows curved SVG path | GSAP MotionPathPlugin | Only tool for path-following motion |
| Stagger reveal of cards on load | Motion variants | staggerChildren on variant cleaner than GSAP for React |
| Number counter tick-up | Motion useMotionValue / GSAP | Either; Motion preferred inside React components |
| Complex hero sequence with timed reveals | GSAP timeline | Precise label-based sequencing with seek/pause |
| Drag card with throw and inertia | GSAP Draggable + InertiaPlugin | InertiaPlugin physics are unique in this trio |
| Loading skeleton shimmer | CSS @keyframes | Pure CSS animation; no JS library needed |
| Accordion expand/collapse | AutoAnimate or Motion layout | AutoAnimate simplest; Motion if custom timing needed |
| Toast notification slide and fade | Motion AnimatePresence | List entry + coordinated exit in one primitive |
| Particle or canvas effects | Neither — pixi.js or hand-roll | Out of scope for all three libraries |
| Text scramble / cypher reveal | GSAP ScrambleText | No equivalent in Motion or AutoAnimate |
