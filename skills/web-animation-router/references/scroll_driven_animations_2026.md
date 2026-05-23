# Scroll-Driven Animation Systems: CSS Native vs. GSAP + Lenis (May 2026)

## 1. Technical Support & Engine Capabilities (May 2026 Status)

| Feature | CSS Scroll-Driven Animations | GSAP ScrollTrigger (v3.15.0) + Lenis (v1.3.23) |
| :--- | :--- | :--- |
| **Browser Support** | Chrome/Edge 115+ (July 2023 `[stale]`), Safari 18+ (Sept 2024 `[stale]`). Firefox requires manual flag activation (`layout.css.scroll-driven-animations.enabled`). | Universal fallback (IE11+ for GSAP core, modern ES6+ for Lenis). |
| **Execution Thread** | **Compositor Thread** (Compositor-only animations e.g., `transform`, `opacity`). Zero main-thread blocking. | **Main Thread** (Runs inside requestAnimationFrame / JS execution loop). |
| **Smooth Scrolling** | Relies on OS/Browser native scrolling kinetics. | Virtualized smooth scrolling (physics-based momentum simulation). |
| **Layout Interaction** | No direct layout calculation; cannot query DOM dimensions at runtime for mid-scroll updates. | High-fidelity JS control. Real-time updates for pinning, snapping, and media queries via `gsap.matchMedia()`. |
| **Snapping / Anchoring**| Limited to CSS Scroll Snapping spec (`scroll-snap-type`). | Programmatic snapping using custom easing curves and velocity mapping. |
| **Polyfill Availability**| `flackr/scroll-timeline` (https://github.com/flackr/scroll-timeline). Runtime JS wrapper; negates compositor advantages. | Native JS implementation, no polyfill needed. |

---

## 2. Decision Matrix & Architectural Trade-offs

### The Compositor Advantage (CSS Native)
CSS scroll-driven animations execute on the compositor thread (*потоковая обработка на уровне композитора*). When the main thread is blocked (e.g., during JS bundle hydration, Webpack chunk execution, or heavy React rendering), compositor-driven transitions (`opacity`, `transform`, `clip-path`) maintain a fluid **120 FPS / 90 FPS** refresh rate without dropping frames.

### The Physics and Layout Mastery (GSAP + Lenis)
GSAP ScrollTrigger binds to the virtualized scroll axis managed by Lenis. While main-thread execution introduces risks of layout thrashing (*вынужденный синхронный макет*), it is the only system capable of:
1. **Dynamic Pinning**: Locking an element in the viewport while animating its children over a defined scroll distance.
2. **Velocity-Based Easing**: Adjusting animation intensity dynamically based on scroll speed.
3. **Complex SVG / WebGL Sync**: Linking scroll state to SVG morphing (`MorphSVGPlugin`) or Three.js/WebGL fragment shaders.

---

## 3. Production-Ready Implementations

### Recipe A: CSS Native Scroll-Indicator & View-Driven Transition
No external scripts required. Fully compositor-optimized.

```html
<!-- index.html -->
<div class="scroll-progress-bar"></div>

<main class="content-container">
  <section class="hero">
    <h1>Scroll Down</h1>
  </section>
  <section class="reveal-section">
    <div class="reveal-card">
      <h2>Compositor-Driven Reveal</h2>
      <p>This card scales and fades using CSS view-timeline.</p>
    </div>
  </section>
</main>
```

```css
/* index.css */
@supports (animation-timeline: scroll()) {
  /* 1. Global Scroll Progress Indicator */
  .scroll-progress-bar {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 4px;
    background: color-mix(in oklch, var(--brand-primary, #4f46e5) 80%, white);
    transform-origin: 0 50%;
    z-index: 100;
    
    /* Connect to root vertical scroll */
    animation: grow-progress linear auto both;
    animation-timeline: scroll(root block);
  }

  @keyframes grow-progress {
    from { transform: scaleX(0); }
    to { transform: scaleX(1); }
  }

  /* 2. Scroll-Linked Card Reveal */
  .reveal-card {
    will-change: transform, opacity;
    
    /* Connect to local element visibility */
    animation: fade-and-scale linear auto both;
    animation-timeline: view(block);
    
    /* Start animating when element is 10% visible, complete at 40% height */
    animation-range: entry 10% cover 40%;
  }

  @keyframes fade-and-scale {
    from {
      opacity: 0;
      transform: scale(0.85) translateY(40px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
}

/* Fallback for Firefox and older browsers */
@supports not (animation-timeline: scroll()) {
  .scroll-progress-bar {
    display: none;
  }
  .reveal-card {
    opacity: 1;
    transform: none;
  }
}
```

---

### Recipe B: GSAP (v3.15.0) + Lenis (v1.3.23) Synchronization
For sophisticated interactive applications. Synchronizes Lenis smooth-scroll physics with the GSAP ticker to eliminate visual offset delays (*рассинхронизация*).

#### Installation
```bash
npm install gsap@3.15.0 lenis@1.3.23
```

#### Sync Script
```javascript
// scroll-engine.js
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

// Register plugin once
gsap.registerPlugin(ScrollTrigger);

export function initScrollSystem(scrollContainer = document.documentElement) {
  // 1. Initialize Lenis with production physics config
  const lenis = new Lenis({
    wrapper: window,
    content: scrollContainer,
    duration: 1.2,          // Inertial decay duration in seconds
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // Custom exponential ease-out
    orientation: 'vertical',
    gestureOrientation: 'vertical',
    smoothWheel: true,
    wheelMultiplier: 1.0,   // Standard wheel acceleration factor
    autoRaf: false          // Critical: Prevents internal frame double-rendering
  });

  // 2. Map Lenis updates to ScrollTrigger
  lenis.on('scroll', ScrollTrigger.update);

  // 3. Connect GSAP Ticker to Lenis animation loop
  const tickerUpdate = (time) => {
    // GSAP ticker provides time in seconds, Lenis requires milliseconds
    lenis.raf(time * 1000);
  };
  
  gsap.ticker.add(tickerUpdate);
  
  // Disable lag smoothing to prevent time skipping during dropped frames
  gsap.ticker.lagSmoothing(0);

  // 4. Implement dynamic scrub animation with velocity tracking
  const targetElement = document.querySelector('.velocity-card');
  const textElement = document.querySelector('.velocity-text');

  let scrollTween = null;
  
  if (targetElement && textElement) {
    scrollTween = gsap.fromTo(targetElement, 
      { scale: 0.9, rotateY: -15 },
      {
        scale: 1,
        rotateY: 15,
        scrollTrigger: {
          trigger: targetElement,
          start: 'top bottom-=10%',
          end: 'bottom top+=10%',
          scrub: 1.5, // Smooth scrubbing delay in seconds
          onUpdate: (self) => {
            // Apply velocity-linked transform adjustments
            const velocity = Math.abs(self.getVelocity());
            const dynamicSkew = Math.min(velocity / 150, 10); // Cap skew at 10deg
            gsap.to(textElement, {
              skewX: self.direction === 1 ? dynamicSkew : -dynamicSkew,
              duration: 0.2,
              overwrite: 'auto'
            });
          }
        }
      }
    );
  }

  // Cleanup handler (Mandatory for SPA context to prevent memory leaks)
  return () => {
    gsap.ticker.remove(tickerUpdate);
    if (scrollTween) scrollTween.kill();
    ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    lenis.destroy();
  };
}
```

---

## 4. Antipatterns & Legacy Pitfalls (2026 Warning Flags)

### ❌ `window.addEventListener('scroll')` Style Mutations
Bypassing compositor orchestration to write style properties directly during scroll events triggers layout-thrashing (*вынужденный синхронный макет*).
*   **Why it's obsolete**: It breaks the browser's render pipeline, forcing layout recalculations before paint.
*   **Correction**: Migrate indicators to native CSS scroll timelines, or let GSAP write to CSS variables that are animated off-thread.

### ❌ Deprecated Package Names (`@studio-freight/lenis`)
*   **Why it's obsolete**: Studio Freight rebranded; all packages under `@studio-freight/lenis` are deprecated since mid-2025.
*   **Correction**: Always install `lenis` and import directly from `'lenis'`.

### ❌ Concurrently Activating `scroll-behavior: smooth`
Enabling native CSS smooth scrolling while running Lenis creates physical feedback loops.
*   **Why it's obsolete**: The browser and the virtualization script compete to calculate target positions, causing erratic micro-jitter (*микроджиттер*).
*   **Correction**: Strip `scroll-behavior: smooth` from CSS stylesheets when Lenis is active.

### ❌ Obsolete `yoyoEase` properties in GSAP 3.15+
*   **Why it's obsolete**: Deprecated in favor of the unified adaptive directional easing system (`easeReverse`) introduced in GSAP 3.15.0 (April 2026).
*   **Correction**: Utilize `easeReverse` for reversing playhead modifications.

---

## 5. Deterministic Verification & Validation

To ensure animations meet 2026 performance and accessibility standards, run the following validation scripts and checks.

### A. Performance Budget Thresholds
Validate metrics using Chrome DevTools Lighthouse or Web Vitals integration:
*   **Interaction to Next Paint (INP)**: `≤ 200ms` (Target `≤ 75ms` for fluid animation response).
*   **Cumulative Layout Shift (CLS)**: `< 0.1` (Animations must not trigger layout changes that shift static elements).
*   **Frames Per Second (FPS)**: Constant `≥ 90FPS` on high-refresh displays.

### B. Automated Testing and CI Checks

Use the following Playwright script to verify that your DOM utilizes CSS animations on the compositor thread and detects potential issues:

```javascript
// test/animations.spec.js
import { test, expect } from '@playwright/test';

test.describe('Scroll Animation Validation', () => {
  test('should use compositor-only properties and feature detection', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // 1. Assert CSS feature queries exist in styling sheets
    const styles = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      return sheets.map(s => {
        try {
          return Array.from(s.cssRules).map(r => r.cssText).join('\n');
        } catch {
          return ''; // Skip cross-origin sheets
        }
      }).join('\n');
    });
    
    expect(styles).toContain('@supports (animation-timeline: scroll())');

    // 2. Ensure animated elements declare will-change
    const willChange = await page.$eval('.reveal-card', el => 
      window.getComputedStyle(el).getPropertyValue('will-change')
    );
    expect(willChange).toMatch(/transform|opacity/);
  });
});
```

### C. Contrast and Motion Accessibility (WCAG 2.2 / APCA)
Ensure that you respect user preferences for reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  /* Disable CSS Native timelines */
  .reveal-card,
  .scroll-progress-bar {
    animation: none !important;
    transition: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
}
```

In JS, handle reduction checks explicitly prior to initialization:
```javascript
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
if (!motionQuery.matches) {
  initScrollSystem();
}
```
