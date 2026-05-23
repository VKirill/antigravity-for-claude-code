# Typology & Implementation of "Living" Website Backgrounds (2026)

This document provides a systematic decision framework, code implementations, and optimization guidelines for creating interactive, performance-friendly website backgrounds in modern digital projects.

---

## 1. Decision Matrix: Background Typology

| Technique | Visual Effect | Technology | Perf Cost | Mobile Safety | When to Use |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Animated CSS Gradients** | Slow, soft color shifts | CSS (Keyframes / Custom Props) | Low | High | Standard SaaS landing pages, low-budget projects. |
| **SVG Turbulence Noise** | High-frequency grain or organic vector noise overlays | SVG Filters (`<feTurbulence>`) | High | Low | Textured editorial websites, small static card backdrops. |
| **Canvas Particle Fields** | Dust motes, starry nights, or interactive node graphs | Canvas2D | Medium | Medium | Developer portals, starry sky themes (keep particles < 800). |
| **WebGL Shader Gradients** | Smooth, continuous fluid mesh flows | WebGL2 / TSL | Medium | High (if DPR clamped) | Immersive premium headers, product viewer banners. |
| **Parallax Layers** | Dimensional depth through scroll offsets | CSS 3D / DOM Transforms | Low | High | Illustrative, storytelling portfolio layouts. |
| **Cursor-Reactive Warp** | Localized liquid displacement under cursor | WebGL (Frag Shader) | Medium | Medium | Interactive portfolios, premium creative studios. |
| **Scroll-Morphing Mesh** | 3D shapes warping on scroll depth | WebGL + Canvas | High | Medium | Scroll-driven narrative, interactive 3D product launches. |
| **Marquee Accents** | Continuously translating text/lines | CSS Translate3d | Low | High | Sponsorship strips, continuous news tickers. |
| **Blob/Metaballs** | Fluid, melting organic objects | WebGL / Canvas2D | High | Medium | Liquid button overlays, organic abstract UI elements. |
| **Ambient 3D Scenes** | Rotating geometries with fog and lights | WebGL (Three.js / OGL) | High | Medium | Digital agency landing pages, complex 3D product setups. |

---

## 2. Top 5 Implementation Recipes

### Recipe 1: Animated CSS Conic Gradient (GPU Accelerated)
Uses CSS custom properties and hardware-accelerated transforms to bypass CPU paint cycles.

```html
<div class="css-gradient-bg"></div>

<style>
  @property --angle {
    syntax: '<angle>';
    initial-value: 0deg;
    inherits: false;
  }

  .css-gradient-bg {
    position: fixed;
    inset: 0;
    z-index: -1;
    background: conic-gradient(from var(--angle), #03045e, #0077b6, #00b4d8, #03045e);
    animation: spinGradients 20s linear infinite;
    transform: translateZ(0); /* Force GPU composite layer */
  }

  @keyframes spinGradients {
    0% { --angle: 0deg; }
    100% { --angle: 360deg; }
  }
</style>
```

### Recipe 2: SVG Turbulence Noise Overlay
Applies a static grain filter over standard backgrounds. Animating this filter is heavy on the CPU; use a static grain pattern with low-frequency noise elements for production.

```html
<div class="noise-overlay"></div>

<svg style="position: absolute; width: 0; height: 0;">
  <filter id="grainy-noise">
    <!-- Base frequency 0.65 produces fine grain. numOctaves 3 adds detail -->
    <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" result="noise" />
    <feColorMatrix type="matrix" values="0 0 0 0 0   0 0 0 0 0   0 0 0 0 0  0 0 0 0.07 0" />
    <feComposite operator="in" in2="SourceGraphic" />
  </filter>
</svg>

<style>
  .noise-overlay {
    position: fixed;
    inset: 0;
    z-index: 10; /* Overlay above colors */
    pointer-events: none;
    filter: url(#grainy-noise);
    transform: translate3d(0,0,0);
  }
</style>
```

### Recipe 3: High-Performance Canvas 2D Particle Field
Optimized implementation of a starry/dust night. Capped particle counts and manual delta tracking ensure 60fps.

```html
<canvas id="particles-canvas"></canvas>

<script type="module">
  const canvas = document.getElementById('particles-canvas');
  const ctx = canvas.getContext('2d');
  const maxParticles = 300;
  const particles = [];

  class Particle {
    constructor(w, h) {
      this.x = Math.random() * w;
      this.y = Math.random() * h;
      this.radius = Math.random() * 1.5 + 0.5;
      this.speedY = Math.random() * 0.5 + 0.1;
    }
    update(w, h) {
      this.y -= this.speedY;
      if (this.y < 0) this.y = h;
    }
    draw(context) {
      context.beginPath();
      context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      context.fillStyle = 'rgba(255, 255, 255, 0.45)';
      context.fill();
    }
  }

  function init() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    particles.length = 0;
    for (let i = 0; i < maxParticles; i++) {
      particles.push(new Particle(canvas.width, canvas.height));
    }
  }

  window.addEventListener('resize', init);
  init();

  // Tick function referenced by LivingBackgroundManager
  export function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < particles.length; i++) {
      particles[i].update(canvas.width, canvas.height);
      particles[i].draw(ctx);
    }
  }
</script>
```

### Recipe 4: WebGL Shader Gradients
*Note: The complete shader and shader-wrapper programs are defined in [glsl-shader-recipes.md](glsl-shader-recipes.md).* 

To implement a high-fidelity shader gradient, load the optimized OGL Fullscreen Quad boilerplate and bind the fragment shader code from **Recipe 1 (Animated Flow/Mesh Gradient)**. This produces smooth liquid colors with screen-space dithering, eliminating color banding.

### Recipe 5: Parallax Scroll Layers (Pure CSS/JS optimized)
Scroll-linked offsets computed through `requestAnimationFrame` to prevent DOM layout thrashing.

```html
<div class="parallax-container">
  <div class="parallax-layer depth-0" data-speed="0.2"></div>
  <div class="parallax-layer depth-1" data-speed="0.5"></div>
</div>

<script>
  const layers = document.querySelectorAll('.parallax-layer');
  let lastScrollY = window.scrollY;
  let ticking = false;

  function updateParallax() {
    layers.forEach((layer) => {
      const speed = parseFloat(layer.getAttribute('data-speed'));
      const offset = -(lastScrollY * speed);
      layer.style.transform = `translate3d(0px, ${offset}px, 0px)`;
    });
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    lastScrollY = window.scrollY;
    if (!ticking) {
      window.requestAnimationFrame(updateParallax);
      ticking = true;
    }
  }, { passive: true });
</script>
```

---

## 3. Reusable Lazy-Init Wrapper (LivingBackgroundManager)

This class acts as a gatekeeper. It automatically monitors page focus and viewport intersections to halt render calculations when the background is invisible. It also honors user settings by falling back to static presentation when `prefers-reduced-motion` is active.

```typescript
export class LivingBackgroundManager {
  private element: HTMLElement;
  private isVisible: boolean = false;
  private isTabActive: boolean = true;
  private animationFrameId: number | null = null;
  private onTick: (time: number) => void;
  private observer: IntersectionObserver | null = null;

  constructor(element: HTMLElement, onTick: (time: number) => void) {
    this.element = element;
    this.onTick = onTick;

    // 1. Check for reduced motion media query
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      console.info('[BackgroundManager] Reduced motion detected. Drawing static fallback.');
      this.drawStaticFallback();
      return;
    }

    this.init();
  }

  private init() {
    // 2. Track window tab visibility changes
    document.addEventListener('visibilitychange', this.handleVisibilityChange, false);

    // 3. Track DOM viewport intersection changes
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        this.isVisible = entry.isIntersecting;
        this.evaluateLoopState();
      });
    }, {
      root: null, // Viewport
      threshold: 0.01 // Pause immediately when scrolled off-screen
    });

    this.observer.observe(this.element);
  }

  private handleVisibilityChange = () => {
    this.isTabActive = document.visibilityState === 'visible';
    this.evaluateLoopState();
  };

  private evaluateLoopState() {
    const shouldRun = this.isVisible && this.isTabActive;

    if (shouldRun && !this.animationFrameId) {
      this.loop(0);
    } else if (!shouldRun && this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private loop = (timestamp: number) => {
    this.onTick(timestamp);
    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  private drawStaticFallback() {
    // Dispatch a single frame tick to display initial states
    this.onTick(0);
  }

  public destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.observer) {
      this.observer.disconnect();
    }
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }
}
```

---

## 4. Production Examples (Verified May 2026)

* **Stripe** ([https://stripe.com](https://stripe.com)): Features the benchmark animated mesh-gradient background, initialized via a custom WebGL helper canvas.
* **Linear** ([https://linear.app](https://linear.app)): Implements soft, slow-moving ambient radial gradients overlayed with fine SVG noise filters.
* **Vercel** ([https://vercel.com](https://vercel.com)): Employs dynamic scroll-drawn glowing grid path animations built on vector layers.
* **Active Theory** ([https://activetheory.net](https://activetheory.net)): Deploys interactive, cursor-reactive WebGL fluid simulations covering the viewport.
* **Lusion** ([https://lusion.co](https://lusion.co)): Runs high-fidelity 3D particle systems and ambient fog environments interacting with cursor raycasts.

---

## 5. Living Background Antipatterns

* **Running constantly in the background**: Processing animations on hidden tabs or off-screen sections (wastes GPU/CPU resources).
* **Failing the `prefers-reduced-motion` check**: Forcing users with motion sensitivities to watch swirling web elements.
* **Overriding pointer events**: Blocking cursor actions (`click`, `scroll`) on page content due to missing `pointer-events: none` on the background canvas container.
* **Unclamped Device Pixel Ratio**: Scaling the drawing buffer to native Retina densities (e.g. `dpr={3}`) on heavy WebGL shader backgrounds, which slows down mobile performance.
* **Failing to clean up event listeners**: Leaving scroll and resize listeners attached when navigating away from the page, which leads to memory leaks.
