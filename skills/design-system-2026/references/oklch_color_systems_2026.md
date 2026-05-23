# OKLCH Color Systems (2026 Edition)

Implementing design-system-grade, perceptually uniform color spaces in modern browsers utilizing CSS Color Module Level 4.

---

## 1. Perceptually-Even Ramps (50 - 950)

In traditional sRGB/HSL color systems, adjusting lightness linearly does not result in a perceptually linear ramp because human vision has non-linear sensitivities to different wavelengths (lightness scales like HSL are simple mathematical transformations of non-uniform RGB). 
OKLCH solves this by mapping colors to coordinates that correspond to human visual perception:
*   **L (Lightness)**: $0.0$ (black) to $1.0$ (white).
*   **C (Chroma)**: $0.0$ (gray) to a maximum of $\approx 0.4$ (fully saturated wide-gamut).
*   **H (Hue)**: $0.0$ to $360.0$ (degrees around the color wheel).

### Lightness and Chroma Distribution

For an 11-step ramp ($50$ to $950$), the lightness targets must distribute evenly in perception. The optimal distribution is linear through the mid-tones and compressed at the extremes (Weber-Fechner scaling):

| Scale Step | Lightness ($L$) Target | Primary Chroma ($C$) Target | Warning Chroma ($C$) Target |
| :--- | :--- | :--- | :--- |
| **50** | `0.985` | `0.002` (soft tint) | `0.008` (yellow tint) |
| **100** | `0.960` | `0.008` | `0.021` |
| **200** | `0.890` | `0.034` | `0.058` |
| **300** | `0.800` | `0.076` | `0.111` |
| **400** | `0.700` | `0.125` | `0.140` (shifted) |
| **500** | `0.600` | `0.180` (peak) | `0.128` (shifted) |
| **600** | `0.500` | `0.160` | `0.110` (shifted) |
| **700** | `0.400` | `0.123` | `0.088` (shifted) |
| **800** | `0.300` | `0.082` | `0.060` (shifted) |
| **900** | `0.180` | `0.038` | `0.028` |
| **950** | `0.100` | `0.012` | `0.008` |

### The "Yellow Problem" & Lightness Shifting
Hues do not have symmetrical gamut boundaries in sRGB or P3. Yellow ($H \approx 70-85$) peaks in chroma at $L \approx 0.85$. If forced to $L = 0.60$ (the standard step $500$), yellow becomes a muddy olive/brown. 
*   **Tradeoff**: Strict lightness alignment (all step $500$ colors share $L=0.60$) vs Visual Accuracy.
*   **Ranked Recommendation**: Shift lightness curves upwards by $8-10\%$ for Warning/Yellow scales in the mid-range. This preserves the bright character of yellow, even though contrast must be handled with dark text at step 500.

---

## 2. Gamut Mapping Bisection Algorithm

When generating scales programmatically, setting high chroma values at the extremes will push the color outside the sRGB (or P3) gamut. If a browser encounters an out-of-gamut OKLCH value, it clips it to the boundary in an undefined manner, causing severe hue shifts.

To prevent this, we run a **Constant-Lightness Constant-Hue Chroma Bisection** algorithm in JS (using [culori](https://culorijs.org/) v4.0.2). This scales down chroma until the color fits within sRGB, keeping $L$ and $H$ perfectly intact to preserve contrast and identity.

### Installation
```bash
npm install culori@4.0.2
```

### Programmatic Generator (`generate-palette.js`)
```javascript
import { rgb } from 'culori';

/**
 * Custom constant-LH chroma clamping using bisection.
 * Ensures the color is within sRGB [0, 1] while preserving L and H.
 */
function clampChromaConstantLH(L, targetC, H) {
  let low = 0;
  let high = targetC;
  const maxIterations = 24;
  
  // Fast path: check if the target is already in gamut
  let rgbColor = rgb({ mode: 'oklch', l: L, c: high, h: H });
  if (
    rgbColor.r >= -0.0001 && rgbColor.r <= 1.0001 &&
    rgbColor.g >= -0.0001 && rgbColor.g <= 1.0001 &&
    rgbColor.b >= -0.0001 && rgbColor.b <= 1.0001
  ) {
    return { mode: 'oklch', l: L, c: high, h: H };
  }
  
  // Binary search to find highest in-gamut chroma
  for (let i = 0; i < maxIterations; i++) {
    let mid = (low + high) / 2;
    rgbColor = rgb({ mode: 'oklch', l: L, c: mid, h: H });
    const inGamut = 
      rgbColor.r >= -0.0001 && rgbColor.r <= 1.0001 &&
      rgbColor.g >= -0.0001 && rgbColor.g <= 1.0001 &&
      rgbColor.b >= -0.0001 && rgbColor.b <= 1.0001;
      
    if (inGamut) {
      low = mid;
    } else {
      high = mid;
    }
  }
  
  return { mode: 'oklch', l: L, c: low, h: H };
}
```

---

## 3. APCA and WCAG 2.2 Contrast Verification

### Contrast Targets
*   **WCAG 2.2 AA**: Requires contrast ratio $\ge 4.5:1$ for normal text, $\ge 3.0:1$ for large text.
*   **APCA (Accessible Perceptual Contrast Algorithm)**: Predicts readability based on spatial frequency (font size/weight) and display physics:
    *   **Lc 90**: Preferred contrast for small body text.
    *   **Lc 75**: Minimum contrast for body text.
    *   **Lc 60**: Minimum contrast for large text or bold subheaders.
    *   **Lc 45**: Minimum contrast for large headings or non-text UI controls.

> [!WARNING]
> APCA contrast ($Lc$) is polarity-dependent. Light text on a dark background suffers from visual bleed (halation), requiring higher lightness distance to match the legibility of dark text on light backgrounds.

### CI Verification Code (`verify-contrast.js`)
This script parses the CSS variable output, maps `light-dark()` states, and validates them against targets using [apca-w3](https://apcacontrast.com/) v0.1.9 and [colorparsley](https://github.com/Myndex/colorParsley) v0.1.8.

```bash
npm install apca-w3@0.1.9 colorparsley@0.1.8
```

```javascript
import { calcAPCA } from 'apca-w3';
import { rgb, formatHex } from 'culori';
import * as fs from 'fs';

// Traditional WCAG 2.2 contrast formula
function getLuminance(rgbColor) {
  const a = [rgbColor.r, rgbColor.g, rgbColor.b].map(v => {
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

function getWcagContrast(c1, c2) {
  const l1 = getLuminance(c1);
  const l2 = getLuminance(c2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// CI Test Script
function verifyCSS() {
  const css = fs.readFileSync('tokens.css', 'utf-8');
  
  // Extract OKLCH variables
  const variables = {};
  const colorRegex = /^\s*(--color-[a-z0-9-]+):\s*oklch\(([\d\.]+)\s+([\d\.]+)\s+([\d\.]+)\);/gm;
  let match;
  while ((match = colorRegex.exec(css)) !== null) {
    variables[match[1].trim()] = { mode: 'oklch', l: parseFloat(match[2]), c: parseFloat(match[3]), h: parseFloat(match[4]) };
  }
  
  // Extract Semantic light-dark() maps
  const semanticRegex = /^\s*(--[a-z0-9-]+):\s*light-dark\(var\((--[a-z0-9-]+)\),\s*var\((--[a-z0-9-]+)\)\);/gm;
  const semantics = [];
  while ((match = semanticRegex.exec(css)) !== null) {
    semantics.push({ name: match[1].trim(), lightVar: match[2].trim(), darkVar: match[3].trim() });
  }

  // Contract list
  const checks = [
    { fg: '--text-default', bg: '--bg-default', minWcag: 4.5, minApca: 75 },
    { fg: '--text-muted', bg: '--bg-default', minWcag: 3.0, minApca: 60 }
  ];

  let failed = false;

  ['light', 'dark'].forEach(mode => {
    checks.forEach(check => {
      const semFg = semantics.find(s => s.name === check.fg);
      const semBg = semantics.find(s => s.name === check.bg);
      
      const fgToken = mode === 'light' ? semFg.lightVar : semFg.darkVar;
      const bgToken = mode === 'light' ? semBg.lightVar : semBg.darkVar;
      
      const fgHex = formatHex(rgb(variables[fgToken]));
      const bgHex = formatHex(rgb(variables[bgToken]));
      
      const wcag = getWcagContrast(rgb(variables[fgToken]), rgb(variables[bgToken]));
      const apca = Math.abs(calcAPCA(fgHex, bgHex));

      if (wcag < check.minWcag || apca < check.minApca) {
        console.error(`❌ Contrast check failed for ${check.fg} on ${check.bg} in ${mode} mode.`);
        failed = true;
      }
    });
  });

  if (failed) process.exit(1);
  console.log('✅ Contrast checks passed!');
}
verifyCSS();
```

---

## 4. Gradients Without Grey Dead-Zones

In traditional CSS (Color Level 3), gradients linear-interpolate colors in sRGB. When interpolating between opposing hues (e.g., Blue and Yellow or Teal and Red), the midpoint passes directly through muddy, low-chroma greys.

By specifying the interpolation space in **OKLCH**, the color engine interpolates directly along the perceptual cylinder, keeping the midpoint saturated and vibrant.

```css
/* Stale (interpolates in sRGB, resulting in a muddy grey midpoint) */
.btn-gradient-old {
  background: linear-gradient(to right, oklch(0.6 0.18 255), oklch(0.68 0.14 75));
}

/* Modern (interpolates in OKLCH, keeping midpoints vibrant) */
.btn-gradient-modern {
  background: linear-gradient(in oklch to right, var(--color-primary-500), var(--color-warning-500));
}
```

---

## 5. Modern `light-dark()` Token Integration

The CSS `light-dark()` function (supported since mid-2024 as a CSS baseline feature) allows defining both light and dark values inline on a single variable. This eliminates nesting media queries or declaring overrides in a separate `.dark` class block.

> [!IMPORTANT]
> To use `light-dark()`, the document root **must** declare `color-scheme: light dark;`. Without this, the browser will ignore the function and fallback to light mode.

### Complete `tokens.css`
```css
/**
 * @file tokens.css
 * @description Production-ready OKLCH Design Token System (Baseline 2026)
 */

:root {
  /* Critical: Native color-scheme declaration */
  color-scheme: light dark;

  /* --- PRIMARY RAMP (Blue/Indigo, Hue 255) --- */
  --color-primary-50: oklch(0.985 0.002 255);
  --color-primary-100: oklch(0.96 0.008 255);
  --color-primary-200: oklch(0.89 0.034 255);
  --color-primary-300: oklch(0.80 0.076 255);
  --color-primary-400: oklch(0.70 0.125 255);
  --color-primary-500: oklch(0.60 0.18 255);
  --color-primary-600: oklch(0.50 0.16 255);
  --color-primary-700: oklch(0.40 0.123 255);
  --color-primary-800: oklch(0.30 0.082 255);
  --color-primary-900: oklch(0.18 0.038 255);
  --color-primary-950: oklch(0.10 0.012 255);

  /* --- PRIMARY DARK-MODE ADJUSTED (Desaturated for visual comfort) --- */
  --color-primary-50-dark: oklch(0.985 0.0016 255);
  --color-primary-100-dark: oklch(0.96 0.0066 255);
  --color-primary-200-dark: oklch(0.89 0.0279 255);
  --color-primary-300-dark: oklch(0.80 0.0623 255);
  --color-primary-400-dark: oklch(0.70 0.1025 255);
  --color-primary-500-dark: oklch(0.60 0.1476 255);
  --color-primary-600-dark: oklch(0.50 0.1312 255);
  --color-primary-700-dark: oklch(0.40 0.1009 255);
  --color-primary-800-dark: oklch(0.30 0.0672 255);
  --color-primary-900-dark: oklch(0.18 0.0312 255);
  --color-primary-950-dark: oklch(0.10 0.0098 255);

  /* --- NEUTRAL RAMP (Slate-gray, Hue 255, Low Chroma) --- */
  --color-neutral-50: oklch(0.985 0.001 255);
  --color-neutral-100: oklch(0.96 0.001 255);
  --color-neutral-200: oklch(0.89 0.001 255);
  --color-neutral-300: oklch(0.80 0.001 255);
  --color-neutral-400: oklch(0.70 0.001 255);
  --color-neutral-500: oklch(0.60 0.001 255);
  --color-neutral-600: oklch(0.50 0.001 255);
  --color-neutral-700: oklch(0.40 0.001 255);
  --color-neutral-800: oklch(0.30 0.001 255);
  --color-neutral-900: oklch(0.18 0.001 255);
  --color-neutral-950: oklch(0.10 0.001 255);

  --color-neutral-50-dark: oklch(0.985 0.001 255);
  --color-neutral-100-dark: oklch(0.96 0.001 255);
  --color-neutral-200-dark: oklch(0.89 0.001 255);
  --color-neutral-300-dark: oklch(0.80 0.001 255);
  --color-neutral-400-dark: oklch(0.70 0.001 255);
  --color-neutral-500-dark: oklch(0.60 0.001 255);
  --color-neutral-600-dark: oklch(0.50 0.001 255);
  --color-neutral-700-dark: oklch(0.40 0.001 255);
  --color-neutral-800-dark: oklch(0.30 0.001 255);
  --color-neutral-900-dark: oklch(0.18 0.001 255);
  --color-neutral-950-dark: oklch(0.10 0.001 255);

  /* --- SEMANTIC SCHEMING TOKENS --- */
  --bg-default: light-dark(var(--color-neutral-50), var(--color-neutral-950-dark));
  --bg-subtle: light-dark(var(--color-neutral-100), var(--color-neutral-900-dark));
  --bg-muted: light-dark(var(--color-neutral-200), var(--color-neutral-800-dark));
  --bg-overlay: light-dark(var(--color-neutral-50), var(--color-neutral-900-dark));

  --text-default: light-dark(var(--color-neutral-950), var(--color-neutral-50-dark));
  --text-muted: light-dark(var(--color-neutral-600), var(--color-neutral-300-dark));
  --text-inverse: light-dark(var(--color-neutral-50), var(--color-neutral-950-dark));

  --brand-solid: light-dark(var(--color-primary-600), var(--color-primary-500-dark));
  --brand-subtle: light-dark(var(--color-primary-100), var(--color-primary-900-dark));
  --brand-text: light-dark(var(--color-primary-700), var(--color-primary-300-dark));
  --brand-hover: light-dark(var(--color-primary-700), var(--color-primary-400-dark));

  --border-subtle: light-dark(var(--color-neutral-200), var(--color-neutral-800-dark));
  --border-default: light-dark(var(--color-neutral-300), var(--color-neutral-700-dark));
}
```

---

## 6. Antipatterns

1. **Passing `oklch()` strings straight to `apca-w3`**
   *   *Why*: The standard parser in `apca-w3` (which is `colorParsley` v0.1.8) does **not** recognize modern `oklch()` CSS syntax. It fails silently and returns a contrast value of `0`.
   *   *Correction*: Always parse/convert `oklch` colors to standard sRGB hexadecimal or RGB strings using a library like `culori` *before* passing the strings to the APCA calculator.
2. **Declaring `light-dark()` properties without `color-scheme`**
   *   *Why*: The browser needs to know that the document is designed to accept dark configurations natively. If `color-scheme` is missing or is only set to `light`, the `light-dark()` declarations will evaluate to the light option exclusively.
3. **Keeping Chroma constant across Lightness shifts**
   *   *Why*: Keeping Chroma constant at $C = 0.18$ as lightness moves to $L=0.98$ (white edge) or $L=0.10$ (black edge) pushes colors way outside the display gamut, forcing arbitrary and ugly browser clipping.
   *   *Correction*: Implement a bell-shaped chroma curve that tapers to $0$ as $L$ approaches $0.0$ and $1.0$, and run gamut mapping checks in your tooling pipeline.
