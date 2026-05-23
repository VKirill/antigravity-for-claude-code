# Cursor Effects & Scrollytelling Patterns (May 2026)

This document provides a set of complete, production-grade recipes for custom cursor interactions and scroll-driven storytelling (scrollytelling) animations. All patterns prioritize GPU-bound translations, keyboard-accessible fallbacks, and user preference gating.

---

## 1. PART A: Custom Cursor Recipes

### Recipe 1: Magnetic UI Elements (Vanilla JS, Zero-Dependency)
Pull-to-cursor physical acceleration on interactive elements (e.g. buttons, icons).

```html
<button class="magnetic-button" data-strength="30">
  <span class="btn-text">Magnetic Action</span>
</button>

<script>
  const magneticElements = document.querySelectorAll('.magnetic-button');

  magneticElements.forEach((el) => {
    const strength = parseFloat(el.getAttribute('data-strength')) || 25;
    const text = el.querySelector('.btn-text');

    el.addEventListener('mousemove', (e) => {
      const bound = el.getBoundingClientRect();
      // Calculate cursor position relative to element center
      const x = e.clientX - (bound.left + bound.width / 2);
      const y = e.clientY - (bound.top + bound.height / 2);

      // Translate the parent container and text layer at different ratios for 3D parallax
      el.style.transform = `translate3d(${x * (strength / 100)}px, ${y * (strength / 100)}px, 0)`;
      if (text) {
        text.style.transform = `translate3d(${x * (strength / 200)}px, ${y * (strength / 200)}px, 0)`;
      }
    });

    el.addEventListener('mouseleave', () => {
      // Smooth return transition
      el.style.transition = 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)';
      if (text) {
        text.style.transition = 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)';
      }
      el.style.transform = 'translate3d(0, 0, 0)';
      if (text) text.style.transform = 'translate3d(0, 0, 0)';
    });

    el.addEventListener('mouseenter', () => {
      el.style.transition = 'none';
      if (text) text.style.transition = 'none';
    });
  });
</script>

<style>
  .magnetic-button {
    display: inline-block;
    padding: 16px 32px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: transparent;
    color: white;
    cursor: pointer;
    transform-style: preserve-3d;
    will-change: transform;
  }
  .btn-text {
    display: inline-block;
    pointer-events: none;
    will-change: transform;
  }
</style>
```

### Recipe 2: Morphing Custom Cursor (React 19, Motion v12.40.0)
*RU Gloss: Нодальная анимация лейаута курсора (Morphing layout transition).* Integrates React 19 and the updated `motion` package (formerly `framer-motion`) to morph the cursor shape when hovering over key elements.

```tsx
// Install command: npm install motion@12.40.0 react@19.0.0
import React, { useEffect, useState, useRef } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';

export function MorphingCursor() {
  const [cursorType, setCursorType] = useState<'default' | 'hover'>('default');
  
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);

  // Setup spring physics for smooth interpolation (stiffness: 400, damping: 28)
  const springOptions = { stiffness: 400, damping: 28, mass: 0.5 };
  const cursorXSpring = useSpring(cursorX, springOptions);
  const cursorYSpring = useSpring(cursorY, springOptions);

  useEffect(() => {
    const moveCursor = (e: MouseEvent) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
    };

    const handleHoverStart = () => setCursorType('hover');
    const handleHoverEnd = () => setCursorType('default');

    window.addEventListener('mousemove', moveCursor, { passive: true });

    // Attach listeners to target UI elements
    const targets = document.querySelectorAll('[data-hover-morph]');
    targets.forEach((target) => {
      target.addEventListener('mouseenter', handleHoverStart);
      target.addEventListener('mouseleave', handleHoverEnd);
    });

    return () => {
      window.removeEventListener('mousemove', moveCursor);
      targets.forEach((target) => {
        target.removeEventListener('mouseenter', handleHoverStart);
        target.removeEventListener('mouseleave', handleHoverEnd);
      });
    };
  }, [cursorX, cursorY]);

  // Accessibility: Do not render custom cursors on touch screens
  if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) {
    return null;
  }

  return (
    <motion.div
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        x: cursorXSpring,
        y: cursorYSpring,
        translateX: '-50%',
        translateY: '-50%',
        pointerEvents: 'none',
        zIndex: 9999,
        willChange: 'transform, width, height, border-radius',
      }}
      animate={{
        width: cursorType === 'hover' ? 48 : 12,
        height: cursorType === 'hover' ? 48 : 12,
        borderRadius: cursorType === 'hover' ? '8px' : '50%',
        backgroundColor: cursorType === 'hover' ? 'rgba(0, 240, 255, 0.2)' : 'rgba(255, 255, 255, 1.0)',
        border: cursorType === 'hover' ? '1px solid #00f0ff' : 'none',
      }}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
    />
  );
}
```

### Recipe 3: High-Performance Canvas Cursor Trail
Combines physics-based joints inside a canvas layer to prevent DOM node thrashing.

```html
<canvas id="cursor-trail" style="position: fixed; inset: 0; pointer-events: none; z-index: 999;"></canvas>

<script>
  const canvas = document.getElementById('cursor-trail');
  const ctx = canvas.getContext('2d');
  
  let mouse = { x: -100, y: -100 };
  const numPoints = 25;
  const trail = Array.from({ length: numPoints }, () => ({ x: -100, y: -100 }));

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize, false);
  resize();

  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }, { passive: true });

  requestAnimationFrame(function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Physics step: head of trail follows cursor
    trail[0].x = mouse.x;
    trail[0].y = mouse.y;

    // Follow step: trailing joints interpolate to prior joint with lerp factor (0.42)
    for (let i = 1; i < numPoints; i++) {
      trail[i].x += (trail[i - 1].x - trail[i].x) * 0.42;
      trail[i].y += (trail[i - 1].y - trail[i].y) * 0.42;
    }

    // Render path
    ctx.beginPath();
    ctx.moveTo(trail[0].x, trail[0].y);
    for (let i = 1; i < numPoints - 1; i++) {
      const xc = (trail[i].x + trail[i + 1].x) / 2;
      const yc = (trail[i].y + trail[i + 1].y) / 2;
      ctx.quadraticCurveTo(trail[i].x, trail[i].y, xc, yc);
    }
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.stroke();

    requestAnimationFrame(tick);
  });
</script>
```

### Recipe 4: Hover Image-Reveal Follower
Smoothly offsets a hidden container to reveal images corresponding to cursor coordinate sweeps.

```html
<nav class="hover-nav">
  <a href="#" class="nav-item" data-image="product1.jpg">Project Alpha</a>
  <a href="#" class="nav-item" data-image="product2.jpg">Project Beta</a>
</nav>

<div class="hover-image-reveal">
  <img src="" alt="Preview" class="reveal-img" />
</div>

<script>
  const navItems = document.querySelectorAll('.nav-item');
  const revealContainer = document.querySelector('.hover-image-reveal');
  const revealImg = revealContainer.querySelector('.reveal-img');

  let mouse = { x: 0, y: 0 };
  let currentPos = { x: 0, y: 0 };

  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }, { passive: true });

  // Update loop tracking cursor position
  requestAnimationFrame(function update() {
    currentPos.x += (mouse.x - currentPos.x) * 0.1;
    currentPos.y += (mouse.y - currentPos.y) * 0.1;

    revealContainer.style.transform = `translate3d(${currentPos.x}px, ${currentPos.y}px, 0) translate3d(-50%, -50%, 0)`;
    requestAnimationFrame(update);
  });

  navItems.forEach((item) => {
    item.addEventListener('mouseenter', () => {
      const imgPath = item.getAttribute('data-image');
      revealImg.src = imgPath;
      revealContainer.classList.add('is-active');
    });

    item.addEventListener('mouseleave', () => {
      revealContainer.classList.remove('is-active');
    });
  });
</script>

<style>
  .hover-image-reveal {
    position: fixed;
    top: 0;
    left: 0;
    width: 250px;
    height: 350px;
    border-radius: 12px;
    overflow: hidden;
    pointer-events: none;
    opacity: 0;
    transform: translate3d(0,0,0) scale(0.8);
    transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.25, 1, 0.5, 1);
    z-index: 999;
  }
  .hover-image-reveal.is-active {
    opacity: 1;
    transform: translate3d(0,0,0) scale(1);
  }
  .reveal-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>
```

### Recipe 5: Distortion-Under-Cursor (WebGL)
*Note: Refer to **Recipe 8 (Liquid/Ripple Cursor Distortion)** in [glsl-shader-recipes.md](glsl-shader-recipes.md).* 

WebGL cursor distortion bypasses DOM layout delays. It passes cursor coordinates as a normalized `uniform vec2 uMouse` into the GPU fragment pipeline, applying sine distortions directly to UV textures.

---

## 2. PART B: Scrollytelling Recipes

### Recipe 1: Pinned Split-Screen Layout (Vanilla CSS Sticky)
Keeps the visual layer pinned on the viewport while descriptive text content scrolls vertically.

```html
<section class="split-scroll">
  <div class="split-left">
    <div class="scroll-trigger" data-frame="0"><h2>01. Concept</h2><p>Description text here.</p></div>
    <div class="scroll-trigger" data-frame="1"><h2>02. Prototype</h2><p>Description text here.</p></div>
    <div class="scroll-trigger" data-frame="2"><h2>03. Production</h2><p>Description text here.</p></div>
  </div>
  <div class="split-right sticky-panel">
    <div class="visual-canvas">
      <!-- 3D Scene or Interactive Visual Panel -->
    </div>
  </div>
</section>

<style>
  .split-scroll {
    display: flex;
    position: relative;
    width: 100%;
  }
  .split-left {
    width: 50%;
  }
  .scroll-trigger {
    height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 10%;
  }
  .split-right {
    position: sticky;
    top: 0;
    width: 50%;
    height: 100vh;
    background: #111;
    overflow: hidden;
  }
</style>
```

### Recipe 2: Horizontal-on-Vertical Scroll Container (GSAP v3.15.0)
Converts vertical scroll inputs to horizontal translation movements.

```html
<div class="horizontal-trigger">
  <div class="horizontal-wrap">
    <section class="panel panel-1">Panel A</section>
    <section class="panel panel-2">Panel B</section>
    <section class="panel panel-3">Panel C</section>
  </div>
</div>

<script type="module">
  import { gsap } from 'gsap';
  import { ScrollTrigger } from 'gsap/ScrollTrigger';

  gsap.registerPlugin(ScrollTrigger);

  const wrap = document.querySelector('.horizontal-wrap');
  const panels = gsap.utils.toArray('.panel');

  gsap.to(wrap, {
    x: () => -(wrap.scrollWidth - window.innerWidth),
    ease: 'none',
    scrollTrigger: {
      trigger: '.horizontal-trigger',
      pin: true,
      scrub: 1, // 1-second lag feedback for smoothness
      start: 'top top',
      end: () => `+=${wrap.scrollWidth - window.innerWidth}`,
      invalidateOnRefresh: true, // Recalculate dimensions on window resize
    }
  });
</script>

<style>
  .horizontal-trigger {
    overflow: hidden;
    width: 100%;
  }
  .horizontal-wrap {
    display: flex;
    flex-direction: row;
    width: 300vw; /* 3 panels wide */
    height: 100vh;
    will-change: transform;
  }
  .panel {
    width: 100vw;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 5vw;
  }
</style>
```

### Recipe 3: Image-Sequence Canvas Scrubber
Draws high-resolution video frames on a canvas, controlled by scroll position.

```html
<div class="sequence-container">
  <canvas id="scrub-canvas"></canvas>
</div>

<script type="module">
  import { gsap } from 'gsap';
  import { ScrollTrigger } from 'gsap/ScrollTrigger';

  gsap.registerPlugin(ScrollTrigger);

  const canvas = document.getElementById('scrub-canvas');
  const context = canvas.getContext('2d');

  canvas.width = 1920;
  canvas.height = 1080;

  const frameCount = 147;
  // Generate file paths: frame_0001.jpg -> frame_0147.jpg
  const currentFrame = index => `https://example.com/frames/frame_${(index + 1).toString().padStart(4, '0')}.jpg`;

  const images = [];
  const sequenceState = { frame: 0 };

  // Preload images to prevent frame flickering during scroll
  const preloadImages = () => {
    for (let i = 0; i < frameCount; i++) {
      const img = new Image();
      img.src = currentFrame(i);
      images.push(img);
    }
  };

  preloadImages();

  // Render the current frame
  function render() {
    const activeImg = images[sequenceState.frame];
    if (activeImg && activeImg.complete) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(activeImg, 0, 0, canvas.width, canvas.height);
    }
  }

  // Ensure first frame draws once loaded
  images[0].onload = render;

  gsap.to(sequenceState, {
    frame: frameCount - 1,
    snap: 'frame', // Snap progress index to integer frames
    ease: 'none',
    scrollTrigger: {
      trigger: '.sequence-container',
      start: 'top top',
      end: '+=300%', // Scale scroll height to control speed
      pin: true,
      scrub: 0.5,
      onUpdate: render // Redraw on every scroll update
    }
  });
</script>

<style>
  .sequence-container {
    width: 100%;
    height: 100vh;
    background: #000;
  }
  #scrub-canvas {
    width: 100vw;
    height: 100vh;
    object-fit: cover;
  }
</style>
```

### Recipe 4: 3D Camera Path on Scroll (Three.js + GSAP)
Moves the Three.js camera along a 3D spline curve based on scroll progression.

```tsx
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function setupCameraPath(camera: THREE.PerspectiveCamera, scene: THREE.Scene) {
  // 1. Define a Catmull-Rom spline curve through 3D space
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 5, 10),
    new THREE.Vector3(5, 3, 5),
    new THREE.Vector3(-3, 2, -2),
    new THREE.Vector3(0, 1, -5)
  ]);

  // Target object camera always focuses on
  const lookTarget = new THREE.Vector3(0, 0, 0);

  const animState = { progress: 0 };

  gsap.to(animState, {
    progress: 1,
    ease: 'none',
    scrollTrigger: {
      trigger: '.canvas-container',
      start: 'top top',
      end: '+=400%',
      pin: true,
      scrub: true,
      onUpdate: () => {
        // Query coordinate along spline path
        const position = path.getPointAt(animState.progress);
        camera.position.copy(position);
        camera.lookAt(lookTarget);
      }
    }
  });
}
```

### Recipe 5: Text & Media Choreography
Choreographs text reveals and media cards in sync.

```html
<section class="chrono-section">
  <h1 class="reveal-text">Choreographed Reveal</h1>
  <div class="media-card"></div>
</section>

<script type="module">
  import { gsap } from 'gsap';
  import { ScrollTrigger } from 'gsap/ScrollTrigger';

  gsap.registerPlugin(ScrollTrigger);

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: '.chrono-section',
      start: 'top 60%',
      end: 'bottom bottom',
      toggleActions: 'play none none reverse'
    }
  });

  // Reveal text line-by-line using clip-path, followed by the media card
  tl.fromTo('.reveal-text', 
    { clipPath: 'polygon(0 100%, 100% 100%, 100% 100%, 0 100%)', y: 40 },
    { clipPath: 'polygon(0 0%, 100% 0%, 100% 100%, 0 100%)', y: 0, duration: 0.8, ease: 'power3.out' }
  ).fromTo('.media-card',
    { opacity: 0, scale: 0.9, y: 20 },
    { opacity: 1, scale: 1, y: 0, duration: 0.6, ease: 'power2.out' },
    '-=0.4' // Overlap animations by 0.4 seconds
  );
</script>

<style>
  .reveal-text {
    font-size: 4rem;
    line-height: 1.1;
    will-change: transform, clip-path;
  }
  .media-card {
    width: 400px;
    height: 250px;
    background: #00f0ff;
    will-change: transform, opacity;
  }
</style>
```

### Recipe 6: Circular Scroll Progress Indicator
A circular progress bar tying SVG stroke offsets to scroll depth.

```html
<div class="scroll-progress-widget">
  <svg class="progress-ring" width="60" height="60">
    <circle class="progress-ring__circle" stroke="#00f0ff" stroke-width="4" fill="transparent" r="26" cx="30" cy="30"/>
  </svg>
</div>

<script>
  const circle = document.querySelector('.progress-ring__circle');
  const radius = circle.r.baseVal.value;
  const circumference = radius * 2 * Math.PI;

  circle.style.strokeDasharray = `${circumference} ${circumference}`;
  circle.style.strokeDashoffset = circumference;

  window.addEventListener('scroll', () => {
    const html = document.documentElement;
    const scrollPercent = html.scrollTop / (html.scrollHeight - html.clientHeight);
    const offset = circumference - (scrollPercent * circumference);
    circle.style.strokeDashoffset = offset;
  }, { passive: true });
</script>

<style>
  .scroll-progress-widget {
    position: fixed;
    bottom: 30px;
    right: 30px;
    z-index: 100;
  }
  .progress-ring {
    transform: rotate(-90deg); /* Rotate start to 12 o'clock */
  }
</style>
```

---

## 3. Performance & Accessibility Gating

### GPU Execution Safeguards
* **Limit properties to transforms and opacity**: Ensure animations animate only `transform: translate3d()` and `opacity` properties. Animating properties like `width`, `height`, `left`, `top`, or `margin` triggers continuous layout re-calculations on the main thread.
* **Limit rendering loops**: Defer calculation updates to `requestAnimationFrame` ticks. Use the `passive: true` flag on scroll listeners to prevent blocking native scroll performance.

### Keyboard Navigation Fallback
Custom cursors must snap to focused elements during keyboard navigation rather than disappearing or floating away.

```javascript
const customCursor = document.querySelector('.custom-cursor');

document.querySelectorAll('a, button, input').forEach((el) => {
  el.addEventListener('focus', () => {
    const bound = el.getBoundingClientRect();
    // Center custom cursor on focused element coordinates
    customCursor.style.left = `${bound.left + bound.width / 2}px`;
    customCursor.style.top = `${bound.top + bound.height / 2}px`;
    customCursor.classList.add('is-focused');
  });

  el.addEventListener('blur', () => {
    customCursor.classList.remove('is-focused');
  });
});
```

### Motion Sensitivity Preference
Respect the `prefers-reduced-motion` setting by disabling motion transitions or using static alternatives.

```javascript
import { gsap } from 'gsap';

const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

function applyAnimations() {
  if (motionQuery.matches) {
    // 1. Fallback: Apply final states immediately or use simple opacity fades
    gsap.set('.reveal-text, .media-card', { opacity: 1, y: 0, clipPath: 'none' });
  } else {
    // 2. Run standard rich animations
    runRichEffects();
  }
}

motionQuery.addEventListener('change', applyAnimations);
applyAnimations();
```

### No Scroll-Jacking
Do not intercept or override native scroll physics (e.g. replacing smooth touchpad inertia with custom mouse wheel intervals). This breaks standard accessibility utilities, arrow/space navigation keys, and mobile gestures.

---

## 4. Cursor & Scrollytelling Antipatterns

* **Scroll-jacking native mouse input**: Intercepting page scroll coordinates to implement custom scroll physics. This breaks browser accessibility settings.
* **DOM-based cursor trails**: Rendering individual trail steps as DOM nodes (e.g. creating 30 `<div class="trail">` tags) which results in continuous layout thrashing. Use a single `<canvas>` element instead.
* **Animating layout-disrupting properties**: Using GSAP to transition properties like `height` or `margin`, which triggers browser repaints on every frame. Use `scale` or `translate` transforms instead.
* **Ignoring viewport constraints**: Executing complex scroll-driven animations on elements that have scrolled out of the viewport. Always combine animations with ScrollTrigger or IntersectionObserver hooks to pause them when off-screen.
* **Missing focus state support**: Hiding the browser's default focus ring (`outline: none`) without styling custom cursors to target and snap to elements when focused via keyboard navigation.
