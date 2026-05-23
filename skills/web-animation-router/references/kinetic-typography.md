# Kinetic Typography & Variable Fonts in Motion (2026)

This guide establishes the production standards for animating typography in 2026. It focuses on hardware-accelerated variable font axis manipulation, SVG text-path distortion, performant marquees, scroll-velocity syncing, and accessibility-first implementations.

For transition curves, scroll physics, and layout animations, cross-reference:
*   [motion-tokens-and-springs.md](motion-tokens-and-springs.md) (Spring formula generators & eases)
*   [scroll_driven_animations_2026.md](scroll_driven_animations_2026.md) (Lenis setups & CSS scroll timelines)
*   [gsap-315-plugin-recipes.md](gsap-315-plugin-recipes.md) (GSAP staggers and MorphSVG integration)

---

## 1. Scroll-Velocity Font Axis Mapping

By binding the browser's scroll velocity to variable font axes, you create responsive letterforms that dynamically stretch, bold, or tilt in response to user scroll speed.

### CSS `@property` Registration
Registering CSS custom variables enables the browser to interpolate font variation settings smoothly on the GPU without CPU-side style recalculation bottlenecks.

```css
@property --font-wght {
  syntax: '<number>';
  inherits: true;
  initial-value: 400;
}

@property --font-wdth {
  syntax: '<number>';
  inherits: true;
  initial-value: 100;
}

.velocity-text {
  font-family: 'Mona Sans', system-ui;
  font-variation-settings: 'wght' var(--font-wght), 'wdth' var(--font-wdth);
  /* Fallback transition for non-JS updates */
  transition: 
    --font-wght 180ms cubic-bezier(0.16, 1, 0.3, 1),
    --font-wdth 180ms cubic-bezier(0.16, 1, 0.3, 1);
}
```

### Lenis Velocity JavaScript Bridge
This script captures the scroll velocity from Lenis and maps it to target weight and width boundaries.

```javascript
import Lenis from 'lenis';
import gsap from 'gsap';

// Initialize Lenis (Refer to scroll_driven_animations_2026.md for setup)
const lenis = new Lenis();

const targetText = document.querySelector('.velocity-text');

// Mapping parameters
const AXIS_LIMITS = {
  wght: { min: 400, max: 800 },
  wdth: { min: 100, max: 150 }
};
const VELOCITY_MAX = 5.0; // Normalizes input velocity

lenis.on('scroll', (e) => {
  // Get absolute velocity value
  const velocity = Math.abs(e.velocity);
  
  // Normalize velocity (0 to 1)
  const progress = Math.min(velocity / VELOCITY_MAX, 1.0);

  // Linear interpolation of axes
  const targetWght = AXIS_LIMITS.wght.min + (AXIS_LIMITS.wght.max - AXIS_LIMITS.wght.min) * progress;
  const targetWdth = AXIS_LIMITS.wdth.min + (AXIS_LIMITS.wdth.max - AXIS_LIMITS.wdth.min) * progress;

  // Animate the CSS custom properties via GSAP to ensure dampening
  gsap.to(targetText, {
    '--font-wght': targetWght,
    '--font-wdth': targetWdth,
    duration: 0.35,
    ease: 'power2.out',
    overwrite: 'auto'
  });
});

function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);
```

---

## 2. Masked Text Reveals

Masking text ensures that entrance reveals are bounded by specific grid elements, producing clean container-based animations.

### Method A: GPU-Accelerated `clip-path`
`clip-path` utilizes the GPU to clip layout nodes without triggering repaint loops on neighboring layout cards.

```css
.reveal-wrapper {
  overflow: hidden;
}

.reveal-text-clip {
  display: block;
  font-size: clamp(3rem, 6vw, 8rem);
  line-height: 1.1;
  /* Animate clip boundaries directly */
  clip-path: inset(100% 0 0 0); /* Closed bottom-up */
  transform: translateY(30px);
  transition: 
    clip-path 800ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 800ms cubic-bezier(0.16, 1, 0.3, 1);
}

.reveal-text-clip.is-active {
  clip-path: inset(0% 0 0 0); /* Open */
  transform: translateY(0);
}
```

### Method B: Vercel-Style Gradient Text Mask
Reveals text color progressively via a sliding background gradient mask.

```css
.reveal-text-gradient {
  font-size: clamp(2rem, 5vw, 6rem);
  font-weight: 800;
  color: rgba(255, 255, 255, 0.15); /* Underlay text opacity */
  background: linear-gradient(
    90deg, 
    #ffffff 0%, 
    #ffffff 50%, 
    rgba(255, 255, 255, 0.15) 50%, 
    rgba(255, 255, 255, 0.15) 100%
  );
  background-size: 200% 100%;
  background-position: 100% 0;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  transition: background-position 1.2s cubic-bezier(0.25, 1, 0.5, 1);
}

.reveal-text-gradient.is-active {
  background-position: 0% 0;
}
```

---

## 3. Character & Word Staggers

To prevent screen readers from reading split texts character-by-character, always supply a raw semantic header with `aria-label` and mark the animated split containers as `aria-hidden`.

### Split Text JS Utility (Svelte/React Compatible)
Avoids SplitText library dependency friction by returning screen-reader-compliant DOM structures.

```javascript
/**
 * Splits text into wrapper span nodes for stagger reveals.
 * Preserves accessiblity using aria tags.
 * 
 * @param {HTMLElement} element - Target container
 */
export function splitTextHelper(element) {
  const originalText = element.textContent.trim();
  element.setAttribute('aria-label', originalText);
  element.textContent = ''; // Clear raw content

  const wrapper = document.createElement('span');
  wrapper.setAttribute('aria-hidden', 'true');
  wrapper.className = 'split-line-wrapper';

  const words = originalText.split(' ');
  let charGlobalIndex = 0;

  words.forEach((word, wordIndex) => {
    const wordSpan = document.createElement('span');
    wordSpan.className = 'split-word';
    wordSpan.style.display = 'inline-block';
    wordSpan.style.whiteSpace = 'nowrap';

    const chars = Array.from(word);
    chars.forEach((char) => {
      const charSpan = document.createElement('span');
      charSpan.className = 'split-char';
      charSpan.textContent = char;
      charSpan.style.display = 'inline-block';
      // Set stagger custom variable delay
      charSpan.style.setProperty('--char-idx', charGlobalIndex.toString());
      wordSpan.appendChild(charSpan);
      charGlobalIndex++;
    });

    wrapper.appendChild(wordSpan);

    // Append space after word unless it's the last word
    if (wordIndex < words.length - 1) {
      const space = document.createTextNode(' ');
      wrapper.appendChild(space);
    }
  });

  element.appendChild(wrapper);
}
```

### Pure CSS Animations Staggers
Using CSS variables to calculate transition delay ensures the browser orchestrates stagger timings natively.

```css
.split-char {
  opacity: 0;
  transform: translateY(30px) rotate(10deg);
  transform-origin: bottom left;
  /* Use spring values from motion-tokens-and-springs.md */
  transition: 
    opacity 600ms cubic-bezier(0.34, 1.56, 0.64, 1),
    transform 600ms cubic-bezier(0.34, 1.56, 0.64, 1);
  /* Calculate delay based on custom property */
  transition-delay: calc(var(--char-idx) * 25ms);
}

.is-revealed .split-char {
  opacity: 1;
  transform: translateY(0) rotate(0deg);
}
```

---

## 4. SVG Text-on-Path Deformation

Deforming layout text along an SVG path allows you to create dynamic elastic layouts. Animating the `startOffset` slides the characters along the path.

```html
<svg viewBox="0 0 1000 300" class="text-path-svg">
  <defs>
    <!-- Curve path definition -->
    <path id="curve" d="M 50,150 Q 500,150 950,150" fill="transparent" />
  </defs>
  
  <text fill="#ffffff" font-size="42" font-weight="800">
    <!-- Reference the path and control placement -->
    <textPath href="#curve" startOffset="0%" id="animated-text-path">
      KINETIC MOTION ENGINE 2026 KINETIC MOTION ENGINE 2026
    </textPath>
  </text>
</svg>
```

### Curve Bending and Offsetting Script
This script moves the text path position and bends the control point coordinates on window scroll events.

```javascript
import gsap from 'gsap';

const textPath = document.getElementById('animated-text-path');
const curvePath = document.getElementById('curve');

// Starting coordinate positions
const defaultPath = "M 50,150 Q 500,150 950,150";

window.addEventListener('scroll', () => {
  const scrollY = window.scrollY;
  
  // 1. Move text along path using startOffset
  gsap.to(textPath, {
    attr: { startOffset: `${scrollY * 0.15}%` },
    duration: 0.2,
    ease: 'power1.out',
    overwrite: 'auto'
  });

  // 2. Dynamic curve deformation (warp depth based on scroll)
  const warpDepth = 150 + Math.sin(scrollY * 0.01) * 80;
  const deformedPath = `M 50,150 Q 500,${warpDepth} 950,150`;

  gsap.to(curvePath, {
    attr: { d: deformedPath },
    duration: 0.4,
    ease: 'power2.out',
    overwrite: 'auto'
  });
});
```

---

## 5. Performant Seamless Marquee / Ticker

Marquees must run entirely on the GPU (`transform: translate3d`) and maintain semantic structure without confusing screen readers.

```html
<!-- Accessible Wrapper -->
<div class="marquee" aria-label="Our partners ticker animation" role="region">
  <!-- Interactive wrapper pauses animation on hover/focus -->
  <div class="marquee-track" tabindex="0">
    <!-- Main visible track block -->
    <div class="marquee-content" aria-hidden="false">
      <span>CREATIVE TECHNOLOGY</span>
      <span>•</span>
      <span>AWARDS CHAMPION</span>
      <span>•</span>
      <span>GPU PIPELINES</span>
      <span>•</span>
    </div>
    
    <!-- Buffer copy to ensure seamless loop (marked hidden for a11y) -->
    <div class="marquee-content" aria-hidden="true">
      <span>CREATIVE TECHNOLOGY</span>
      <span>•</span>
      <span>AWARDS CHAMPION</span>
      <span>•</span>
      <span>GPU PIPELINES</span>
      <span>•</span>
    </div>
  </div>
</div>
```

```css
.marquee {
  width: 100%;
  overflow: hidden;
  position: relative;
  white-space: nowrap;
  background: #000;
  padding: 1.5rem 0;
}

.marquee-track {
  display: flex;
  width: max-content;
  outline: none;
}

.marquee-content {
  display: flex;
  gap: 2rem;
  padding-right: 2rem;
  font-size: 4rem;
  font-weight: 900;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  /* Call hardware acceleration */
  will-change: transform;
  animation: marquee-scroll 25s linear infinite;
}

/* Pause interactive marquee on user states */
.marquee-track:hover .marquee-content,
.marquee-track:focus-within .marquee-content {
  animation-play-state: paused;
}

@keyframes marquee-scroll {
  from {
    transform: translate3d(0, 0, 0);
  }
  to {
    /* Precise shift matching the duplicate element bounds */
    transform: translate3d(-100%, 0, 0);
  }
}

/* Disable or scale animation for users requesting reduced motion */
@media (prefers-reduced-motion: reduce) {
  .marquee-content {
    animation-duration: 90s; /* Subdued drift */
  }
  .marquee-track:hover .marquee-content {
    animation-play-state: running; /* Prevent jarring stops */
  }
}
```

---

## 6. Variable-Font Proximity Interactions

Using pointer position variables to dynamically morph typographic characters as the mouse pointer approaches them.

```javascript
import gsap from 'gsap';

const hoverText = document.querySelector('.proximity-text');

// Split text into characters using the helper from Section 3
splitTextHelper(hoverText);

const characters = hoverText.querySelectorAll('.split-char');

document.addEventListener('mousemove', (e) => {
  const mouseX = e.clientX;
  const mouseY = e.clientY;

  characters.forEach((char) => {
    const rect = char.getBoundingClientRect();
    const charX = rect.left + rect.width / 2;
    const charY = rect.top + rect.height / 2;

    // Calculate distance formula
    const distance = Math.hypot(mouseX - charX, mouseY - charY);
    const triggerRadius = 250; // Distance trigger bound (px)

    if (distance < triggerRadius) {
      // Map distance ratio to axis variation range
      const ratio = 1 - distance / triggerRadius; // 0 (far) to 1 (close)
      
      const targetWght = 400 + (900 - 400) * ratio;
      const targetSlnt = 0 + (-12 - 0) * ratio;

      gsap.to(char, {
        fontVariationSettings: `"wght" ${targetWght}, "slnt" ${targetSlnt}`,
        y: -15 * ratio,
        duration: 0.45,
        ease: 'power3.out',
        overwrite: 'auto'
      });
    } else {
      // Return to baseline weights
      gsap.to(char, {
        fontVariationSettings: `"wght" 400, "slnt" 0`,
        y: 0,
        duration: 0.6,
        ease: 'power2.out',
        overwrite: 'auto'
      });
    }
  });
});
```

---

## 7. Fluid Scale Calculation in Motion Systems

Fluid type scales using CSS `clamp()` ensure your typographic layouts remain structurally aligned across device screen dimensions. This prevents text wrapping shifts during entrance animations.

```css
:root {
  /* 
    Fluid Scale Calculation:
    Min Size: 32px (on mobile 320px screen width)
    Max Size: 80px (on desktop 1440px width)
    Slope: 4.28vw + 18.3px
  */
  --fluid-h1: clamp(2rem, 4.28vw + 1.15rem, 5rem);
}

.fluid-title {
  font-size: var(--fluid-h1);
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.02em;
  /* Lock line container heights during layout scale transitions */
  min-height: 1.1em; 
}
```

---

## 8. Best 2026 Variable Display Fonts

| Font Name | Source | Creator | Core Variable Axes | Recommended Use Cases |
| :--- | :--- | :--- | :--- | :--- |
| **Roboto Flex** | Free / Google Fonts | Google | `wght` (100–1000), `wdth` (25–151), `slnt` (-10–0), `opsz` (8–144), Parametric Axes (`XTRA`, `YOPQ`) | Heavy dashboard layouts & responsive hero headings. |
| **Mona Sans** | Free / Open Source | GitHub / Degarism | `wght` (200–900), `wdth` (75–125), `slnt` (-10–0) | UI interfaces, bold product statements. |
| **Hubot Sans** | Free / Open Source | GitHub / Degarism | `wght` (200–900), `wdth` (75–125), `slnt` (-10–0), `ital` (0–1) | Creative headlines, technological styles. |
| **Syne** | Free / Google Fonts | Bonjour Monde | `wght` (400–800) | Editorial headlines, artistic branding. |
| **GT Flexa** | Premium | Grilli Type | `wght` (100–1000), `wdth` (50–150), `ital` (0–1) | High-end product sites, editorial design. |
| **Helvetica Now Variable** | Premium | Monotype | `wght` (100–950), `wdth` (50–150), `opsz` (6–72) | Neutral Swiss layout, system-level displays. |
| **PP Monument Extended** | Premium | Pangram Pangram | `wght` (100–900), `wdth` (60–160) | Editorial impact, extremely bold hero text. |
| **PP Editorial New** | Premium | Pangram Pangram | `wght` (100–900), `ital` (0–1) | Classic, elegant serif displays. |

---

## 9. Accessibility & Antipatterns

### Accessibility Requirements (a11y)
1.  **Semantic Elements**: Never replace text contents with canvas drawings or images. Always keep elements as `<h1>`–`<h6>` or `<p>` elements.
2.  **Parent Wrapper Tags**: When using split character spans, screen readers read each letter separately. Solve this by applying the raw text to the parent `aria-label` and wrapping the animations in an `aria-hidden="true"` element.
3.  **Contrast Levels**: Verify text foreground and background color ratios do not drop below **4.5:1** (or **3:1** for large texts) during animation steps.
4.  **Prefers-Reduced-Motion**: Always wrap high-speed typography morphs, loops, and rotations in CSS queries or JS checks to prevent motion-induced disorientation:
    ```javascript
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.matches) {
      // Disable custom axis scroll bindings and fall back to static layouts
    }
    ```

### Antipatterns
*   **Antipattern: Reflow Properties**: Animating properties like `font-size`, `margin`, or `letter-spacing` directly. These force the browser layout engine to recalculate layout geometry on every single frame, causing significant layout jank. Use CSS variables modifying `font-variation-settings` or scale `transform` matrices instead.
*   **Antipattern: Character Separation Screen Readout**: Leaving split spans bare in the HTML markup. A screen reader will read the word "MOTION" as "M-O-T-I-O-N".
*   **Antipattern: Unregistered Custom Variables**: Animating unregistered CSS variables. Animating a CSS variable without declaring its `@property` structure prevents the browser from interpolating intermediate values, resulting in sudden state jumps rather than smooth motion curves.
