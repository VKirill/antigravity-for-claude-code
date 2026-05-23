# Responsive & Mobile Craft for Motion and WebGL Sites
*Authoritative Reference for Autonomous Design Orchestrators — May 2026*

This reference document establishes mobile-first engineering, viewport height management, touch target optimization, adaptive WebGL scaling, fluid typography, and performance rules for low-power mobile devices. For layouts, sitemaps, conversion design, accessibility standards, and copywriting guidelines, cross-reference [ia_page_blueprint_kb.md](ia_page_blueprint_kb.md), [ux-conversion-patterns.md](ux-conversion-patterns.md), [accessibility-wcag22.md](accessibility-wcag22.md), and [copywriting-microcopy.md](copywriting-microcopy.md).

---

## 1. Viewport Units & The Mobile Address-Bar Problem (Высота вьюпорта на мобильных)
The traditional `100vh` unit fails on mobile browsers (iOS Safari, Android Chrome) because it measures the viewport height with the address bar retracted. When the address bar is visible, full-screen layouts overflow, cutting off bottom CTAs.

### The Viewport Standard
In May 2026, dynamic viewport units are baseline across all browsers. The orchestrator must implement these specific selectors:
*   **`svh` (Small Viewport Height)**: Layout height when the browser address bar is expanded. Ideal for static hero cards that must not overflow.
*   **`lvh` (Large Viewport Height)**: Layout height when the address bar is hidden.
*   **`dvh` (Dynamic Viewport Height)**: Adjusts dynamically as the address bar expands/contracts on scroll. 

> [!WARNING]
> Do not use `dvh` on major background layouts or images. Because the address bar scales dynamically as the user scrolls, `dvh` will trigger expensive layout paint recalculations, causing visible stutter (jitter). Use `svh` for stable full-screen layouts.

### CSS Fallback Pattern
```css
.hero-container {
  height: 100vh; /* Fallback for legacy browsers */
  height: 100svh; /* Enforces clean height matching active viewport */
}
```

---

## 2. Touch Interactions & Tap Target Standards (Интерактивные элементы на тачскринах)
Mobile touch interaction operates differently than mouse pointers. There is no active hover state on touchscreens.

*   **Interactive Target Sizing**: Meet WCAG 2.2 Success Criterion 2.5.8 (Target Size - Minimum) requiring a minimum size of **24x24 CSS pixels** or sufficient spacing from adjacent targets. However, follow mobile platform guidelines for high-priority elements:
    - **Minimum height/width**: **48px** (conforms to Android Material Design) or **44px** (Apple HIG).
*   **Zero Hover Dependencies**: Ensure no critical information is hidden behind mouse hover transitions. If hover effects exist (e.g., feature cards showing detailed copy), convert these to tap actions on mobile via viewport detection or CSS `@media (hover: hover)` media queries:
    ```css
    /* Only apply hover effects on pointing devices that support hover */
    @media (hover: hover) {
      .feature-card:hover {
        transform: translateY(-8px);
      }
    }
    ```
*   **Preventing Canvas Scrolling issues**: When integrating interactive 3D WebGL canvases, prevent touch drags from blocking page scroll. Configure standard Touch Action styles:
    ```css
    canvas.interactive-3d {
      touch-action: pan-y; /* Allows user to scroll the page vertically when dragging over the canvas */
    }
    ```

---

## 3. Hardware Optimization & Power Saving (Оптимизация производительности)
To prevent mobile battery drain and thermal throttling, adapt layouts to low-power and data-saving states.

### Battery & Connectivity Inspection Snippet
Inject this configuration script before initializing heavy motion systems, GSAP timelines, or WebGL frames:
```javascript
class DeviceOptimizationManager {
  static async checkPerformanceConstraints() {
    const constraints = {
      reduceMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      saveData: false,
      lowPowerMode: false
    };

    // 1. Data Saving Check (Connection Saver API)
    if (navigator.connection) {
      constraints.saveData = navigator.connection.saveData === true || 
                             ['cellular', '2g', '3g'].includes(navigator.connection.effectiveType);
    }

    // 2. Battery / Low Power Check (Battery Status API)
    if (typeof navigator.getBattery === 'function') {
      try {
        const battery = await navigator.getBattery();
        // Assume low power mode if battery is below 20% and not currently charging
        constraints.lowPowerMode = battery.level < 0.20 && !battery.charging;
      } catch (e) {
        console.warn('Battery API check blocked/failed', e);
      }
    }

    return constraints;
  }
}
```

---

## 4. Adaptive WebGL Quality Clamping (Адаптивное качество WebGL)
High Device Pixel Ratio (DPR) screens (such as Retina displays with DPR 3 or 4) degrade mobile WebGL rendering. Clamping DPR reduces pixel rendering pipelines by over **50%**.

*   **DPR Clamping Rule**: Clamp renderer DPR to a maximum of **2.0** on mobile devices.
*   **Particle Count Scaling**: Scale physics allocations based on mobile detection.
*   **Shader Degradation**: Turn off post-processing layers (such as bloom, SSAO, and depth of field) on mobile or low-power profiles.

### Adaptive WebGL Initializer Code
```javascript
import * as THREE from 'three'; // v0.170.0 [UNVERIFIED] / late 2025/2026 standard

async function initWebGLScene(canvasElement) {
  const constraints = await DeviceOptimizationManager.checkPerformanceConstraints();
  
  // Set quality profile based on device state
  const isLowSpec = constraints.reduceMotion || constraints.saveData || constraints.lowPowerMode;
  
  const renderer = new THREE.WebGLRenderer({
    canvas: canvasElement,
    powerPreference: isLowSpec ? 'low-power' : 'high-performance',
    antialias: !isLowSpec
  });

  // Clamp DPR to prevent rendering at DPR 3+ which causes mobile overheating
  const maxDPR = isLowSpec ? 1.0 : 2.0;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxDPR));

  // Example: Particle allocation based on specs
  const particleCount = isLowSpec ? 500 : 5000;
  const geometry = new THREE.BufferGeometry();
  // Initialize geometry with particleCount ...

  return { renderer, isLowSpec };
}
```

---

## 5. Responsive Type & Spacing Using CSS `clamp()` (Адаптивный размер шрифта)
Avoid writing complex breakpoint media queries for text sizing. Enforce fluid typography calculations:

### Typography Fluid Formula
```css
font-size: clamp([MinSize]rem, [Slope]vw + [BaseSize]rem, [MaxSize]rem);
```
To scale a header font size fluidly from **32px (2rem)** at a viewport width of **320px** up to **64px (4rem)** at **1200px** viewport width:
*   Slope = `(64 - 32) / (1200 - 320) = 32 / 880 = 0.03636` -> `3.64vw`
*   Base = `32px - (0.03636 * 320px) = 32px - 11.63px = 20.37px` -> `1.27rem`
*   **Resulting CSS**:
    ```css
    h1 {
      font-size: clamp(2rem, 3.64vw + 1.27rem, 4rem);
    }
    ```

### Spacing Fluid Formula
Scale vertical section margins fluidly to keep layouts consistent across mobile and desktop sizes:
```css
section {
  padding-block: clamp(3rem, 5vw + 1rem, 8rem);
}
```

---

## 6. Container Queries (Контейнерные запросы)
To construct reusable, layout-agnostic components, define styling relative to parent element widths rather than viewport widths.
```css
/* 1. Define container element context */
.card-wrapper {
  container-type: inline-size;
  container-name: card-container;
}

/* 2. Apply styling relative to container dimensions */
@container card-container (min-width: 400px) {
  .product-card {
    display: flex;
    flex-direction: row;
    gap: 2rem;
  }
  .product-image {
    width: 150px;
    height: 150px;
  }
}
```

---

## 7. Device Safe Areas (Notch Handling) (Безопасная зона экрана)
Modern smartphone screens feature camera notches or software navigation indicators that block layouts. Add safe-area padding:
```css
header {
  /* Adds top padding matching safe areas, fallback to 1rem */
  padding-top: calc(env(safe-area-inset-top, 0px) + 1rem);
}

footer {
  /* Protects bottom action buttons from being blocked by home bar indicator */
  padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 1rem);
}
```

---

## 8. Prevent Mobile Input Auto-Zoom (Предотвращение автоматического масштабирования)
On iOS Safari, focusing an input element with a font-size below **16px** triggers an automatic page zoom. This breaks mobile alignment.
*   **Enforcement Rule**: All inputs, textareas, and select dropdowns must have a minimum font-size of **16px (1rem)** on viewport widths below 768px.
    ```css
    input, textarea, select {
      font-size: 16px; /* Prevents auto-zoom behavior on mobile focus */
    }
    ```

---

## 9. Mid-Tier Android Performance Guidelines (Производительность на Android)
Low-cost and mid-tier Android devices represent the largest global target audience.
*   **Avoid Garbage Collection (GC) Loops**: Do not instantiate variables or arrays inside requestAnimationFrame render loops:
    - *Poor*: `renderer.onBeforeRender(() => { const vec = new THREE.Vector3(); ... })`
    - *Premium (Re-use references)*: `const vec = new THREE.Vector3(); renderer.onBeforeRender(() => { vec.set(...); ... })`
*   **Limit CSS Transitions**: Avoid CSS animations on non-composited properties (e.g. `width`, `height`, `top`, `left`). Only animate `transform` and `opacity` properties which are processed directly by the GPU.

---

## 10. Deterministic Mobile QA Checklist (Чек-лист контроля мобильной версии)
Run these automated and throttled tests on mobile builds:

*   [ ] **CPU Throttling Performance**:
    - Open Chrome DevTools, set CPU to **4x slowdown** and Network to **Fast 3G**.
    - Verify that interaction performance maintains a stable framerate (target: **30 - 60 FPS**, INP ≤ 150ms).
*   [ ] **Touch Targets Audit**:
    - Check all interactive buttons. Verify that target dimensions are at least **24x24px** under WCAG 2.2 AA (or **44px/48px** for primary CTA elements).
*   [ ] **Safe Area Boundaries**:
    - Simulate mobile notch overlays (e.g., iPhone viewport emulation in browser). Verify that headers and sticky footer menus are not cut off.
*   [ ] **Auto-Zoom Check**:
    - Focus text inputs on an emulated iOS device. Confirm that the viewport does not zoom or pan.
*   [ ] **Lighthouse Mobile Score**:
    - Run Lighthouse audits using the Mobile profile. Enforce minimum score boundaries:
      - Performance: ≥ 90
      - Accessibility: 100
      - Best Practices: ≥ 95
      - SEO: 100

---

## 11. Responsive Mobile Antipatterns (Антипаттерны адаптивной верстки)
*Avoid these development mistakes on mobile configurations:*

*   **Antipattern 1: 100vh Layouts** — Creating full-screen headers or cards with `height: 100vh` instead of `100svh`, which cuts off actions.
*   **Antipattern 2: Mouse Hover Dependences** — Hiding details or actions inside hover states, rendering them inaccessible to touchscreen visitors.
*   **Antipattern 3: Unclamped DPR WebGL** — Initializing rendering canvases without clamping the Device Pixel Ratio, leading to performance drops and mobile overheating.
*   **Antipattern 4: Scale/Width Animation** — Animating container sizing during scroll operations, which forces the browser to recalculate layouts on every frame.
*   **Antipattern 5: Small input font-sizing** — Setting input sizes below 16px, causing page zooming on mobile inputs.
