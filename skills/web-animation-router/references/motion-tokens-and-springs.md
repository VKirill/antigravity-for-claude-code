# Motion Token & Spring Systems (May 2026 Spec)

This document establishes the architecture, mathematical models, and industry-standard reference tokens for motion design system engineering in the `web-animation-router` skill.

---

## 1. Production-Grade CSS Tokens (`tokens.css`)

Here is a drop-in CSS file representing a unified duration scale, bezier timing functions, and native spring approximations generated using the CSS `linear()` timing function (*функция распределения времени*).

```css
/* tokens.css */
:root {
  /* -------------------------------------------------------------
     1. Duration Scale (Standard non-linear progression)
     ------------------------------------------------------------- */
  --motion-duration-instant: 0ms;
  --motion-duration-xxshort: 50ms;   /* State changes: focus, micro-hover */
  --motion-duration-xshort: 100ms;   /* Pressed states, fast fades */
  --motion-duration-short: 150ms;    /* Tooltips, small dropdown enters */
  --motion-duration-medium: 240ms;   /* Default UI movements, page cards */
  --motion-duration-long: 400ms;     /* Complex modals, sheet transitions */
  --motion-duration-xlong: 600ms;    /* Large-scale panel slides */
  --motion-duration-xxlong: 800ms;   /* Expressive staging / WebGL reveals */

  /* -------------------------------------------------------------
     2. Bezier Easing Curves (Categorized by interactive intent)
     ------------------------------------------------------------- */
  --motion-easing-linear: cubic-bezier(0, 0, 1, 1);
  
  /* Snappy deceleration - best for instant feedback (Vercel/Geist default) */
  --motion-easing-hover: cubic-bezier(0.16, 1, 0.3, 1);
  
  /* Standard Symmetric Move - element morphing or container size updates */
  --motion-easing-standard: cubic-bezier(0.2, 0, 0.38, 0.9);
  
  /* Expressive entrance - elements appearing on-screen (Atlassian Bold Out) */
  --motion-easing-enter: cubic-bezier(0, 0.4, 0, 1);
  
  /* Expressive exit - elements leaving viewport (Polaris Disappear) */
  --motion-easing-exit: cubic-bezier(0.5, 0.1, 1, 1);

  /* -------------------------------------------------------------
     3. Native CSS Spring Timing Tokens via linear()
     Approximate physical kinetics directly in CSS.
     ------------------------------------------------------------- */
  
  /* Snappy Spring: k=230, c=22, m=1 (Fast, underdamped, ~3% overshoot) */
  --motion-spring-snappy: linear(
    0.0000 0.0%, 0.0293 2.5%, 0.1030 5.0%, 0.2031 7.5%, 
    0.3160 10.0%, 0.4314 12.5%, 0.5421 15.0%, 0.6435 17.5%, 
    0.7330 20.0%, 0.8092 22.5%, 0.8722 25.0%, 0.9226 27.5%, 
    0.9615 30.0%, 0.9904 32.5%, 1.0108 35.0%, 1.0243 37.5%, 
    1.0322 40.0%, 1.0359 42.5%, 1.0364 45.0%, 1.0348 47.5%, 
    1.0317 50.0%, 1.0279 52.5%, 1.0237 55.0%, 1.0195 57.5%, 
    1.0156 60.0%, 1.0120 62.5%, 1.0089 65.0%, 1.0062 67.5%, 
    1.0041 70.0%, 1.0024 72.5%, 1.0011 75.0%, 1.0001 77.5%, 
    0.9994 80.0%, 0.9990 82.5%, 0.9988 85.0%, 0.9987 87.5%, 
    0.9987 90.0%, 0.9988 92.5%, 0.9989 95.0%, 0.9990 97.5%, 
    0.9992 100.0%
  );

  /* Gentle Spring: k=120, c=14, m=1 (Fluid, soft settle, ~7% overshoot) */
  --motion-spring-gentle: linear(
    0.0000 0.0%, 0.0308 2.5%, 0.1094 5.0%, 0.2176 7.5%, 
    0.3405 10.0%, 0.4669 12.5%, 0.5883 15.0%, 0.6991 17.5%, 
    0.7958 20.0%, 0.8769 22.5%, 0.9420 25.0%, 0.9919 27.5%, 
    1.0281 30.0%, 1.0522 32.5%, 1.0665 35.0%, 1.0728 37.5%, 
    1.0730 40.0%, 1.0689 42.5%, 1.0620 45.0%, 1.0534 47.5%, 
    1.0442 50.0%, 1.0350 52.5%, 1.0264 55.0%, 1.0187 57.5%, 
    1.0121 60.0%, 1.0067 62.5%, 1.0024 65.0%, 0.9992 67.5%, 
    0.9970 70.0%, 0.9956 72.5%, 0.9948 75.0%, 0.9946 77.5%, 
    0.9947 80.0%, 0.9951 82.5%, 0.9957 85.0%, 0.9964 87.5%, 
    0.9971 90.0%, 0.9977 92.5%, 0.9983 95.0%, 0.9989 97.5%, 
    0.9993 100.0%
  );

  /* Bouncy Spring: k=180, c=12, m=1 (Playful dynamic overshoot, ~20% overshoot) */
  --motion-spring-bouncy: linear(
    0.0000 0.0%, 0.0663 2.5%, 0.2301 5.0%, 0.4424 7.5%, 
    0.6623 10.0%, 0.8602 12.5%, 1.0176 15.0%, 1.1267 17.5%, 
    1.1880 20.0%, 1.2078 22.5%, 1.1958 25.0%, 1.1627 27.5%, 
    1.1190 30.0%, 1.0732 32.5%, 1.0316 35.0%, 0.9982 37.5%, 
    0.9748 40.0%, 0.9615 42.5%, 0.9568 45.0%, 0.9590 47.5%, 
    0.9656 50.0%, 0.9746 52.5%, 0.9842 55.0%, 0.9929 57.5%, 
    1.0000 60.0%, 1.0050 62.5%, 1.0079 65.0%, 1.0090 67.5%, 
    1.0086 70.0%, 1.0073 72.5%, 1.0054 75.0%, 1.0034 77.5%, 
    1.0016 80.0%, 1.0001 82.5%, 0.9990 85.0%, 0.9984 87.5%, 
    0.9981 90.0%, 0.9982 92.5%, 0.9985 95.0%, 0.9988 97.5%, 
    0.9993 100.0%
  );

  /* Smooth Spring: k=80, c=18, m=1 (Critically damped transition, 0% overshoot) */
  --motion-spring-smooth: linear(
    0.0000 0.0%, 0.0244 2.5%, 0.0836 5.0%, 0.1616 7.5%, 
    0.2477 10.0%, 0.3350 12.5%, 0.4189 15.0%, 0.4971 17.5%, 
    0.5681 20.0%, 0.6315 22.5%, 0.6874 25.0%, 0.7360 27.5%, 
    0.7780 30.0%, 0.8140 32.5%, 0.8446 35.0%, 0.8706 37.5%, 
    0.8925 40.0%, 0.9109 42.5%, 0.9262 45.0%, 0.9391 47.5%, 
    0.9498 50.0%, 0.9587 52.5%, 0.9660 55.0%, 0.9721 57.5%, 
    0.9771 60.0%, 0.9812 62.5%, 0.9846 65.0%, 0.9874 67.5%, 
    0.9897 70.0%, 0.9916 72.5%, 0.9932 75.0%, 0.9944 77.5%, 
    0.9955 80.0%, 0.9963 82.5%, 0.9970 85.0%, 0.9976 87.5%, 
    0.9980 90.0%, 0.9984 92.5%, 0.9987 95.0%, 0.9989 97.5%, 
    0.9991 100.0%
  );

  /* Tight Spring: k=350, c=37, m=1 (High frequency, rapid settle, 0% overshoot) */
  --motion-spring-tight: linear(
    0.0000 0.0%, 0.0230 2.5%, 0.0794 5.0%, 0.1545 7.5%, 
    0.2382 10.0%, 0.3238 12.5%, 0.4069 15.0%, 0.4848 17.5%, 
    0.5562 20.0%, 0.6204 22.5%, 0.6772 25.0%, 0.7270 27.5%, 
    0.7702 30.0%, 0.8073 32.5%, 0.8391 35.0%, 0.8661 37.5%, 
    0.8889 40.0%, 0.9080 42.5%, 0.9241 45.0%, 0.9375 47.5%, 
    0.9487 50.0%, 0.9580 52.5%, 0.9656 55.0%, 0.9719 57.5%, 
    0.9771 60.0%, 0.9814 62.5%, 0.9849 65.0%, 0.9877 67.5%, 
    0.9901 70.0%, 0.9920 72.5%, 0.9935 75.0%, 0.9948 77.5%, 
    0.9958 80.0%, 0.9966 82.5%, 0.9973 85.0%, 0.9978 87.5%, 
    0.9983 90.0%, 0.9986 92.5%, 0.9989 95.0%, 0.9991 97.5%, 
    0.9993 100.0%
  );

  /* Elastic Spring: k=150, c=6, m=1 (Loose bounce, persistent oscillation, ~45% overshoot) */
  --motion-spring-elastic: linear(
    0.0000 0.0%, 0.1997 2.5%, 0.6454 5.0%, 1.0990 7.5%, 
    1.3867 10.0%, 1.4466 12.5%, 1.3208 15.0%, 1.1093 17.5%, 
    0.9163 20.0%, 0.8097 22.5%, 0.8052 25.0%, 0.8756 27.5%, 
    0.9732 30.0%, 1.0532 32.5%, 1.0905 35.0%, 1.0830 37.5%, 
    1.0462 40.0%, 1.0024 42.5%, 0.9701 45.0%, 0.9582 47.5%, 
    0.9655 50.0%, 0.9838 52.5%, 1.0030 55.0%, 1.0156 57.5%, 
    1.0188 60.0%, 1.0139 62.5%, 1.0052 65.0%, 0.9970 67.5%, 
    0.9922 70.0%, 0.9918 72.5%, 0.9945 75.0%, 0.9986 77.5%, 
    1.0020 80.0%, 1.0037 82.5%, 1.0035 85.0%, 1.0021 87.5%, 
    1.0002 90.0%, 0.9988 92.5%, 0.9983 95.0%, 0.9985 97.5%, 
    0.9993 100.0%
  );
}
```

---

## 2. Spring Physics to `linear()` Converter (TypeScript)

This TypeScript class analytically solves the physical second-order differential equation of a mass-spring-damper system (*система масса-пружина-демпфер*) and generates CSS-native `linear()` timing curves.

```typescript
export interface SpringParams {
  stiffness: number; // k
  damping: number;   // c
  mass: number;      // m
}

export class SpringTimingGenerator {
  /**
   * Generates a CSS linear() string based on physics properties.
   * Resolves underdamped, critically damped, and overdamped systems.
   */
  public static generateCSSLinear(
    params: SpringParams,
    pointsCount: number = 40,
    decimalPrecision: number = 4
  ): string {
    const { stiffness: k, damping: c, mass: m } = params;

    if (m <= 0 || k <= 0 || c < 0) {
      throw new Error("Invalid spring physics values. Mass/stiffness must be positive.");
    }

    const w0 = Math.sqrt(k / m); // Natural frequency
    const zeta = c / (2 * Math.sqrt(k * m)); // Damping ratio

    // Analytical solution representing displacement progress from 0.0 to 1.0
    const solveDisplacement = (t: number): number => {
      if (zeta < 1) {
        // 1. Underdamped (с недостаточным затуханием)
        const wd = w0 * Math.sqrt(1 - zeta * zeta); // Damped frequency
        const envelope = Math.exp(-zeta * w0 * t);
        return 1 - envelope * (Math.cos(wd * t) + (zeta * w0 / wd) * Math.sin(wd * t));
      } else if (zeta === 1) {
        // 2. Critically Damped (критическое затухание)
        return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
      } else {
        // 3. Overdamped (с избыточным затуханием)
        const w_star = w0 * Math.sqrt(zeta * zeta - 1);
        const envelope = Math.exp(-zeta * w0 * t);
        return 1 - envelope * (Math.cosh(w_star * t) + (zeta * w0 / w_star) * Math.sinh(w_star * t));
      }
    };

    // Calculate Settling Time (t where envelope/error remains ≤ 0.001)
    let settlingTime = 0.1;
    const maxSearchDuration = 4.0;
    const searchStep = 0.005;

    for (let t = maxSearchDuration; t >= 0; t -= searchStep) {
      if (Math.abs(solveDisplacement(t) - 1.0) > 0.001) {
        settlingTime = t + 0.02; // Safety margin
        break;
      }
    }

    // Sample points evenly along settling duration
    const coordinateSamples: string[] = [];
    for (let i = 0; i <= pointsCount; i++) {
      const completionPercentage = (i / pointsCount) * 100;
      const t = (i / pointsCount) * settlingTime;
      const value = solveDisplacement(t);
      coordinateSamples.push(`${value.toFixed(decimalPrecision)} ${completionPercentage.toFixed(1)}%`);
    }

    return `linear(${coordinateSamples.join(", ")})`;
  }
}
```

---

## 3. Real-World Design System Reference Matrix

Verified values extracted directly from major web design specifications. Unconfirmed details are marked as `[UNVERIFIED]`.

### A. IBM Carbon Design System (v11)

*   **Duration Tokens:**
    *   `$duration-fast-01`: `70ms` (Micro-interactions: buttons, radio checks).
    *   `$duration-fast-02`: `110ms` (Micro-interactions: standard fades).
    *   `$duration-moderate-01`: `150ms` (Short-distance structural moves).
    *   `$duration-moderate-02`: `240ms` (Expansions, modal triggers).
    *   `$duration-slow-01`: `400ms` (Important system communication, notifications).
    *   `$duration-slow-02`: `700ms` (Large surface updates).
*   **Easing Curves (`cubic-bezier`):**
    *   *Productive Standard:* `cubic-bezier(0.2, 0, 0.38, 0.9)`
    *   *Productive Entrance:* `cubic-bezier(0, 0, 0.38, 0.9)`
    *   *Productive Exit:* `cubic-bezier(0.2, 0, 1, 0.9)`
    *   *Expressive Standard:* `cubic-bezier(0.4, 0.14, 0.3, 1)`
    *   *Expressive Entrance:* `cubic-bezier(0, 0, 0.3, 1)`
    *   *Expressive Exit:* `cubic-bezier(0.4, 0.14, 1, 1)`

### B. Atlassian Design System (ADS)

*   **Duration Tokens:**
    *   `motion.duration.xxshort`: `50ms` (Foci, element hovers).
    *   `motion.duration.xshort`: `100ms` (Subtle pressed feedback, quick exits).
    *   `motion.duration.short`: `200ms` (Average exits, micro-expansions).
    *   `motion.duration.medium`: `300ms` (Entrance animations: modals, drawer slides).
    *   `motion.duration.long`: `400ms` (Expansive screen layout shifts).
    *   `motion.duration.xlong`: `600ms` (Staged wizard screens).
*   **Easing Curves (`cubic-bezier`):**
    *   `motion.easing.in.practical`: `cubic-bezier(0.6, 0, 0.8, 0.6)` (Exits/dismissals).
    *   `motion.easing.out.bold`: `cubic-bezier(0, 0.4, 0, 1)` (Entrances: flags, dialogs).
    *   `motion.easing.out.practical`: `cubic-bezier(0.15, 1, 0.3, 1)` `[UNVERIFIED]` (Standard movement).

### C. Material Design 3 (M3)

*   **Legacy Easing Curves (Tween Model):**
    *   *Emphasized (Default):* `cubic-bezier(0.2, 0, 0, 1)` (200ms - 500ms duration range).
    *   *Standard:* `cubic-bezier(0.2, 0, 0, 1)`
*   **Expressive Spring Schemes (Physics-First Model):**
    *   `md.sys.motion.spring.fast.spatial` (Movement/Overshoot): Stiffness `300`, Damping `15`, Mass `1` `[UNVERIFIED]`.
    *   `md.sys.motion.spring.fast.effects` (Color/Opacity): Stiffness `300`, Damping `20` (Critical damping) `[UNVERIFIED]`.
    *   `md.sys.motion.spring.default.spatial`: Stiffness `180`, Damping `12`, Mass `1` `[UNVERIFIED]`.
    *   `md.sys.motion.spring.default.effects`: Stiffness `180`, Damping `18` `[UNVERIFIED]`.

### D. GitHub Primer

*   **Duration Tokens:**
    *   `motion.duration.micro`: `80ms` `[UNVERIFIED]` (Input state triggers).
    *   `motion.duration.short`: `160ms` `[UNVERIFIED]`.
    *   `motion.duration.medium`: `320ms` `[UNVERIFIED]`.
    *   `motion.duration.long`: `480ms` `[UNVERIFIED]`.
*   **Easing Curves:**
    *   `motion.easing.enter`: `cubic-bezier(0, 0, 0.2, 1)` (Decelerates toward end).
    *   `motion.easing.exit`: `cubic-bezier(0.4, 0, 1, 1)` (Accelerates off-screen).
    *   `motion.easing.move`: `cubic-bezier(0.4, 0, 0.2, 1)` (Ease-in-out symmetry).
    *   `motion.easing.hover`: `cubic-bezier(0.16, 1, 0.3, 1)` `[UNVERIFIED]`.

### E. Shopify Polaris

*   **Duration Tokens:**
    *   `--p-duration-50`: `50ms` (Micro-hover, active state triggers).
    *   `--p-duration-100`: `100ms` (Quick fade triggers).
    *   `--p-duration-150`: `150ms`.
    *   `--p-duration-200`: `200ms` (Default interface card shifts).
    *   `--p-duration-300`: `300ms` (Expansions).
*   **Easing Curves:**
    *   `--p-easing-default`: `cubic-bezier(0.4, 0.22, 0.28, 1)`
    *   `--p-easing-appear`: `cubic-bezier(0, 0, 0.13, 1)`
    *   `--p-easing-disappear`: `cubic-bezier(0.5, 0.1, 1, 1)`

### F. Vercel Geist

*   **Duration Specs:**
    *   *Subtle micro-actions:* `150ms` `[UNVERIFIED]`.
    *   *Standard transitions:* `300ms` `[UNVERIFIED]`.
*   **Easing Specs:**
    *   *Standard Deceleration Curve:* `cubic-bezier(0.16, 1, 0.3, 1)` (iOS-style deceleration behavior).
*   **Spring Configurations (Framer Motion settings):**
    *   Stiffness: `380` `[UNVERIFIED]`.
    *   Damping: `30` `[UNVERIFIED]`.

### G. Linear (Linear.app)

*   **Duration Specs:**
    *   `fast`: `120ms` `[UNVERIFIED]` (Command menu row focus transitions).
    *   `normal`: `240ms` `[UNVERIFIED]` (Task detail sidebar popups).
    *   `slow`: `400ms` `[UNVERIFIED]` (Workflow sheet entry transitions).
*   **Spring Configurations (Targeted UI components):**
    *   *Snappy Popover:* Stiffness `220`, Damping `24` `[UNVERIFIED]`.
    *   *Dynamic Slide-in:* Stiffness `170`, Damping `22` `[UNVERIFIED]`.
    *   *Modal Settle:* Stiffness `120`, Damping `14` `[UNVERIFIED]`.

---

## 4. Recommended Default Product Token Set

For a standard SaaS / E-commerce application in 2026, implement this unified motion configuration mapping directly to interactions.

| Interaction Category | Duration Token | Easing / Spring Token | Engineering Rationale |
| :--- | :--- | :--- | :--- |
| **Buttons / Form Focus / Checkbox States** | `50ms` (`--motion-duration-xxshort`) | `cubic-bezier(0.16, 1, 0.3, 1)` (`--motion-easing-hover`) | Provides immediate confirmation feedback. Anything above 100ms feels laggy on direct mouse interaction. |
| **Tooltips / Popovers** | `100ms` (`--motion-duration-xshort`) | `cubic-bezier(0, 0.4, 0, 1)` (`--motion-easing-enter`) | Snappy entrance path. Exits should utilize a faster `50ms` duration and `--motion-easing-exit` for instant clearance. |
| **Dropdown Menus / Select Boxes** | `150ms` (`--motion-duration-short`) | `--motion-spring-tight` | Critically damped spring simulation prevents visual bounce while looking extremely high-performance. |
| **Sidebar Drawer Slide-ins** | `400ms` (`--motion-duration-long`) | `--motion-spring-snappy` | The snappy spring creates a minor overshoot on final placement, adding a playful physical slide. |
| **Modal Sheets / Full Dialogs** | *Computed* | `--motion-spring-gentle` | A soft bounce mimics natural sheets setting on top of overlay backgrounds. |
| **Accordions / Height Transitions** | `240ms` (`--motion-duration-medium`) | `--motion-spring-smooth` | Resolves dynamically without layout oscillation, keeping text content readable during scaling. |
| **Loading Spinners / Progress Loops** | `1200ms` | `--motion-easing-linear` | Constant rate rotation prevents micro-stutters in GPU frame delivery. |
