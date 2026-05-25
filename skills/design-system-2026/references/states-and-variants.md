# States and Variants (2026 Edition)

Specification for managing interactive states, layout variations, and responsive animation transitions.

> [!NOTE]
> Component state mapping is designed to integrate with semantic styles.
> - For information on primitive and component layers, refer to [design-tokens-architecture.md](design-tokens-architecture.md).
> - For color space parameters in light/dark transitions, refer to [oklch_color_systems_2026.md](oklch_color_systems_2026.md).

---

## Interactive States

Interactive components must support distinct states that correspond with user actions.

### Priority Tree

When multiple states apply simultaneously, styles must resolve in the following order (highest to lowest priority):

1. **Disabled** (`:disabled`, `[data-disabled="true"]`)
2. **Loading** (`[data-loading="true"]`)
3. **Active** (`:active`, `[data-state="active"]`)
4. **Focus** (`:focus-visible`, `[data-state="focused"]`)
5. **Hover** (`:hover`, `[data-state="hover"]`)
6. **Default** (base state)

### State Definitions & Selectors

| State | Primary CSS Selector | Visual Output Parameters | Cursor |
| :--- | :--- | :--- | :--- |
| **default** | `.interactive` | Base styling tokens | `default` |
| **hover** | `.interactive:hover` | Shift background color (using `var(--brand-hover)`) | `pointer` |
| **focus** | `.interactive:focus-visible` | High contrast focus outline ring (no clipping) | `pointer` |
| **active** | `.interactive:active` | Accentuate saturation or lower lightness slightly | `pointer` |
| **disabled** | `.interactive:disabled`, `[data-disabled="true"]` | Lightness desaturated, `opacity: 0.5 [UNVERIFIED]` | `not-allowed` |
| **loading** | `[data-state="loading"]` | Spinner icon visible, opacity decreased, contents hidden | `wait` |

### CSS Transition Timings

Transitions are defined globally in CSS variables and optimized to reduce main-thread layout calculations.

```css
@layer base {
  :root {
    --ease-standard: cubic-bezier(0.4, 0, 0.2, 1) [UNVERIFIED];
    --ease-out: cubic-bezier(0, 0, 0.2, 1) [UNVERIFIED];
    
    --duration-fast: 150ms [UNVERIFIED];
    --duration-normal: 200ms [UNVERIFIED];
    --duration-slow: 300ms [UNVERIFIED];
  }
}

@layer components {
  .interactive {
    /* Limit animated properties to prevent rendering pipelines thrashing */
    transition-property: color, background-color, border-color, box-shadow, transform;
    transition-duration: var(--duration-fast);
    transition-timing-function: var(--ease-standard);
  }

  /* Accessibility: Disable transitions for users with prefers-reduced-motion */
  @media (prefers-reduced-motion: reduce) {
    .interactive {
      transition-duration: 0.01ms !important;
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
    }
  }
}
```

---

## Focus States (Focus Not Obscured - WCAG 2.2)

Modern accessibility requires focus rings to be distinct, visible, and never cut off by parent containers.

### Focus Ring Styling

We implement focus indicators using native CSS `outline` with `outline-offset`. This draws the ring outside the border boundary without consuming physical space, preventing page layout shifts.

```css
@layer base {
  .focusable:focus-visible {
    outline: 2px [UNVERIFIED] solid var(--sys-color-ring, var(--brand-solid));
    outline-offset: 2px [UNVERIFIED];
  }

  /* Custom styling for container focus-within, styled via :has() */
  .parent-container:has(.focusable:focus-visible) {
    border-color: var(--brand-solid);
    box-shadow: 0 0 0 1px [UNVERIFIED] var(--brand-solid);
  }
}
```

### High-Contrast forced-colors Adaptations

For users with Windows Contrast Themes active, outline parameters must map to system colors.

```css
@media (forced-colors: active) {
  .focusable:focus-visible {
    outline: 2px solid Highlight;
    outline-offset: 4px [UNVERIFIED];
  }
}
```

---

## Disabled States

Disabled components are non-interactive and must prevent pointer event bubbles.

### Implementation Spec

To ensure accessibility checkers do not trigger contrast errors on static text fields, use `aria-disabled="true"` for semantic elements that remain focusable, and `:disabled` for form elements.

```css
@layer components {
  .interactive:disabled,
  .interactive[data-disabled="true"] {
    opacity: 0.5 [UNVERIFIED];
    pointer-events: none;
    cursor: not-allowed;
    background-color: var(--bg-muted);
    color: var(--text-muted);
    border-color: var(--border-subtle);
  }
}
```

---

## Loading States

Loading states indicate progress on asynchronous operations. The layout must reserve space for spinners to prevent size layout jumps.

### Implementation Spec

```css
@layer components {
  .loading-container {
    position: relative;
    pointer-events: none;
  }

  /* Hide contents while keeping layout size stable */
  .loading-container[data-loading="true"] > .loading-content {
    opacity: 0.25 [UNVERIFIED];
  }

  /* Centered custom spinner */
  .loading-container[data-loading="true"]::after {
    content: "";
    position: absolute;
    inset-block-start: calc(50% - 10px) [UNVERIFIED];
    inset-inline-start: calc(50% - 10px) [UNVERIFIED];
    inline-size: 20px [UNVERIFIED];
    block-size: 20px [UNVERIFIED];
    border: 2px [UNVERIFIED] solid var(--border-default);
    border-block-start-color: var(--brand-solid);
    border-radius: 50%;
    animation: spinner-spin 0.6s [UNVERIFIED] linear infinite;
  }

  @keyframes spinner-spin {
    to { transform: rotate(360deg); }
  }

  @media (prefers-reduced-motion: reduce) {
    .loading-container[data-loading="true"]::after {
      animation-duration: 2s [UNVERIFIED]; /* Slow down instead of freezing */
    }
  }
}
```

---

## Error States

Error states denote incorrect user input or connection dropouts.

```css
@layer components {
  /* Using :has() to highlight label when child field is invalid */
  .form-control:has(input[aria-invalid="true"]) label {
    color: oklch(0.60 0.18 25) [UNVERIFIED];
  }

  /* Error border treatment */
  .input-error {
    border-color: oklch(0.60 0.18 25) [UNVERIFIED];
  }

  /* Maintain readable contrast for error descriptions */
  .error-message {
    color: oklch(0.55 0.17 25) [UNVERIFIED]; /* APCA Lc 75 compliant */
    font-size: var(--ref-font-size-sm, 0.875rem);
    margin-block-start: var(--space-1, 4px) [UNVERIFIED];
  }
}
```

---

## Variant Patterns

Components declare variables locally to allow theming changes without affecting stylesheet structure.

### Component Variant Variables

```css
@layer components {
  .card-element {
    /* Local tokens fallback to Semantics */
    --card-bg: var(--bg-default);
    --card-border: var(--border-subtle);
    --card-text: var(--text-default);
    
    background-color: var(--card-bg);
    border: 1px solid var(--card-border);
    color: var(--card-text);
    padding: var(--space-4, 16px) [UNVERIFIED];
  }

  /* Local theme variables reassignment */
  .card-element[data-variant="brand"] {
    --card-bg: var(--brand-subtle);
    --card-border: var(--brand-solid);
    --card-text: var(--brand-text);
  }
}
```

---

## Accessibility Compliance (2026 Specifications)

### Target Size Requirements
- **WCAG 2.2 Criterion 2.5.8 (Target Size - Minimum)**: All targets must be at least `24px` [UNVERIFIED] in size, or have surrounding space to prevent overlapping actions.
- Action lists or links in lists should use padding to scale up target sizes.

### ARIA State Mapping Examples

```html
<!-- Interactive button showing loading state -->
<button 
  type="button" 
  class="btn" 
  aria-busy="true" 
  data-loading="true"
  disabled
>
  <span class="sr-only">Processing transaction...</span>
  <!-- Spinner element -->
</button>

<!-- Invalid Form Input -->
<div class="form-control">
  <label for="email-field">Email Address</label>
  <input 
    id="email-field" 
    type="email" 
    class="input-error" 
    aria-invalid="true" 
    aria-describedby="email-error"
  />
  <span id="email-error" role="alert" class="error-message">
    Please enter a valid email address.
  </span>
</div>
```

---
