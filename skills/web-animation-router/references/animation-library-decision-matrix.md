# Animation Library Decision Matrix (2026 Spec)

This document serves as the definitive routing logic for selecting web animation tools in the `web-animation-router` engine. It evaluates tool choices based on performance impact, framework integration, capability, and accessibility requirements.

Cross-reference previous implementation modules for specific tool integrations:
*   [motion-tokens-and-springs.md](motion-tokens-and-springs.md) (Standard easing/spring equations)
*   [scroll_driven_animations_2026.md](scroll_driven_animations_2026.md) (CSS ScrollTimeline and GSAP Sync)
*   [gsap-315-plugin-recipes.md](gsap-315-plugin-recipes.md) (Flip, ScrollTrigger, and observer structures)
*   [motiondev-v12-react.md](motiondev-v12-react.md) (React declarative bindings)

---

## 1. Animation Library Comparison Matrix

| Evaluation Criteria | CSS-Only (Native / SDA) | Motion (`motion/react`) | GSAP (+ Plugins) | AutoAnimate (Formkit) | Rive (Canvas/WASM) | dotLottie-web |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Gzipped Bundle Cost** | **0 KB** | ~4.6 KB (Lazy) to ~34 KB (Full) | ~20 KB (Core) to ~30 KB (Plugins) | **~2.3 KB** | ~40 KB - 50 KB (WASM Runtime) | ~20 KB - 25 KB |
| **React Friendliness** | Neutral (Requires manually sync’d refs) | **Excellent** (Native hooks, layoutId) | Moderate (Requires context cleanups) | Excellent (Zero-config React hook) | Moderate (Requires canvas ref setup) | Moderate (Requires player component) |
| **Scroll Power** | Excellent (Native CSS ScrollTimeline) | Moderate (JS-driven scroll hooks) | **Outstanding** (ScrollTrigger, pinning) | None | Low (Bind progress to scroll) | Low (Bind progress to scroll) |
| **SVG / Morphing** | Low (Limits paths to same point count) | Moderate (SVG path morphing) | **Outstanding** (MorphSVG / DrawSVG) | None | High (WASM-rendered vector shapes) | High (Vector assets compilation) |
| **Timeline Orchestration** | Low (Requires complex delay sequencing) | Moderate (Variants stagger orchestration) | **Outstanding** (Nested GSAP Timelines) | None | Outstanding (State Machine Editor) | Moderate (Frame progress binding) |
| **Runtime Interactivity** | Low (State queries via hover/active) | High (Drag, hover, tap gestures) | High (Observer input triggers) | None | **Outstanding** (Dynamic state engines) | Low (Pause / play toggles) |
| **Accessibility (a11y)** | **Excellent** (Native queries, semantic) | Excellent (Supports reduced motion configs) | Moderate (Must manually override values) | Excellent (Strictly morphs real DOM) | Poor (Renders inside WebGL/Canvas) | Poor (Renders inside SVG/Canvas) |

---

## 2. Agent Decision Tree (If/Then Routing Logic)

```text
START: Analyze Animation Requirement
 │
 ├──► [Is it a basic layout microinteraction (hover, focus, toggling)?]
 │     └─► USE: CSS-Only (transitions / @property registers)
 │         └─► Reason: Zero JS overhead, GPU accelerated, 100% accessible.
 │
 ├──► [Is it animating height: 0 to height: auto (accordions)?]
 │     └─► USE: CSS-Only (with 'interpolate-size: allow-keywords')
 │         └─► Reason: Modern 2026 browser standard natively maps intrinsic sizes.
 │
 ├──► [Is it a list re-order / addition layout morph (e.g. lists, grids)?]
 │     ├─► React project:
 │     │     └─► USE: Motion ('layoutId' or layout properties)
 │     │         └─► Reason: Handles complex DOM layout morphs out-of-the-box.
 │     └─► Non-React / Lightweight project:
 │           └─► USE: AutoAnimate (Formkit)
 │               └─► Reason: Instant zero-config transition with ~2.3KB bundle cost.
 │
 ├──► [Is it a scroll-synced page element scroll sequence?]
 │     ├─► Simple scroll-driven reveals (no layout pinning):
 │     │     └─► USE: CSS-Only (ScrollTimeline / ViewTimeline)
 │     │         └─► Reason: Native GPU thread execution, bypasses scroll latency.
 │     └─► Complex scroll choreography (pinning, viewport tracking, snap points):
 │           └─► USE: GSAP + ScrollTrigger
 │               └─► Reason: ScrollTrigger provides reliable cross-browser layout syncing.
 │
 ├──► [Is it a highly customized vector shape morph (SVG path distorting)?]
 │     └─► USE: GSAP + MorphSVG
 │         └─► Reason: Handles morphs between SVG paths with mismatched node counts.
 │
 ├──► [Is it a complex multi-stage landing page sequence (timelines)?]
 │     └─► USE: GSAP Timelines
 │         └─► Reason: Master-and-nested timeline models allow modular orchestration.
 │
 ├──► [Is it an After Effects vector illustration handoff?]
 │     └─► USE: dotLottie-web
 │         └─► Reason: Standard AE JSON assets rendered efficiently at ~20KB.
 │
 └──► [Is it a highly interactive vector component with state logic (e.g. game-like vectors)?]
       └─► USE: Rive
           └─► Reason: Rive's State Machine runs vector morphs inside a Canvas at 60fps.
```

---

## 3. High-Performance Tool Combinations

### Recipe 1: CSS-First UI + GSAP Timeline Coordination
Use CSS transitions for all standard button hovers, toggles, and form focus states. Initialize GSAP strictly to animate custom CSS variables for complex timelines.

```css
/* Custom variable registered for GSAP access */
@property --timeline-progress {
  syntax: '<number>';
  inherits: true;
  initial-value: 0;
}

.intro-panel {
  opacity: var(--timeline-progress);
  transform: translateY(calc((1 - var(--timeline-progress)) * 40px));
}
```

```javascript
import gsap from 'gsap';

// GSAP updates the CSS custom variable, leaving translation mechanics to the GPU
gsap.to('.intro-panel', {
  '--timeline-progress': 1.0,
  duration: 0.6,
  ease: 'power3.out'
});
```

---

### Recipe 2: Rive for Interactive Vectors + Semantic DOM Overlay
Rive renders vector shapes inside canvas elements, making the text contents invisible to search engines and screen readers. Always overlay a semantic DOM block on top of Rive canvases.

```html
<div class="interactive-vector-container" style="position: relative;">
  <!-- Canvas holds the visual vector animation -->
  <canvas id="rive-canvas" width="400" height="400"></canvas>
  
  <!-- Overlay keeps title and description visible to screen readers -->
  <div class="sr-only">
    <h2>Interactive Character Avatar</h2>
    <p>Displays emotional updates based on user field inputs.</p>
  </div>
</div>
```

---

### Recipe 3: Lottie / dotLottie Animation Handoff
Use `dotlottie-web` runtime instead of `lottie-web` to load compressed `.lottie` packages.

```tsx
'use client';

import React, { useEffect, useRef } from 'react';
import { DotLottie } from '@lottiefiles/dotlottie-web';

export function LottiePlayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Load optimized .lottie file
    const player = new DotLottie({
      autoplay: true,
      loop: true,
      canvas: canvasRef.current,
      src: '/animations/hero-illustration.lottie',
    });

    return () => {
      player.destroy();
    };
  }, []);

  return (
    <div className="relative w-full max-w-sm">
      <canvas ref={canvasRef} className="w-full h-auto" />
      {/* Screen reader visibility fallback */}
      <div className="sr-only">
        <p>Decorative technical schematic rendering dynamically.</p>
      </div>
    </div>
  );
}
```

---

## 4. Anti-Corruption Guidelines (Never Use Libraries When CSS Suffices)

1.  **Stop Animating Colors with JS**: Using GSAP or Framer Motion to animate background-color or border-color shifts on hover adds JS thread overhead. Use standard CSS: `transition: background-color 150ms ease;`.
2.  **Bypass JS Scroll Listeners for Offsets**: Avoid using JS `window.addEventListener('scroll')` to fade in headers. Use CSS scroll/view timelines.
3.  **Halt Dialog Open Transitions in JS**: Do not use React hooks to slide modals open. Use native HTML `<dialog>` elements combined with `@starting-style` transitions in CSS. This retains accessibility, escape-key behaviors, and focus-locking natively.
