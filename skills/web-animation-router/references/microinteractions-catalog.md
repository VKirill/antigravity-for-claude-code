# Microinteractions Catalog: Production Specs & Patterns (2026)

This catalog establishes the animation specifications and copy-paste implementations for core user interface controls in 2026. It maps interactive triggers to specific duration bands and spring mechanics, utilizing design patterns validated by Stripe, Linear, and Vercel.

Cross-reference core setups and tokens via:
*   [motion-tokens-and-springs.md](motion-tokens-and-springs.md) (Easing functions, duration variables, and spring solvers)
*   [motiondev-v12-react.md](motiondev-v12-react.md) (Motion v12 declarative integration surface)
*   [gsap-315-plugin-recipes.md](gsap-315-plugin-recipes.md) (Advanced imperative canvas orchestration)

---

## The Productive Duration Bands (2026 Spec)

Animations must respect specific human-perception timing bands to ensure layouts feel responsive and light:
*   **Instant Feedbacks (50ms - 100ms)**: High-frequency mouse presses, focus lines, active state clicks.
*   **Productive UI Band (150ms - 250ms)**: Standard menu opens, tab slides, toggle switches, hover animations.
*   **Expressive UI Band (300ms - 500ms)**: Page layout entrances, modal overlay transitions, multi-stage loading successes.

---

## 1. UI Control Spec Matrix

| Control | Trigger | Animated Property | Target Duration | Easing / Spring Token | Reduced-Motion Fallback |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Button** | Hover, Active, Loading, Success | `scale`, `opacity`, `transform`, `border-color` | Hover: 100ms, Active: 50ms, Success: 300ms | Hover/Success: `snappy`, Active: `tight` | Keep scale static, toggle states via colors and text labels. |
| **2. Toggle / Switch** | Click, Keypress | `transform` (thumb translation), `background-color` | 150ms | `snappy` | Remove horizontal translation, toggle opacity of thumb overlay. |
| **3. Checkbox / Radio** | Click, Select | SVG `stroke-dashoffset`, `transform` (scale of dot) | 150ms | `snappy` | Set dashoffset or scale instantly, use color transitions. |
| **4. Text Input** | Focus, Validation Error | `box-shadow`, `border-color`, `transform` (shake translation) | Focus: 100ms, Shake: 400ms | Focus: `smooth`, Shake: `bouncy` (custom bounce) | Swap borders to red, append screen-reader-audible validation message. |
| **5. Select Menu** | Click, Enter | `transform` (scaleY, translateY), `opacity`, `rotate` (icon) | Enter: 150ms, Exit: 100ms | Enter: `snappy`, Exit: `motion-easing-exit` | Swap opacity without translation offsets. |
| **6. Tabs** | Focus, Tab Key | `layoutId` (position & width of highlight indicator) | 240ms | `gentle` | Position active background instantly without sliding. |
| **7. Accordion** | Expand, Collapse | `height` (0 to `auto`), `rotate` (icon) | 240ms | `smooth` | Toggle visibility immediately without expanding animation. |
| **8. Tooltip** | Hover, Keyboard Focus | `opacity`, `transform` (translateY offset) | Enter: 100ms, Exit: 50ms | `snappy` | Fade opacity without vertical translation. |
| **9. Dropdown Menu** | Click | `transform` (scale, translateY), `opacity` | Enter: 150ms, Exit: 100ms | Enter: `snappy`, Exit: `motion-easing-exit` | Fade opacity directly. |
| **10. Segmented Control** | Click, Arrow Key | Position & width of sliding backing plate | 200ms | `snappy` | Relocate active backing plate instantly. |
| **11. Slider** | Drag, Click track | Thumb `scale`, Track progress | Active: 150ms, Drag: 0ms (continuous) | Active scale: `tight`, Drag tracking: linear | Set active scale to static, render value track directly. |
| **12. Card Hover** | Pointer Enter | `box-shadow`, `transform` (y-shift / tilt) | 240ms | `smooth` | Adjust border color/opacity only, zero physical offset. |
| **13. Like / Heart** | Press Click | `scale` (pop overshoot), SVG path color | 400ms | `bouncy` | Color replacement only, bypass bounce scaling. |
| **14. Copy to Clipboard**| Click Copy | SVG path morph (Copy -> Checkmark -> Copy), `scale` | Morph: 200ms, Exit: 150ms | `snappy` | Direct text update ("Copy" to "Copied"), bypass SVG rotation. |
| **15. Skeleton Swap** | Data Load Resolve | `opacity` crossfade | 240ms | `smooth` | Unmount skeleton and render target content instantly. |

---

## 2. Copy-Paste Component Implementations

### 1. Button (Hover/Active/Loading/Success)
A React + Motion v12 implementation featuring state switches from hover scales to loading loops and checking indicators.

```tsx
'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface LoadingButtonProps {
  status: 'idle' | 'loading' | 'success';
  onClick?: () => void;
  children: React.ReactNode;
}

export function LoadingButton({ status, onClick, children }: LoadingButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      disabled={status === 'loading'}
      className="relative px-6 py-3 rounded-lg font-medium text-white bg-blue-600 outline-none overflow-hidden"
      whileHover={{ scale: status === 'idle' ? 1.02 : 1 }}
      whileTap={{ scale: status === 'idle' ? 0.98 : 1 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }} // snappy
    >
      <AnimatePresence mode="wait">
        {status === 'idle' && (
          <motion.span
            key="idle"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.15 }}
          >
            {children}
          </motion.span>
        )}

        {status === 'loading' && (
          <motion.div
            key="loading"
            className="flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </motion.div>
        )}

        {status === 'success' && (
          <motion.div
            key="success"
            className="flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }} // bouncy
          >
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
```

---

### 2. Toggle / Switch
Pure HTML/CSS checkbox toggle utilizing CSS springs approximation.

```html
<!-- toggle.html -->
<label class="toggle-switch">
  <input type="checkbox" class="toggle-input" />
  <span class="toggle-track">
    <span class="toggle-thumb"></span>
  </span>
</label>
```

```css
.toggle-switch {
  display: inline-block;
  cursor: pointer;
}

.toggle-input {
  display: none;
}

.toggle-track {
  display: block;
  width: 50px;
  height: 28px;
  background-color: #3f3f46; /* zinc-700 */
  border-radius: 9999px;
  position: relative;
  transition: background-color 150ms cubic-bezier(0.16, 1, 0.3, 1);
}

.toggle-input:checked + .toggle-track {
  background-color: #10b981; /* emerald-500 */
}

.toggle-thumb {
  position: absolute;
  top: 4px;
  left: 4px;
  width: 20px;
  height: 20px;
  background-color: #ffffff;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  /* Apply snappy spring token */
  transition: transform 250ms linear(
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
}

.toggle-input:checked + .toggle-track .toggle-thumb {
  transform: translateX(22px);
}

/* Reduced Motion Override */
@media (prefers-reduced-motion: reduce) {
  .toggle-thumb {
    transition: opacity 100ms ease-out;
  }
  .toggle-input:not(:checked) + .toggle-track .toggle-thumb {
    opacity: 0.4;
    transform: translateX(0);
  }
  .toggle-input:checked + .toggle-track .toggle-thumb {
    opacity: 1;
    transform: translateX(22px);
  }
}
```

---

### 3. Checkbox / Radio
SVG dashoffset drawing on select states.

```html
<label class="custom-checkbox">
  <input type="checkbox" class="cb-input" />
  <span class="cb-box">
    <svg class="cb-checkmark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  </span>
</label>
```

```css
.custom-checkbox {
  display: inline-block;
  cursor: pointer;
}

.cb-input {
  display: none;
}

.cb-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: 2px solid #52525b; /* zinc-600 */
  border-radius: 4px;
  background-color: transparent;
  transition: background-color 150ms, border-color 150ms;
}

.cb-checkmark {
  width: 14px;
  height: 14px;
  stroke-dasharray: 22;
  stroke-dashoffset: 22;
  transition: stroke-dashoffset 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

.cb-input:checked + .cb-box {
  background-color: #3b82f6; /* blue-500 */
  border-color: #3b82f6;
}

.cb-input:checked + .cb-box .cb-checkmark {
  stroke-dashoffset: 0;
}

@media (prefers-reduced-motion: reduce) {
  .cb-checkmark {
    transition: none;
  }
}
```

---

### 4. Text Input (Focus + Shake Error)
Includes error-shaking class targeting input boundaries on validation failures.

```html
<div class="input-container">
  <input type="email" id="email-field" class="text-input" placeholder="Enter email" required />
  <button onclick="triggerShakeError()">Submit</button>
</div>
```

```css
.text-input {
  width: 100%;
  padding: 0.75rem 1rem;
  background-color: #18181b;
  border: 1px solid #3f3f46;
  border-radius: 6px;
  color: #fff;
  outline: none;
  /* Smooth focus transition */
  transition: border-color 150ms ease, box-shadow 150ms ease;
}

.text-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25);
}

/* Shake keyframe animation */
.input-shake-error {
  animation: shake 400ms linear(
    0.0000 0.0%, 0.0663 2.5%, 0.2301 5.0%, 0.4424 7.5%, 
    0.6623 10.0%, 0.8602 12.5%, 1.0176 15.0%, 1.1267 17.5%, 
    1.1880 20.0%, 1.2078 22.5%, 1.1958 25.0%, 1.1627 27.5%, 
    1.1190 30.0%, 1.0732 32.5%, 1.0316 35.0%, 0.9982 37.5%, 
    0.9748 40.0%, 0.9615 42.5%, 0.9568 45.0%, 0.9590 47.5%, 
    0.9656 50.0%, 0.9746 52.5%, 0.9842 55.0%, 0.9929 57.5%, 
    1.0000 60.0%
  );
  border-color: #ef4444 !important; /* red-500 */
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-6px); }
  40%, 80% { transform: translateX(6px); }
}

@media (prefers-reduced-motion: reduce) {
  .input-shake-error {
    animation: none;
    border-color: #ef4444 !important;
  }
}
```

```javascript
function triggerShakeError() {
  const el = document.getElementById('email-field');
  el.classList.remove('input-shake-error');
  // Trigger reflow
  void el.offsetWidth;
  el.classList.add('input-shake-error');
}
```

---

### 5. Select / Combobox
CSS anchor positioning / Popover API reveal animation.

```html
<button popovertarget="select-menu" class="select-trigger">Choose option...</button>

<div popover id="select-menu" class="select-dropdown">
  <ul>
    <li>Option 1</li>
    <li>Option 2</li>
    <li>Option 3</li>
  </ul>
</div>
```

```css
.select-trigger {
  padding: 0.5rem 1rem;
  background: #27272a;
  color: #fff;
  border-radius: 6px;
  border: 1px solid #3f3f46;
}

.select-dropdown {
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 8px;
  padding: 0.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  /* Define exit state styles */
  opacity: 0;
  transform: translateY(-8px) scale(0.96);
  transition: 
    opacity 150ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 150ms cubic-bezier(0.16, 1, 0.3, 1),
    display 150ms allow-discrete;
}

/* Set starting values directly on mount */
@starting-style {
  .select-dropdown:popover-open {
    opacity: 0;
    transform: translateY(-8px) scale(0.96);
  }
}

.select-dropdown:popover-open {
  opacity: 1;
  transform: translateY(0) scale(1);
}
```

---

### 6. Tabs (Shared-Element Indicator)
Framer Motion v12 `layoutId` component.

```tsx
'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';

const TAB_DATA = ['Overview', 'Integrations', 'Billing', 'Settings'];

export function LayoutTabs() {
  const [activeTab, setActiveTab] = useState('Overview');

  return (
    <div className="flex gap-2 p-1 bg-zinc-900 rounded-lg">
      {TAB_DATA.map((tab) => {
        const isActive = activeTab === tab;
        return (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="relative px-4 py-2 text-sm font-medium text-white transition-colors duration-150 outline-none"
          >
            {isActive && (
              <motion.div
                layoutId="tab-highlight"
                className="absolute inset-0 bg-zinc-800 rounded-md z-0"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }} // gentle
              />
            )}
            <span className="relative z-10">{tab}</span>
          </button>
        );
      })}
    </div>
  );
}
```

---

### 7. Accordion (Native Height Auto)
Leverages Chrome/Safari 2026 standard `interpolate-size: allow-keywords` to transition to height `auto`.

```html
<details class="accordion-item">
  <summary class="accordion-header">
    What is our performance standard?
    <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  </summary>
  <div class="accordion-wrapper">
    <div class="accordion-content">
      All microinteractions must remain within 100-250ms boundaries.
    </div>
  </div>
</details>
```

```css
/* Enable global keyword interpolation */
:root {
  interpolate-size: allow-keywords;
}

.accordion-item {
  border-bottom: 1px solid #27272a;
}

.accordion-header {
  display: flex;
  justify-content: space-between;
  padding: 1rem 0;
  cursor: pointer;
  list-style: none;
}

.chevron {
  width: 18px;
  height: 18px;
  transition: transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
}

.accordion-item[open] .chevron {
  transform: rotate(180deg);
}

/* Container wrapper to isolate padding transitions */
.accordion-wrapper {
  height: 0;
  overflow: hidden;
  /* Animating height: auto natively */
  transition: height 240ms cubic-bezier(0.16, 1, 0.3, 1);
}

.accordion-item[open] .accordion-wrapper {
  height: auto;
}

.accordion-content {
  padding-bottom: 1rem;
}
```

---

### 8. Tooltip
CSS-driven accessible tooltip wrapper.

```html
<div class="tooltip-container">
  <button aria-describedby="tooltip-desc">Hover element</button>
  <span id="tooltip-desc" class="tooltip-box" role="tooltip">
    Tooltip helper content
  </span>
</div>
```

```css
.tooltip-container {
  position: relative;
  display: inline-block;
}

.tooltip-box {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(4px);
  opacity: 0;
  pointer-events: none;
  background-color: #000;
  color: #fff;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  transition: 
    opacity 100ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 100ms cubic-bezier(0.16, 1, 0.3, 1);
}

.tooltip-container:hover .tooltip-box,
.tooltip-container:focus-within .tooltip-box {
  opacity: 1;
  transform: translateX(-50%) translateY(-6px);
}
```

---

### 9. Dropdown Menu
Standard navigation dropdown list revealing via custom bezier values.

```html
<div class="dropdown">
  <button class="dropdown-trigger" aria-haspopup="true" aria-expanded="false">Menu</button>
  <ul class="dropdown-list">
    <li><a href="#">Link 1</a></li>
    <li><a href="#">Link 2</a></li>
  </ul>
</div>
```

```css
.dropdown {
  position: relative;
}

.dropdown-list {
  position: absolute;
  top: 100%;
  left: 0;
  display: none;
  opacity: 0;
  transform: scale(0.95) translateY(-5px);
  transition: 
    opacity 150ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 150ms cubic-bezier(0.16, 1, 0.3, 1);
}

.dropdown:focus-within .dropdown-list,
.dropdown:hover .dropdown-list {
  display: block;
  opacity: 1;
  transform: scale(1) translateY(0);
}
```

---

### 10. Segmented Control
Framer Motion v12 segmented container.

```tsx
'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';

const OPTIONS = ['Day', 'Week', 'Month', 'Year'];

export function SegmentedControl() {
  const [selected, setSelected] = useState('Day');

  return (
    <div className="flex bg-zinc-950 p-1 rounded-md">
      {OPTIONS.map((opt) => (
        <button
          key={opt}
          onClick={() => setSelected(opt)}
          className="relative px-3 py-1.5 text-xs font-semibold text-white outline-none"
        >
          {selected === opt && (
            <motion.div
              layoutId="segmented-bg"
              className="absolute inset-0 bg-zinc-800 rounded"
              transition={{ type: 'spring', stiffness: 400, damping: 28 }} // snappy
            />
          )}
          <span className="relative z-10">{opt}</span>
        </button>
      ))}
    </div>
  );
}
```

---

### 11. Slider (Custom Input Range)
Styled accessible slider input.

```html
<input type="range" class="custom-slider" min="0" max="100" value="50" />
```

```css
.custom-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  background: #3f3f46;
  border-radius: 3px;
  outline: none;
}

.custom-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  transition: transform 120ms cubic-bezier(0.16, 1, 0.3, 1);
}

.custom-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.custom-slider::-webkit-slider-thumb:active {
  transform: scale(1.05); /* slightly smaller under pressure */
}
```

---

### 12. Card Hover (Elevation / Tilt Effect)
Hover lift matching Stripe’s dashboard cards.

```css
.hover-card {
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 12px;
  padding: 1.5rem;
  transition: 
    transform 240ms cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 240ms cubic-bezier(0.16, 1, 0.3, 1),
    border-color 240ms ease;
}

.hover-card:hover {
  transform: translateY(-4px);
  border-color: #3f3f46;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
}
```

---

### 13. Like / Heart Pop Animation
Highly elastic spring scale pop.

```html
<button class="like-button" onclick="toggleLike(this)">
  <svg class="heart-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
</button>
```

```css
.like-button {
  background: none;
  border: none;
  cursor: pointer;
  outline: none;
}

.heart-icon {
  width: 28px;
  height: 28px;
  color: #71717a;
  transition: color 150ms ease;
}

/* Elastic scaling burst on click */
.like-button.is-liked .heart-icon {
  color: #ef4444;
  fill: #ef4444;
  animation: heart-pop 450ms linear(
    0.0000 0.0%, 0.1997 2.5%, 0.6454 5.0%, 1.0990 7.5%, 
    1.3867 10.0%, 1.4466 12.5%, 1.3208 15.0%, 1.1093 17.5%, 
    0.9163 20.0%, 0.8097 22.5%, 0.8052 25.0%, 0.8756 27.5%, 
    0.9732 30.0%, 1.0532 32.5%, 1.0905 35.0%, 1.0830 37.5%, 
    1.0462 40.0%, 1.0024 42.5%, 1.0000 100.0%
  );
}

@keyframes heart-pop {
  0% { transform: scale(1); }
  50% { transform: scale(1.3); }
  100% { transform: scale(1); }
}
```

```javascript
function toggleLike(button) {
  button.classList.toggle('is-liked');
}
```

---

### 14. Copy to Clipboard (Icon Morph)
React/Motion v12 morph transitioning.

```tsx
'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export function CopyButton({ textToCopy }: { textToCopy: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-2 rounded bg-zinc-800 hover:bg-zinc-700 outline-none text-zinc-300"
    >
      <AnimatePresence mode="wait">
        {!copied ? (
          <motion.svg
            key="copy"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
            initial={{ opacity: 0, rotate: -45 }}
            animate={{ opacity: 1, rotate: 0 }}
            exit={{ opacity: 0, rotate: 45 }}
            transition={{ duration: 0.15 }}
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </motion.svg>
        ) : (
          <motion.svg
            key="check"
            className="h-5 w-5 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="3"
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 450, damping: 20 }} // tight
          >
            <polyline points="20 6 9 17 4 12" />
          </motion.svg>
        )}
      </AnimatePresence>
    </button>
  );
}
```

---

### 15. Skeleton-to-Content Swap
CSS skeleton shimmering effect mapping directly to crossfaded page contents.

```html
<div class="card-container">
  <!-- Skeleton loader state -->
  <div id="card-skeleton" class="skeleton-card">
    <div class="skeleton-thumb shimmer"></div>
    <div class="skeleton-title shimmer"></div>
  </div>

  <!-- Real loaded text content -->
  <div id="card-content" class="real-card" style="opacity: 0; display: none;">
    <h2>Card Title</h2>
    <p>Success loaded database contents.</p>
  </div>
</div>
```

```css
.skeleton-card {
  width: 300px;
  background: #18181b;
  border-radius: 8px;
  padding: 1rem;
}

.skeleton-thumb {
  width: 100%;
  height: 150px;
  background: #27272a;
  border-radius: 6px;
}

.skeleton-title {
  width: 60%;
  height: 20px;
  background: #27272a;
  margin-top: 1rem;
  border-radius: 4px;
}

/* Infinite GPU-Accelerated linear gradient shimmer */
.shimmer {
  background: linear-gradient(
    90deg,
    #27272a 25%,
    #3f3f46 50%,
    #27272a 75%
  );
  background-size: 200% 100%;
  animation: loading-shimmer 1.6s infinite linear;
}

@keyframes loading-shimmer {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}

/* Card crossfade styling */
.real-card {
  transition: opacity 240ms cubic-bezier(0.2, 0, 0.38, 0.9);
}

@media (prefers-reduced-motion: reduce) {
  .shimmer {
    animation: none; /* Halt flashing shimmer */
  }
}
```

```javascript
function resolveDataLoad() {
  const skel = document.getElementById('card-skeleton');
  const real = document.getElementById('card-content');

  // Fade out skeleton
  skel.style.transition = 'opacity 200ms ease';
  skel.style.opacity = '0';

  setTimeout(() => {
    skel.style.display = 'none';
    real.style.display = 'block';
    // Force browser style recalculation
    void real.offsetWidth;
    // Fade in content
    real.style.opacity = '1';
  }, 200);
}
```
