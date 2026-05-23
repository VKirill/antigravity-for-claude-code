# GSAP v3.15.0 Complete Plugin Recipe Book (React 19 & Next.js/Astro)

This document contains production-grade integration recipes for GSAP v3.15.0 and `@gsap/react` v2.1.2. 

> [!NOTE]
> Following Webflow's acquisition of GreenSock in late 2024, all premium "Club GreenSock" plugins (SplitText, MorphSVG, DrawSVG, ScrambleText) are now **100% free** under the unified GreenSock license.

---

## 1. Installation
Install core GSAP and the official React wrapper package:
```bash
npm install gsap@3.15.0 @gsap/react@2.1.2
```

---

## 2. React 19 / SPA Lifecycle & Garbage Collection

### The Core Problem
React 19's concurrent rendering and double-effect invocation in Strict Mode create multiple timelines and trigger memory leaks if animations are not cleaned up. 

### The Solution: `@gsap/react` + Scoping
The `useGSAP` hook automatically creates a `gsap.context()` wrapper, reverting all animations and ScrollTriggers created *during* the execution of the hook when the component unmounts.

```tsx
import { useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

export default function SmoothReveal() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    // 1. All selections are scoped to containerRef automatically
    gsap.from('.box', {
      opacity: 0,
      y: 20,
      stagger: 0.1,
      duration: 0.8,
      ease: 'power3.out'
    });
  }, { scope: containerRef }); // Strict scoping prevents selector collisions

  return (
    <div ref={containerRef} className="container">
      <div className="box">Box 1</div>
      <div className="box">Box 2</div>
    </div>
  );
}
```

---

## 3. Plugin Recipes

### Recipe 1: ScrollTrigger (Pinning, Scrubbing, Snapping, Batching, matchMedia)
Advanced viewport-based interactions. *Note: For Lenis physics sync, see [scroll_driven_animations_2026.md](scroll_driven_animations_2026.md).*

```tsx
import { useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

export function AdvancedScrollTrigger() {
  const scopeRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();

    // Responsive scoping via matchMedia
    mm.add('(min-width: 768px)', () => {
      // 1. Pinning + Scrubbing
      gsap.to('.sidebar', {
        xPercent: 100,
        scrollTrigger: {
          trigger: '.pinned-section',
          start: 'top top',
          end: '+=1000',
          pin: true,
          scrub: true,
          snap: {
            snapTo: 0.5, // Snaps to 0%, 50%, or 100% of progress
            duration: 0.3,
            ease: 'power1.inOut'
          }
        }
      });

      // 2. Batching elements for performant grid entry animations
      ScrollTrigger.batch('.grid-item', {
        onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, stagger: 0.1, overwrite: 'auto' }),
        onLeave: (batch) => gsap.to(batch, { opacity: 0, y: -20, overwrite: 'auto' }),
        onEnterBack: (batch) => gsap.to(batch, { opacity: 1, y: 0, stagger: 0.1, overwrite: 'auto' }),
        onLeaveBack: (batch) => gsap.to(batch, { opacity: 0, y: 20, overwrite: 'auto' })
      });
    });

    return () => mm.revert(); // Essential cleanup
  }, { scope: scopeRef });

  return (
    <div ref={scopeRef} className="pinned-section">
      <div className="sidebar">Pinned panel</div>
      <div className="grid-item">Grid item 1</div>
      <div className="grid-item">Grid item 2</div>
    </div>
  );
}
```
*   **Gotcha**: Pinning adds extra wrapper markup (`pin-spacer`). Ensure nested flex or absolute children do not collapse relative layout heights.

---

### Recipe 2: Flip (Shared-Element & Layout Transitions)
Animates structural layout changes (e.g. modifying `flex-direction`, resizing, or moving cards to modals).

```tsx
import { useState, useRef } from 'react';
import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(Flip);

export function FlipLayout() {
  const [isGrid, setIsGrid] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { contextSafe } = useGSAP({ scope: containerRef });

  // contextSafe is required for async event handlers (clicks)
  const toggleLayout = contextSafe(() => {
    // 1. Record starting layout positions
    const state = Flip.getState('.card');

    // 2. Modify state which changes DOM structure (Strict layout updates)
    setIsGrid(!isGrid);

    // 3. Instruct GSAP to transition smoothly between recorded states
    gsap.delayedCall(0.01, () => {
      Flip.from(state, {
        duration: 0.5,
        ease: 'power3.inOut',
        absolute: true, // Prevents collapsing sibling elements
        stagger: 0.05
      });
    });
  });

  return (
    <div ref={containerRef}>
      <button onClick={toggleLayout}>Toggle Layout</button>
      <div className={isGrid ? 'grid-layout' : 'flex-layout'}>
        <div className="card">A</div>
        <div className="card">B</div>
      </div>
    </div>
  );
}
```
*   **Gotcha**: Do not animate element margins or borders inside a Flip transition; it causes layout rounding errors. Use `padding` or `gap` rules instead.

---

### Recipe 3: SplitText (Char/Word/Line Staggering)
Separates text blocks to animate them sequentially (*посимвольное/построчное появление*).

```tsx
import { useRef } from 'react';
import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(SplitText);

export function TextStagger() {
  const containerRef = useRef<HTMLHeadingElement>(null);

  useGSAP(() => {
    // Split into characters, words, and lines
    const childSplit = new SplitText('.title', { type: 'lines, words, chars' });
    const parentSplit = new SplitText('.title', { type: 'lines', linesClass: 'line-parent' });

    gsap.from(childSplit.chars, {
      yPercent: 100,
      opacity: 0,
      stagger: 0.02,
      duration: 0.8,
      ease: 'power4.out',
      onComplete: () => {
        // Revert splits to restore clean DOM access (important for responsive sizing)
        childSplit.revert();
        parentSplit.revert();
      }
    });
  }, { scope: containerRef });

  return (
    <div ref={containerRef}>
      <h1 className="title" style={{ overflow: 'hidden' }}>
        Dynamic typography staggers look premium.
      </h1>
    </div>
  );
}
```
*   **Gotcha**: Leaving SplitText modifications active in the DOM breaks search engine indexing (SEO) and blocks copy-paste selections. Revert SplitText targets on animation completion or layout resizing.

---

### Recipe 4: Observer Plugin (Event-Driven Scrolling)
Tracks trackpad, scroll, and swipe intents without shifting layout. Ideal for slide-decks and WebGL interactions.

```tsx
import { useRef } from 'react';
import { gsap } from 'gsap';
import { Observer } from 'gsap/Observer';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(Observer);

export function SwipeDeck() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    let activeIndex = 0;
    const slides = gsap.utils.toArray('.slide');

    Observer.create({
      target: window,
      type: 'wheel,touch,pointer',
      wheelSpeed: 1,
      tolerance: 10,
      preventDefault: true, // Prevents native viewport scrolling
      onUp: () => {
        if (activeIndex > 0) {
          activeIndex--;
          goToSlide(activeIndex);
        }
      },
      onDown: () => {
        if (activeIndex < slides.length - 1) {
          activeIndex++;
          goToSlide(activeIndex);
        }
      }
    });

    function goToSlide(index: number) {
      gsap.to(slides, {
        yPercent: -100 * index,
        duration: 0.8,
        ease: 'power3.inOut'
      });
    }
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="viewport">
      <div className="slide">Slide A</div>
      <div className="slide">Slide B</div>
    </div>
  );
}
```

---

### Recipe 5: MotionPathPlugin (Complex Curves)
Aligns an elements layout position to complex paths.

```tsx
import { useRef } from 'react';
import { gsap } from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(MotionPathPlugin);

export function PathAnimation() {
  const scopeRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    gsap.to('.rocket', {
      duration: 5,
      repeat: -1,
      ease: 'linear',
      motionPath: {
        path: '#flight-path',
        autoRotate: true,
        align: '#flight-path',
        alignOrigin: [0.5, 0.5] // Centers element over path line
      }
    });
  }, { scope: scopeRef });

  return (
    <div ref={scopeRef}>
      <svg width="600" height="300" viewBox="0 0 600 300">
        <path id="flight-path" d="M 50 150 Q 150 50 300 150 T 550 150" fill="none" stroke="#ccc"/>
      </svg>
      <div className="rocket" style={{ width: '20px', height: '20px', background: 'red', position: 'absolute' }}>🚀</div>
    </div>
  );
}
```

---

### Recipe 6: MorphSVG & DrawSVG (Vector Line Work)
Transforms and traces vectors.

```tsx
import { useRef } from 'react';
import { gsap } from 'gsap';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(MorphSVGPlugin, DrawSVGPlugin);

export function VectorShowcase() {
  const scopeRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    // 1. Draw SVG stroke line progress
    gsap.fromTo('#outline', 
      { drawSVG: '0%' },
      { drawSVG: '100%', duration: 1.5, ease: 'power2.inOut' }
    );

    // 2. Morph vector shape to another path
    gsap.to('#circle-shape', {
      morphSVG: '#star-shape',
      duration: 1.5,
      delay: 1,
      ease: 'power3.out'
    });
  }, { scope: scopeRef });

  return (
    <div ref={scopeRef}>
      <svg width="400" height="400" viewBox="0 0 100 100">
        <circle id="outline" cx="50" cy="50" r="40" fill="none" stroke="black" strokeWidth="2"/>
        <path id="circle-shape" d="M50,10 A40,40 0 1,1 49.9,10 Z" fill="blue"/>
        <path id="star-shape" d="M50,15 L60,40 L85,40 L65,55 L75,80 L50,65 L25,80 L35,55 L15,40 L40,40 Z" style={{ display: 'none' }}/>
      </svg>
    </div>
  );
}
```

---

### Recipe 7: ScrambleText (Decipher/Matrix Effect)
Changes character outputs dynamically for stylized hacker/security interfaces.

```tsx
import { useRef } from 'react';
import { gsap } from 'gsap';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrambleTextPlugin);

export function SecurityHeading() {
  const textRef = useRef<HTMLHeadingElement>(null);

  useGSAP(() => {
    gsap.to(textRef.current, {
      duration: 2,
      scrambleText: {
        text: 'ACCESS SYSTEM GRANTED',
        chars: '01ABCDEF*@#!',
        revealDelay: 0.5,
        speed: 0.3
      }
    });
  }, []);

  return <h2 ref={textRef}>INITIALIZING CONNECTION...</h2>;
}
```

---

## 4. Next.js & Astro SSR Integration Gotchas

### Gotcha A: SSR Target Execution Failures
GSAP tries to run calculations immediately upon module parsing, throwing errors like `ReferenceError: window is not defined` on Node.js engines.

*   **Next.js Fix**: Mark your animation-heavy interactive files with the `"use client"` directive.
*   **Astro Fix**: Defer loading using the `client:only` hydration flag:
    ```html
    <SwipeDeck client:only="react" />
    ```

### Gotcha B: Render Flash Layout Shifts (FOUC)
In React, `useEffect` triggers after the browser repaints the layout, causing a Flash of Unstyled Content (FOUC) where elements render fully visible before GSAP snaps them to their initialization coords (e.g. `opacity: 0`).

*   **Correction**: Utilize the layout phase by overriding `useGSAP` internals to use `useLayoutEffect`. Set `useLayoutEffect: true` in the hook parameters:
    ```typescript
    useGSAP(() => {
      gsap.from('.box', { opacity: 0 });
    }, { useLayoutEffect: true });
    ```
