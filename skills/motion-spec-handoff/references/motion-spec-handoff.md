# Design-to-Development Motion Handoff & Specifications (2026)

This specification establishes the standards for detailing, hand-off, programmatic translation, and automated verification of user interface animations and scroll-based motion.

---

## 1. Concrete Motion Specification Format (`motion-spec.yaml`)

Below is the production-grade YAML format defining motion components on a landing page, including page entry, dynamic cards, and scroll scrubbing.

```yaml
# motion-spec.yaml
# Specification schema target: v2.4.0 (Released Q3 2025)
version: "2026.1.0"
page: "Landing Page V1"
performance_target:
  target_fps: 60
  max_frame_drops_allowed: 2

specifications:
  - id: "hero-text-reveal"
    selector: ".hero h1 .word"
    trigger: "DOMContentLoaded"
    type: "transition"
    properties:
      opacity:
        from: 0.0
        to: 1.0
      transform:
        from: "translate3d(0, 80px, 0) rotate(4deg)"
        to: "translate3d(0, 0px, 0) rotate(0deg)"
    motion:
      duration_ms: 1200
      easing: "cubic-bezier(0.16, 1, 0.3, 1)" # easeOutExpo
      stagger:
        each_ms: 60
        direction: "forward"

  - id: "feature-card-entry"
    selector: ".feature-grid .card"
    trigger: "scroll-viewport"
    trigger_offset: "top 80%" # Starts when top of card is at 80% viewport height
    type: "spring"
    properties:
      opacity:
        from: 0.0
        to: 1.0
      transform:
        from: "translate3d(0, 50px, 0) scale(0.95)"
        to: "translate3d(0, 0, 0) scale(1.0)"
    motion:
      spring:
        stiffness: 180 # spring elastic limit
        damping: 15    # bounce friction
        mass: 0.9      # inertia weight
      stagger:
        each_ms: 100
        direction: "forward"

  - id: "image-scrub-sticky"
    selector: ".sticky-showcase .device-mockup"
    trigger: "scroll-bind"
    type: "scrub"
    scroll_bounds:
      start: "top top" # Start scrubbing when container reaches top of viewport
      end: "bottom bottom" # End scrubbing when container bottom leaves viewport
      pin_container: ".sticky-showcase"
      scrub_inertia: 0.8 # Sync momentum value
    properties:
      transform:
        from: "rotate3d(0, 1, 0, -45deg) translate3d(50px, 0, 0) scale(0.8)"
        to: "rotate3d(0, 1, 0, 0deg) translate3d(0, 0, 0) scale(1.0)"
      clipPath:
        from: "inset(10% 10% 10% 10% round 20px)"
        to: "inset(0% 0% 0% 0% round 0px)"
```

---

## 2. Rive State-Machine Handoff vs. Lottie/Code

Rive [https://rive.app](https://rive.app) has superseded Lottie and manual Canvas rendering for interactive interfaces in 2026.

### Architectural Tradeoffs

| Criterion | Rive (`.riv`) | Lottie (`.json` / `.lottie`) | Manual Code (GSAP / WebGL) |
| :--- | :--- | :--- | :--- |
| **Asset Size** | Tiny (~10-50KB binary vectors) | Medium (100KB+ nested JSON structures) | Large (Requires engine scripts, e.g. three.js) |
| **Logic Location** | Internal Visual State Machine | Application JS code | Application JS code / Shaders |
| **Interactive Latency** | Instant (GPU-accelerated runtime) | Slow (CPU-bound DOM/SVG layout recalculations) | Instant (Highly performant if optimized) |
| **Skeletal Rigging** | Native bones, IK, mesh deformations | `[stale]` Unavailable or computationally slow | Complex manual matrix calculations |

### When Rive Wins
1. **Interactive Inputs**: When graphics must respond to mouse coordinate drift (e.g., character eyes following cursor, 3D hover tilt).
2. **State Transitions**: When an element transitions dynamically between multiple states (e.g., `Idle` -> `Hover` -> `Click` -> `Loading` -> `Success`) depending on live application parameters.
3. **Responsive Assets**: Single files containing layout logic that adjusts to arbitrary element aspect ratios without scaling distortions.

### How to Hand Off Rive Assets
* **Deliverable**: Binary `.riv` asset containing configured State Machines.
* **Input Config**: Define exact input keys inside the Rive file (e.g., `isHovered` (boolean), `scrollPercent` (number, 0-100), `triggerClick` (trigger)).
* **Implementation Code**:
```bash
npm install @rive-app/canvas
```
```javascript
import { Rive, Layout, Fit, Alignment } from '@rive-app/canvas';

const r = new Rive({
  src: '/assets/ui-interactive.riv',
  canvas: document.getElementById('rive-canvas'),
  autoplay: true,
  stateMachines: 'MainStateMachine',
  layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
  onLoad: () => {
    // Access inputs defined inside the Rive file
    const inputs = r.stateMachineInputs('MainStateMachine');
    const hoverInput = inputs.find(i => i.name === 'isHovered');
    
    // Bind UI events to runtime state variables
    document.getElementById('hover-trigger').addEventListener('mouseenter', () => {
      if (hoverInput) hoverInput.value = true;
    });
    document.getElementById('hover-trigger').addEventListener('mouseleave', () => {
      if (hoverInput) hoverInput.value = false;
    });
  }
});
```

---

## 3. Figma to Code: Limitations and Tools

### Figma Smart Animate Limits
Figma's `Smart Animate` is a prototyping tool, not a development spec compiler.
* **Easing Restraints**: Cannot output true physical damping, spring stiffness, or mass values. It relies on approximate ease-in-out curves.
* **Morphing Breakdown**: Complex SVG path interpolations frequently split or glitch during transitions.
* **No Dynamic Scoping**: Cannot bind animation state to asynchronous fetch loops, data changes, or scroll physics.

### 2026 Motion Tools & Plugins

1. **Tokens Studio** ([https://tokens.studio](https://tokens.studio)):
   * **Role**: Syncs design variables (including easing values and durations) to JSON.
   * **Action**: Translates layout/motion constants into programmatic theme structures.
2. **Jitter** ([https://jitter.video](https://jitter.video)):
   * **Role**: Timeline editor for UI components.
   * **Action**: Exports animations directly to JSON, Lottie, or clean CSS/Web Animations code sequences.
3. **Phase** ([https://phase.com](https://phase.com)):
   * **Role**: Interactive motion design interface.
   * **Action**: Imports Figma visual structures and allows designers to construct state graphs, exporting ready-to-run SVG transitions and React motion states.

---

## 4. Agent-to-Agent Machine-Readable Handoff

To automate code generation, an orchestrator (Agent A) writes a strictly formatted JSON directive that a coder subagent (Agent B) parses to generate CSS or JavaScript.

```json
{
  "taskId": "generate-ui-motion",
  "implementationTarget": "tailwind-v4-css",
  "tokens": {
    "easings": {
      "expoOut": "cubic-bezier(0.16, 1, 0.3, 1)"
    }
  },
  "selectors": [
    {
      "element": ".btn-primary",
      "states": {
        "hover": {
          "transitions": [
            {
              "property": "transform",
              "value": "scale(1.05) translateY(-2px)",
              "durationMs": 200,
              "curve": "expoOut"
            },
            {
              "property": "box-shadow",
              "value": "0 10px 20px oklch(0.62 0.22 285 / 0.15)",
              "durationMs": 200,
              "curve": "expoOut"
            }
          ]
        },
        "active": {
          "transitions": [
            {
              "property": "transform",
              "value": "scale(0.98) translateY(0)",
              "durationMs": 80,
              "curve": "expoOut"
            }
          ]
        }
      }
    }
  ]
}
```

By reading this structured JSON, the developer agent outputs the exact Tailwind CSS directives without interpreting design intentions:

```css
/* Output CSS generated by developer subagent */
@theme {
  --ease-expo-out: cubic-bezier(0.16, 1, 0.3, 1);
}

.btn-primary {
  transition: transform 200ms var(--ease-expo-out), box-shadow 200ms var(--ease-expo-out);
  
  &:hover {
    transform: scale(1.05) translateY(-2px);
    box-shadow: 0 10px 20px oklch(0.62 0.22 285 / 0.15);
  }

  &:active {
    transition: transform 80ms var(--ease-expo-out);
    transform: scale(0.98) translateY(0);
  }
}
```

---

## 5. Deterministic Motion Verification Script

To verify that the code implements the motion system correctly, use Playwright to query GSAP timelines or CSS animations and validate parameters.

```typescript
// tests/motion-verification.spec.ts
// Run via: npx playwright test
import { test, expect } from '@playwright/test';

test.describe('Motion Spec Compliance Verification', () => {
  
  test('Verify Hero Text Reveal matches Motion Spec parameters', async ({ page }) => {
    // 1. Load local build server
    await page.goto('http://localhost:3000');
    
    // 2. Query structural GSAP animation state from the global window namespace
    // (Ensure your build exposes animation timelines globally in DEV environment)
    const animConfig = await page.evaluate(() => {
      const gsapGlobal = (window as any).gsap;
      if (!gsapGlobal) return null;
      
      const timeline = gsapGlobal.exportRoot().getChildren().find((tween: any) => 
        tween.vars.id === 'hero-text-reveal'
      );
      
      if (!timeline) return null;
      
      return {
        duration: timeline.duration(),
        delay: timeline.delay(),
        ease: timeline.vars.ease?.toString() || null,
        stagger: timeline.vars.stagger ? true : false
      };
    });

    expect(animConfig).not.toBeNull();
    // Validate duration matches 1.2s specification
    expect(animConfig!.duration).toBeCloseTo(1.2, 1);
    // Validate correct easing path is applied (easeOutExpo corresponds to power4.out in GSAP)
    expect(animConfig!.ease).toContain('power4.out');
  });

  test('Verify smooth scroll syncing container binding', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Check if unified Lenis smooth-scroll instance is initialized
    const isLenisInitialized = await page.evaluate(() => {
      const lenisInstance = (window as any).lenis;
      return !!lenisInstance && typeof lenisInstance.scrollTo === 'function';
    });
    
    expect(isLenisInitialized).toBe(true);
  });

  test('Deterministic frame-by-frame layout visual checks', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Pause all CSS animations and GSAP timelines to evaluate state snapshots
    await page.evaluate(() => {
      const gsapGlobal = (window as any).gsap;
      if (gsapGlobal) gsapGlobal.globalTimeline.pause();
      document.body.classList.add('animations-paused');
    });

    // Capture starting state (zero progress frame)
    const initialScreenshot = await page.locator('.hero h1').screenshot();
    
    // Advance animations to 50% state
    await page.evaluate(() => {
      const gsapGlobal = (window as any).gsap;
      if (gsapGlobal) {
        const tween = gsapGlobal.exportRoot().getChildren().find((t: any) => t.vars.id === 'hero-text-reveal');
        if (tween) tween.progress(0.5);
      }
    });

    const midProgressScreenshot = await page.locator('.hero h1').screenshot();
    
    // Assert visual shifts occurred without layout breakage
    expect(initialScreenshot.compare(midProgressScreenshot)).not.toBe(0);
  });
});
```
