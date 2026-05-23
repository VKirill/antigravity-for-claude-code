# Page Transition Systems 2026: Production Architecture, View Transitions, and Framework Syncing

This guide establishes the production standards for page transitions in 2026. It covers native same-document (SPA) and cross-document (MPA) View Transitions, framework-level integration wrappers, traditional JS transition routers, and advanced persistent WebGL canvas transitions.

For baseline animation settings, scroll syncing, and easing systems, refer to:
*   [motion-tokens-and-springs.md](motion-tokens-and-springs.md) (Standard durations, beziers, and spring formulas)
*   [scroll_driven_animations_2026.md](scroll_driven_animations_2026.md) (Native CSS and GSAP scroll timelines)
*   [gsap-315-plugin-recipes.md](gsap-315-plugin-recipes.md) (Flip layouts, observer controls, and staggers)
*   [motiondev-v12-react.md](motiondev-v12-react.md) (Framer Motion v12 integration patterns)

---

## 1. Same-Document View Transitions (SPA)

The native View Transitions API allows you to animate DOM state changes in single-page applications without custom layout calculation scripts.

### Browser Support (May 2026)
*   **Chromium (Chrome, Edge, Opera 111+)**: Full support.
*   **Safari (18+)**: Full support.
*   **Firefox (144+)**: Full support (shipped late 2025/early 2026).

### Mechanics of `document.startViewTransition()`
When called, the browser executes the following sequence:
1.  **Old State Capture**: Takes a visual screenshot of the current page (represented by `::view-transition-old(root)`).
2.  **DOM Update Callback**: Executes the async update callback, updating the DOM.
3.  **New State Capture**: Captures a visual screenshot of the updated DOM (`::view-transition-new(root)`).
4.  **Pseudo-element Construction**: Generates a pseudo-element tree overlaying the viewport:
    ```text
    ::view-transition
    └── ::view-transition-group(name)
        └── ::view-transition-image-pair(name)
            ├── ::view-transition-old(name)   (Fades out)
            └── ::view-transition-new(name)   (Fades in)
    ```
5.  **Animation Run**: Executes the cross-fade animation.

### Production Implementation: List Reorder with Dynamic Names
To prevent matching collision issues, apply `view-transition-name` properties dynamically *only* when the state change occurs, then clean them up immediately.

```javascript
/**
 * Executes a state update with dynamic same-document View Transitions.
 * Avoids naming collisions by applying transition names on-the-fly.
 * 
 * @param {HTMLElement[]} elements - Elements to animate
 * @param {Function} domUpdateFn - Async function performing the DOM changes
 */
export async function transitionListReorder(elements, domUpdateFn) {
  if (!document.startViewTransition) {
    await domUpdateFn();
    return;
  }

  // 1. Assign temporary, unique transition names to elements
  elements.forEach((el, index) => {
    el.style.viewTransitionName = `list-item-${index}`;
  });

  // 2. Trigger the transition
  const transition = document.startViewTransition(async () => {
    await domUpdateFn();
  });

  // 3. Clean up transition names once animations complete
  try {
    await transition.finished;
  } finally {
    elements.forEach((el) => {
      el.style.viewTransitionName = '';
    });
  }
}
```

### Customizing the CSS Transition Tree
```css
/* Disable default cross-fade on the root element */
::view-transition-old(root),
::view-transition-new(root) {
  animation: none;
  mix-blend-mode: normal;
}

/* Custom layout slide transition for the page container */
::view-transition-group(page-container) {
  animation-duration: 450ms;
  animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1); /* custom easeOutExpo */
}

/* Target the outgoing screen snapshot */
::view-transition-old(page-container) {
  animation: slide-out 450ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

/* Target the incoming screen snapshot */
::view-transition-new(page-container) {
  animation: slide-in 450ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes slide-out {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(-100px); opacity: 0; }
}

@keyframes slide-in {
  from { transform: translateX(100px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
```

### Antipatterns & Fallbacks
*   **Antipattern: Stale/Static Names**: Hardcoding `view-transition-name` on multiple list items in static CSS. This throws console errors and crashes the transition if multiple elements with the same transition name exist on the page simultaneously.
*   **Antipattern: Heavy DOM Blocking**: Performing network requests inside the `startViewTransition` callback. The browser freezes the screen between step 1 and step 2. Prefetch data before starting the transition.
*   **Fallback**: Always wrap calls in a capability check: `if (!document.startViewTransition) { updateDOM(); return; }`.

---

## 2. Cross-Document View Transitions (MPA)

Cross-document View Transitions allow native multi-page applications (traditional HTML files on the same origin) to transition layout elements smoothly between full document reloads.

### Browser Support (May 2026)
*   **Chromium (Chrome, Edge 126+)**: Full support.
*   **Safari (18.2+)**: Full support.
*   **Firefox**: Behind flags / not supported for production.

### CSS Opt-In
Both the source and destination documents *must* explicitly opt in via CSS:

```css
@view-transition {
  navigation: auto;
}
```

### Per-Element Matching Rules
For the browser to connect elements across page loads, match the `view-transition-name` on both pages:

```css
/* Page A: /articles */
.article-card-image {
  view-transition-name: featured-hero;
}

/* Page B: /articles/hello-world */
.detail-hero-image {
  view-transition-name: featured-hero;
}
```

### Customizing MPA Transitions
You can target the outgoing and incoming documents using transition pseudo-selectors.

```css
/* Custom slide-and-fade for MPA documents */
::view-transition-old(root) {
  animation: 300ms cubic-bezier(0.4, 0, 0.2, 1) both fade-out;
}

::view-transition-new(root) {
  animation: 400ms cubic-bezier(0.4, 0, 0.2, 1) both fade-in;
}

@keyframes fade-out {
  to { opacity: 0; }
}
@keyframes fade-in {
  from { opacity: 0; transform: translateY(10px); }
}
```

### Antipatterns & Fallbacks
*   **Antipattern: Cross-Origin Expectation**: Assuming transitions work across different domains. The browser halts transitions on cross-origin links for security reasons.
*   **Antipattern: Persisting Active JS Media**: Trying to use MPA transitions to keep video playback or WebGL threads continuous. Since the window context is torn down, these media contexts are destroyed. Use SPA routing if JS state must persist.
*   **Fallback**: Check support with CSS `@supports` or let the browser naturally fall back to traditional browser navigation:
    ```css
    @supports (view-transition-name: none) {
      /* Advanced styles here */
    }
    ```

---

## 3. Framework Integrations

Integrating View Transitions into client-side routers requires hooking into route navigation callbacks to sync the DOM update step with the transition callback.

### A. Next.js App Router (React 19)

#### Approach 1: Native Experimental Support
Next.js supports native view transitions using React 19's `<ViewTransition>` API.

Enable the flag in your configuration:
```typescript
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    viewTransition: true,
  },
};

export default nextConfig;
```

#### Approach 2: Custom Route Interceptor Component
For fine-grained control, intercept navigations via a custom component wrapping Next.js routers.

```tsx
// components/ViewTransitionLink.tsx
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Link, { LinkProps } from 'next/link';

interface ViewTransitionLinkProps extends LinkProps {
  children: React.ReactNode;
  className?: string;
}

export function ViewTransitionLink({ href, children, className, ...props }: ViewTransitionLinkProps) {
  const router = useRouter();

  const handleTransitionNavigate = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Intercept standard transitions
    if (!document.startViewTransition) return;

    e.preventDefault();

    document.startViewTransition(() => {
      router.push(href.toString());
    });
  };

  return (
    <Link href={href} onClick={handleTransitionNavigate} className={className} {...props}>
      {children}
    </Link>
  );
}
```

---

### B. Astro

Astro utilizes the `<ClientRouter />` (which replaced `<ViewTransitions />` in Astro 4.x/5.0) to parse document transitions automatically on MPA navigations.

```astro
---
// src/layouts/Layout.astro
import { ClientRouter } from 'astro:transitions';
---
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Astro Production Site</title>
    <!-- Mount the Client Router -->
    <ClientRouter />
  </head>
  <body>
    <header>
      <!-- Persist navbar state across navigation (e.g. active states, players) -->
      <nav transition:persist="main-nav">
        <a href="/">Home</a>
        <a href="/about">About</a>
      </nav>
    </header>
    <main>
      <slot />
    </main>
  </body>
</html>
```

#### Dynamic Morphing Names
```astro
---
// src/components/Card.astro
const { id, title, imgUrl } = Astro.props;
---
<div class="card">
  <!-- Connect elements across routes using unique IDs -->
  <img 
    src={imgUrl} 
    alt={title} 
    transition:name={`hero-image-${id}`} 
  />
  <h2 transition:name={`hero-title-${id}`}>{title}</h2>
</div>
```

---

### C. Nuxt 3 / 4

Nuxt integrates native View Transitions via its experimental engine.

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  experimental: {
    // Respects 'prefers-reduced-motion' settings
    viewTransition: true
  }
});
```

#### Overriding Transitions on Pages
```vue
<!-- pages/static-page.vue -->
<script setup lang="ts">
definePageMeta({
  // Disable native view transition for this route
  viewTransition: false
});
</script>
```

---

### D. SvelteKit

Hook SvelteKit's lifecycle hook `onNavigate` inside the root layout file to wrap DOM switches.

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { onNavigate } from '$app/navigation';

  onNavigate((navigation) => {
    // Fallback if browser lacks support
    if (!document.startViewTransition) return;

    return new Promise<void>((resolve) => {
      document.startViewTransition(async () => {
        resolve(); // Tells SvelteKit to execute the DOM update
        await navigation.complete; // Waits for the new page layout to render
      });
    });
  });
</script>

<slot />
```

---

### Antipatterns & Fallbacks
*   **Antipattern: Client-side Double Transitions**: Mixing native view transitions with framework component transitions (e.g. Vue's `<Transition>` or React's `AnimatePresence`). This creates layout stutter and overlapping DOM items. Disable framework page-transitions globally if using native view transitions.
*   **Antipattern: Fragment Hydration Desync**: Starting a view transition before the JS chunk of the target route has loaded. This causes the UI to render empty frames or layout-shifts. Hook transitions strictly after page bundle resolving has finished.

---

## 4. JS Routing Libraries (Swup, Taxi.js, Barba.js)

Traditional PJAX-based routing engines operate by intercepting link click events, loading the target HTML page in the background via fetch/AJAX, parsing it, replacing the container elements, and pushing the new state to history.

### Comparative Feature Matrix

| Feature | Swup | Barba.js | Taxi.js | Native View Transitions |
| :--- | :--- | :--- | :--- | :--- |
| **Firefox Support** | 100% (Fallback CSS/JS) | 100% (Fallback JS/CSS) | 100% (Fallback JS/CSS) | SPA: Yes (144+), MPA: No (experimental) |
| **Prefetching System** | Built-in (Hover/Viewport) | Built-in (Hover/Viewport) | Built-in (Hover) | None (Requires speculative rules) |
| **Transition Methods** | CSS classes / JS plugins | JS Hooks (GSAP/Web Animations) | JS Hooks (GSAP/Web Animations) | CSS pseudo-elements / Web Animations |
| **WebGL Persistence** | Full (Outer layout mount) | Full (Outer layout mount) | Full (Outer layout mount) | SPA only (MPA kills context) |
| **DOM Sub-swapping** | Multi-container targets | Single container wrapper | Single target container | Full viewport snapshot |

### When to Choose a JS Library Over Native
1.  **True Persistent Layout State in MPA**: Native MPA view transitions reload the document, destroying memory-bound objects like Audio Contexts, Three.js WebGL rendering threads, and active WebSocket connections. Libraries like Barba and Taxi swap containers inline, retaining WebGL state.
2.  **Granular Page Lifecycle Hooks**: You require code execution hooks *before* the outgoing page leaves, *during* request loading, and *after* components hydrate.
3.  **Cross-Browser MPA Transitions**: Native cross-document page transitions are not supported in Firefox for production workloads. If your MPA must animate identically across all browsers, a JS routing engine is required.

### Production Implementation: Taxi.js with GSAP 3.15 Orchestration

Set up the HTML shell structure:
```html
<!-- index.html -->
<nav>
  <a href="/">Home</a>
  <a href="/about.html">About</a>
</nav>

<!-- Container managed by Taxi -->
<main data-taxi>
  <!-- Content updated dynamically -->
  <div data-taxi-view>
    <h1>Home Page</h1>
  </div>
</main>
```

Construct the transition router configuration:
```javascript
// src/router.js
import { Core, Transition } from '@unseenco/taxi';
import gsap from 'gsap';

// Define a transition
class PageFadeTransition extends Transition {
  /**
   * Animation run when leaving the current page
   * @param {Object} props - Transition parameters
   */
  onLeave({ from, trigger, done }) {
    gsap.to(from, {
      opacity: 0,
      y: -30,
      duration: 0.45,
      ease: 'power3.in',
      onComplete: done
    });
  }

  /**
   * Animation run when entering the new page
   * @param {Object} props - Transition parameters
   */
  onEnter({ to, trigger, done }) {
    // Reset initial positioning
    gsap.set(to, { opacity: 0, y: 30 });

    gsap.to(to, {
      opacity: 1,
      y: 0,
      duration: 0.55,
      ease: 'power3.out',
      onComplete: done
    });
  }
}

// Initialize Taxi Core
const taxi = new Core({
  transitions: {
    default: PageFadeTransition
  }
});
```

### Antipatterns & Fallbacks
*   **Antipattern: Head Script Leaks**: PJAX engines only update the main content container. Custom page scripts appended inside the old page body remain active in memory unless manually torn down. Always clean up active listeners, canvas animations, and loops.
*   **Antipattern: Broken Back-Button Scroll**: Swapping pages without resetting scroll position. You must explicitly tell the router to scroll the viewport back to the top or restore the previous scroll position:
    ```javascript
    // Taxi Scroll Restoration hook
    taxi.on('NAVIGATE_IN', () => {
      window.scrollTo(0, 0);
    });
    ```

---

## 5. The Persistent-WebGL-Canvas Transition Pattern

High-end creative agencies utilize a persistent WebGL canvas mounted outside the router viewport to morph, warp, or liquid-displace layouts when navigation events occur.

### System Architecture Diagram
```text
┌──────────────────────────────────────────────────────────┐
│                   PERSISTENT WINDOW                      │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │     WebGL Canvas (fixed, inset 0, pointer-events)  │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │     Client-Side SPA Router / DOM Container         │  │
│  │                                                    │  │
│  │     [Page Contents / DOM Text / Image Assets]      │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Core Implementation: WebGL Router Coordinator

```javascript
// src/webgl/WebGLTransitionController.js
import * as THREE from 'three';
import gsap from 'gsap';

export class WebGLTransitionController {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true });
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    this.initShaderPlane();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  initShaderPlane() {
    this.geometry = new THREE.PlaneGeometry(2, 2);
    
    // Custom displacement shader
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        uProgress: { value: 0.0 },
        uTextureFrom: { value: null },
        uTextureTo: { value: null },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uProgress;
        uniform sampler2D uTextureFrom;
        uniform sampler2D uTextureTo;
        varying vec2 vUv;

        void main() {
          vec2 uv = vUv;
          
          // Liquid warp calculation
          float displacement = texture2D(uTextureFrom, uv).r * 0.15;
          
          // Displace coordinate spaces in opposing directions
          vec2 uvFrom = uv + vec2(uProgress * displacement);
          vec2 uvTo = uv - vec2((1.0 - uProgress) * displacement);
          
          vec4 colorFrom = texture2D(uTextureFrom, uvFrom);
          vec4 colorTo = texture2D(uTextureTo, uvTo);
          
          // Blend over transition progress
          gl_FragColor = mix(colorFrom, colorTo, uProgress);
        }
      `
    });

    const mesh = new THREE.Mesh(this.geometry, this.material);
    this.scene.add(mesh);
  }

  resize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
  }

  /**
   * Captures an HTML element into a WebGL texture representation
   * @param {HTMLElement} element - DOM Node to screenshot
   * @returns {Promise<THREE.Texture>}
   */
  async captureDOMTexture(element) {
    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(element, { backgroundColor: null });
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * Executes the liquid morph transition
   * @param {THREE.Texture} fromTex - Source view texture
   * @param {THREE.Texture} toTex - Destination view texture
   * @returns {Promise<void>}
   */
  runTransition(fromTex, toTex) {
    this.material.uniforms.uTextureFrom.value = fromTex;
    this.material.uniforms.uTextureTo.value = toTex;
    this.material.uniforms.uProgress.value = 0;

    // Bring canvas to foreground
    this.canvas.style.pointerEvents = 'auto';

    return new Promise((resolve) => {
      gsap.to(this.material.uniforms.uProgress, {
        value: 1.0,
        duration: 1.25,
        ease: 'power4.inOut',
        onUpdate: () => this.render(),
        onComplete: () => {
          this.canvas.style.pointerEvents = 'none';
          resolve();
        }
      });
    });
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
```

### Orchestrating with the Router (Svelte/React Shell)
To coordinate the WebGL controller with a router view, capture the state of the layout view containers directly before and after the DOM swaps.

```javascript
// Example Router integration handler
async function handleRouterPageTransition(webglController, routerContainer, changeRouteFn) {
  // 1. Capture current DOM state
  const oldTexture = await webglController.captureDOMTexture(routerContainer);
  
  // Fade out current layout DOM slightly to prevent overlap layout flashing
  routerContainer.style.opacity = '0';
  
  // 2. Perform router navigation updates (updates DOM contents)
  await changeRouteFn();
  
  // 3. Capture new DOM state
  const newTexture = await webglController.captureDOMTexture(routerContainer);
  
  // Keep container hidden visually while WebGL performs the rendering morph
  routerContainer.style.opacity = '0';
  
  // 4. Run transition shader
  await webglController.runTransition(oldTexture, newTexture);
  
  // 5. Restore target DOM view visibility
  routerContainer.style.opacity = '1';
}
```

### Antipatterns & Fallbacks
*   **Antipattern: Pointer Event Blockers**: Leaving `pointer-events: auto` permanently active on the WebGL canvas wrapper. This blocks all user clicks, text selection, and form inputs on the underlying page content. Always toggle pointer-events off (`pointer-events: none`) immediately when animations complete.
*   **Antipattern: GPU Exhaustion**: Capturing textures for massive scrollable containers. Generating web textures from massive DOM elements triggers long JS compilation pauses and runs out of VRAM. Only capture the visible viewport block (`window.innerHeight`).
*   **Fallback**: If WebGL compilation fails or context is lost, immediately set the router wrapper opacity to `1` and exit the WebGL flow gracefully. Add a listener to handle fallback recovery:
    ```javascript
    canvasElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      routerContainer.style.opacity = '1';
    }, false);
    ```
