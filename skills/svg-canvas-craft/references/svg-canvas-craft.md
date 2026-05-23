# SVG & Canvas2D Engineering Craft (May 2026)

This document outlines implementation techniques, performance boundaries, and optimization standards for rendering vectors (SVG) and raster frames (Canvas2D) on the web.

---

## 1. SVG Engineering & Optimization

### A. Animation Paradigms: CSS vs SMIL vs JS
*   **CSS Keyframes**: Best for simple translations, rotations, opacity, and basic stroke drawing. Operates on the compositor thread.
*   **SMIL (SVG XML Animation)**: *Legacy (stale)*. While supported by browsers, it is non-composable, hard to control via JavaScript, and has been replaced by modern web standards.
*   **JS Engines (GSAP / Motion)**: Best for complex timeline sequencing, morphing paths, and interactive scroll triggers.

### B. Accessible Inline SVG Markup
Always include semantic wrappers, ARIA roles, and accessibility descriptions to prevent assistive technologies from skipping or breaking on custom graphics.

```html
<svg 
  viewBox="0 0 100 100" 
  width="100" 
  height="100" 
  role="img" 
  aria-labelledby="svg-logo-title svg-logo-desc">
  
  <title id="svg-logo-title">TechCorp Brand Mark</title>
  <desc id="svg-logo-desc">A blue geometric circle morphing into an infinite loop shape.</desc>
  
  <circle cx="50" cy="50" r="40" fill="#00f0ff" />
</svg>
```

### C. SVGO Configuration (`svgo.config.mjs`)
Production SVGO configuration ensuring optimal code minification without stripping accessibility tags or breaking clip-path ID mappings.

```javascript
export default {
  multipass: true, // Optimize multiple times for smallest size
  js2svg: {
    indent: 2,
    pretty: false,
  },
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          cleanupIds: false, // Prevent breaking CSS/JS clipPath associations
          removeTitle: false, // Retain for screen reader accessibility
          removeDesc: false,  // Retain for screen reader accessibility
          convertColors: {
            currentColor: true, // Convert inline hex colors to currentColor
          }
        }
      }
    },
    'sortAttrs',
    'prefixIds'
  ]
};
```

---

## 2. Complete SVG Code Recipes

### Recipe 1: Draw-On SVG Logo (CSS Keyframe Trigger)
Uses `stroke-dasharray` and `stroke-dashoffset` to reveal paths.

```html
<svg viewBox="0 0 400 100" class="draw-logo" role="img" aria-label="Animated outline logo">
  <!-- pathLength="1" normalizes the dash calculations to a 0-1 range -->
  <path 
    class="logo-path" 
    d="M 50,50 L 150,50 L 200,90 L 250,50 L 350,50" 
    fill="none" 
    stroke="#00f0ff" 
    stroke-width="6" 
    stroke-linecap="round" 
    pathLength="1" />
</svg>

<style>
  .draw-logo {
    width: 400px;
    height: 100px;
  }
  .logo-path {
    stroke-dasharray: 1;
    stroke-dashoffset: 1; /* Hide path initially */
    animation: drawPath 2.5s cubic-bezier(0.25, 1, 0.5, 1) forwards;
  }

  @keyframes drawPath {
    to {
      stroke-dashoffset: 0; /* Draw path to completion */
    }
  }
</style>
```

### Recipe 2: SVG Gooey Filter Blobs
Uses Gaussian blurs and color matrices to merge adjacent shapes.

```html
<div class="blob-wrapper">
  <div class="blob blob-1"></div>
  <div class="blob blob-2"></div>
</div>

<svg style="position: absolute; width: 0; height: 0;">
  <defs>
    <filter id="gooey-filter">
      <!-- 1. Blur the overlapping elements -->
      <feGaussianBlur in="SourceGraphic" stdDeviation="18" result="blur" />
      <!-- 2. Sharpen the alpha channel threshold to create a clean boundary -->
      <feColorMatrix 
        in="blur" 
        mode="matrix" 
        values="1 0 0 0 0  
                0 1 0 0 0  
                0 0 1 0 0  
                0 0 0 28 -9" 
        result="gooey" />
      <feComposite in="SourceGraphic" in2="gooey" operator="atop" />
    </filter>
  </defs>
</svg>

<style>
  .blob-wrapper {
    position: relative;
    width: 400px;
    height: 400px;
    filter: url(#gooey-filter);
    background: #000;
  }
  .blob {
    position: absolute;
    width: 140px;
    height: 140px;
    border-radius: 50%;
    background: #00f0ff;
    will-change: transform;
  }
  .blob-1 {
    top: 130px;
    left: 80px;
    animation: floatX 6s ease-in-out infinite alternate;
  }
  .blob-2 {
    top: 130px;
    left: 180px;
    animation: floatY 6s ease-in-out infinite alternate-reverse;
  }

  @keyframes floatX {
    to { transform: translate3d(60px, 0, 0); }
  }
  @keyframes floatY {
    to { transform: translate3d(-60px, 10px, 0); }
  }
</style>
```

### Recipe 3: Clip-Path Cursor Spotlight Reveal
Masks background elements using a dynamic clipping path.

```html
<div class="reveal-container">
  <div class="background-hidden">
    <h1>Secrets Revealed</h1>
  </div>
  
  <svg style="position: absolute; width: 0; height: 0;">
    <defs>
      <clipPath id="spotlight-clip" clipPathUnits="userSpaceOnUse">
        <circle id="clip-circle" cx="0" cy="0" r="120" />
      </clipPath>
    </defs>
  </svg>
</div>

<script>
  const container = document.querySelector('.reveal-container');
  const clipCircle = document.getElementById('clip-circle');

  // Track cursor position to update mask coordinates
  container.addEventListener('mousemove', (e) => {
    const bound = container.getBoundingClientRect();
    const x = e.clientX - bound.left;
    const y = e.clientY - bound.top;
    
    // Update SVG circle coordinates
    clipCircle.setAttribute('cx', x);
    clipCircle.setAttribute('cy', y);
  }, { passive: true });
</script>

<style>
  .reveal-container {
    position: relative;
    width: 100vw;
    height: 100vh;
    background: #111;
    overflow: hidden;
  }
  .background-hidden {
    position: absolute;
    inset: 0;
    background: linear-gradient(45deg, #ff007f, #7f00ff);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 5rem;
    
    /* Apply mask clip path reference */
    clip-path: url(#spotlight-clip);
  }
</style>
```

---

## 3. Canvas2D Performance & Worker Offloading

### A. High-DPI Canvas Configuration
Standard canvas elements render blurry on high-density Retina displays. Map the physical canvas size to matching pixel ratios, scaling the logical rendering viewport accordingly.

```javascript
export function setupHighDpiCanvas(canvas, width, height) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  // Set the backing store resolution (physical pixels)
  canvas.width = width * dpr;
  canvas.height = height * dpr;

  // Set CSS display dimensions (logical pixels)
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  // Scale the coordinate space to prevent drawing distortions
  ctx.scale(dpr, dpr);
  
  return ctx;
}
```

### B. OffscreenCanvas & Web Worker Setup
Offloads particle rendering tasks from the main thread to Web Workers.

#### 1. Main Thread Wrapper (`main.js`)
```javascript
const canvas = document.getElementById('particles-canvas');
const rect = canvas.getBoundingClientRect();

// setup scale dimensions
canvas.style.width = `${rect.width}px`;
canvas.style.height = `${rect.height}px`;

// Transfer control to worker thread
const offscreen = canvas.transferControlToOffscreen();

// Initialize worker
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });

// Send the canvas to the worker thread
worker.postMessage({
  type: 'INIT',
  canvas: offscreen,
  width: rect.width,
  height: rect.height,
  dpr: window.devicePixelRatio || 1
}, [offscreen]); // Pass offscreen canvas as transferable object
```

#### 2. Worker Thread Loop (`worker.js`)
```javascript
let canvas, ctx, width, height, dpr;
const particles = [];
const maxParticles = 600;

class Particle {
  constructor() {
    this.x = Math.random() * width;
    this.y = Math.random() * height;
    this.vx = (Math.random() - 0.5) * 1.5;
    this.vy = (Math.random() - 0.5) * 1.5;
    this.r = Math.random() * 2 + 1;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    if (this.x < 0 || this.x > width) this.vx *= -1;
    if (this.y < 0 || this.y > height) this.vy *= -1;
  }
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 240, 255, 0.7)';
    ctx.fill();
  }
}

self.onmessage = function (e) {
  if (e.data.type === 'INIT') {
    canvas = e.data.canvas;
    width = e.data.width;
    height = e.data.height;
    dpr = e.data.dpr;

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Pre-allocate particles
    for (let i = 0; i < maxParticles; i++) {
      particles.push(new Particle());
    }

    tick();
  }
};

function tick() {
  ctx.clearRect(0, 0, width, height);

  for (let i = 0; i < particles.length; i++) {
    particles[i].update();
    particles[i].draw();
  }

  requestAnimationFrame(tick);
}
```

### C. When Canvas Beats SVG/DOM
*   **Use SVG/DOM**: For UI elements, responsive buttons, icons, or layouts requiring CSS styling, accessibility wrappers, and mouse hover tracking. Capped at < 800 nodes.
*   **Use Canvas**: When drawing thousands of particles, dynamic fluid vectors, or real-time generative layouts. Standard DOM operations struggle when updating > 1000 independent nodes per frame, whereas Canvas handles updates in a single draw loop.

---

## 4. Vector & Canvas Performance Antipatterns

*   **Relying on DOM nodes for particle effects**: Creating separate `div` layers to animate particles (e.g. 800 nodes via CSS). This leads to DOM layout thrashing. Use a single `<canvas>` element instead.
*   **Unscaled Canvas Resolutions**: Failing to map physical canvas dimensions to matching pixel ratios, resulting in blurry rendering on Retina displays.
*   **Frequent State Changes in Canvas Loops**: Calling methods like `ctx.fillStyle` or modifying fill colors frequently inside loops. Group rendering operations by shared states (e.g. color, stroke style) before drawing.
*   **Applying Heavy Blur Filters to Active SVGs**: Applying filters like `<feGaussianBlur>` with large blur radius coordinates (`stdDeviation > 30`) to moving SVG objects. This causes CPU rasterization bottlenecks.
*   **Programmatic WebGL/Canvas setups on the Main Thread**: Running complex particle updates on the main thread, which blocks UI interactions. Offload these calculations to Web Workers using `OffscreenCanvas`.
*   **Generating Garbage in Animation Loops**: Allocating objects, arrays, or vectors inside animation tick functions, which triggers frequent garbage collection pauses. Pre-allocate assets outside the loop instead.
