# Motion Accessibility & Safety (2026 Spec)

This guide establishes the production standards for accessible and safe motion design on the web in 2026. It covers techniques for respecting user motion preferences, managing vestibular safety thresholds, managing focus during route animations, and validating animations against WCAG 2.2 guidelines.

Cross-reference related implementation setups via:
*   [motion-tokens-and-springs.md](motion-tokens-and-springs.md) (Dampening ease tokens & spring curves)
*   [motiondev-v12-react.md](motiondev-v12-react.md) (declarative hooks and layout animations)
*   [microinteractions-catalog.md](microinteractions-catalog.md) (Standard control specs and fallback modes)

---

## 1. Respecting Motion Preferences: The Right Way

Designing for reduced motion does not mean disabling all transitions globally. Modifying styles without consideration breaks elements that depend on transitions (like dialog reveals or accordion state changes) and causes JS scripts listening for `transitionend` or `animationend` events to hang indefinitely.

### Safe Reduced-Motion Stylesheet (CSS-only)
Target spatial shifts, high-frequency rotations, and zoom factors directly, but preserve soft opacity transitions.

```css
/* accessibility-safe-defaults.css */

@media (prefers-reduced-motion: reduce) {
  /* 
    1. Target spatial translation, zoom, and parallax effects, 
       replacing them with soft opacity fades.
  */
  .parallax-section,
  .slide-in-card,
  .hero-zoom-item {
    transform: none !important;
    animation-name: simple-fade-in !important;
    animation-duration: 200ms !important;
  }

  /* 
    2. Reduce high-frequency oscillations (springs) to rapid eases.
       Avoid removing the transition entirely so 'transitionend' events still fire.
  */
  .spring-button,
  .elastic-like-icon {
    transition-duration: 100ms !important;
    transition-timing-function: ease-out !important;
    transform: none !important;
  }

  /* 
    3. Soften infinite loading spinners or scrolling marquees
       instead of halting them abruptly.
  */
  .spinning-loader {
    animation-duration: 4s !important; /* Lowers flicker frequency */
  }
}

@keyframes simple-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

---

### React Reactivity: Reusable `useReducedMotion` Hook
A declarative React hook that enables components to swap rendering layouts when reduced motion is preferred.

```typescript
'use client';

import { useEffect, useState } from 'react';

export function useReducedMotion(): boolean {
  const [shouldReduce, setShouldReduce] = useState<boolean>(false);

  useEffect(() => {
    // 1. Check if matchMedia exists (SSR fallback)
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    // Set initial value
    setShouldReduce(mediaQuery.matches);

    // 2. Register listener for changes
    const listener = (event: MediaQueryListEvent) => {
      setShouldReduce(event.matches);
    };

    mediaQuery.addEventListener('change', listener);
    
    return () => {
      mediaQuery.removeEventListener('change', listener);
    };
  }, []);

  return shouldReduce;
}
```

---

## 2. Vestibular Safety Thresholds (2026 Guidelines)

To prevent triggering motion sickness, nausea, or vertigo in users with vestibular system disorders, design workflows must adhere to these mathematical thresholds:

### Translation / Parallax Distance
*   **Threshold**: Maximum offset must not exceed **10% of the viewport dimension** (width or height).
*   **Reasoning**: Displacing elements across larger distances forces the human eye to track movements over a wide angle, triggering motion sickness.

### Rotation Speeds & Angles
*   **Threshold**: Limit rotation angles to **under 30 degrees**. Maintain rotational speeds below **20 degrees per second**.
*   **Reasoning**: Fast rotational shifts trick the brain into sensing bodily rotation, triggering vertigo.

### Scale / Zoom Factors
*   **Threshold**: Restrict scaling animations to **between 0.9x and 1.15x** of the original size.
*   **Reasoning**: Sudden zooming mimics rapid forward movement, causing disequilibrium.

---

## 3. High-Contrast & Transparency Queries

### Media: `prefers-reduced-transparency`
If a user requests reduced transparency, remove blurred backdrops (`backdrop-filter`) and make backgrounds solid to keep overlay structures readable.

```css
.overlay-panel {
  background-color: rgba(24, 24, 27, 0.7);
  backdrop-filter: blur(12px);
  transition: opacity 200ms ease;
}

@media (prefers-reduced-transparency: reduce) {
  .overlay-panel {
    background-color: rgb(24, 24, 27) !important; /* Force solid */
    backdrop-filter: none !important;
  }
}
```

### Media: `prefers-contrast`
Adjust colors to meet AAA requirements (7:1 ratio) when high contrast is requested.

```css
.badge {
  background-color: #f4f4f5;
  color: #71717a;
}

@media (prefers-contrast: more) {
  .badge {
    background-color: #000000 !important;
    color: #ffffff !important;
    border: 2px solid #ffffff !important; /* Prominent outline */
  }
}
```

---

## 4. Keyboard Focus Management

When transitioning page layouts, elements that previously held keyboard focus are often unmounted, leaving the browser's focus state in a broken state that falls back to the top `<body>` element. This forces keyboard users to navigate through the entire DOM tree again.

### Transition Focus Restorer Script

```javascript
/**
 * Safe navigation transition wrapper that preserves keyboard focus.
 * 
 * @param {HTMLElement} previousFocusElement - Captured node before navigation
 * @param {HTMLElement} newContainer - The newly rendered layout container
 */
export function restoreFocusAfterTransition(previousFocusElement, newContainer) {
  // 1. Capture whether focus was inside a navigation element
  const wasFocused = document.activeElement && document.activeElement !== document.body;

  if (!wasFocused) return;

  // 2. Identify the primary header or focus anchor in the new view
  const focusTarget = newContainer.querySelector('[data-autofocus]') || 
                      newContainer.querySelector('h1') || 
                      newContainer;

  // 3. Ensure target is focusable
  if (!focusTarget.hasAttribute('tabindex')) {
    focusTarget.setAttribute('tabindex', '-1');
  }

  // 4. Focus target post-transition (avoid focus ring on mouse click with :focus-visible)
  focusTarget.focus({ preventScroll: true });
}
```

---

## 5. WCAG 2.2 Success Criteria Compliance

### SC 2.2.2: Pause, Stop, Hide (Level A)
*   **Rule**: Any moving, blinking, or scrolling content that starts automatically and lasts longer than 5 seconds must have a mechanism for the user to pause, stop, or hide it.
*   **Pass Criteria**:
    1.  A prominent, keyboard-accessible "Pause" button exists on all auto-scrolling sliders, carousels, or banners.
    2.  An infinite marquee stops drifting when focused or hovered.
    3.  Loaders that run for more than 5 seconds provide a way to bypass or hide the visual animation.

### SC 2.3.3: Animation from Interactions (Level AAA)
*   **Rule**: Motion animations triggered by user interaction (like parallax scrolling or page transitions) can be disabled, unless the animation is essential to the functionality or information being conveyed.
*   **Pass Criteria**:
    1.  The layout queries `(prefers-reduced-motion: reduce)` and scales back non-essential movement.
    2.  A global dashboard toggle allows users to disable motion animations.

---

## 6. Deterministic Auditing Tools

### Automated CSS Accessibility Audit
Run this stylesheet locally to highlight dangerous, unmapped animation declarations during development.

```css
/* motion-audit.css */

/* 1. Highlight transitions that lack prefers-reduced-motion overrides */
.card-hover-effect:hover {
  transform: translateY(-20px);
  outline: 4px dashed #ff0055; /* Warning outline */
}

/* 2. Flag infinite animations running at high speed */
.fast-loader {
  animation: spin 0.4s infinite linear;
  outline: 4px dashed #eab308; /* Yellow warning: potential seizure trigger */
}
```

### Headless Axe-Core Verification Script
An automation test snippet to check for missing video controls and unmapped animations.

```javascript
import { Autocomplete } from 'axe-core';

// Typical Jest / Playwright test config
test('Validate page transitions meet WCAG 2.2 motion safety', async () => {
  const results = await axe.run({
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aaa']
    },
    rules: {
      'bypass': { enabled: true },
      'scrollable-region-focusable': { enabled: true }
    }
  });

  const motionViolations = results.violations.filter(v => 
    v.id === 'autoplay-video-no-control' || v.id === 'blink'
  );

  expect(motionViolations.length).toBe(0);
});
```
