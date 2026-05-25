# Component Specifications (2026 Edition)

Detailed specifications for core UI components, leveraging modern web standards, logical layout properties, container queries, and perceptually uniform color spaces.

> [!NOTE]
> This specification maps component styles to Tier 2 (Semantic) and Tier 3 (Component) tokens.
> - For the foundational 3-layer architecture theory, compile mappings, and validation pipeline, refer to [design-tokens-architecture.md](design-tokens-architecture.md).
> - For color space mathematics and exact OKLCH values, refer to [oklch_color_systems_2026.md](oklch_color_systems_2026.md).

---

## Button

Buttons are interactive triggers for actions. They must maintain a physical or virtual hit target of at least `24px` [UNVERIFIED] (WCAG 2.2 Criterion 2.5.8 Target Size).

### Variants

All background, border, and text colors are mapped to semantic tokens defined in `oklch_color_systems_2026.md`.

| Variant | Background | Text | Border | Use Case |
| :--- | :--- | :--- | :--- | :--- |
| **default** | `var(--brand-solid)` | `var(--text-inverse)` | `none` | Primary call-to-action |
| **secondary** | `var(--bg-muted)` | `var(--text-default)` | `none` | Secondary options |
| **outline** | `transparent` | `var(--text-default)` | `1px [UNVERIFIED] solid var(--border-default)` | Secondary / Tertiary actions |
| **ghost** | `transparent` | `var(--text-default)` | `none` | Subtle, low-emphasis actions |
| **link** | `transparent` | `var(--brand-text)` | `none` | Navigation inline or footer links |
| **destructive** | `oklch(0.60 0.18 25) [UNVERIFIED]` | `var(--text-inverse)` | `none` | Dangerous, irreversible actions |

### Sizes

To support internationalization and varying text densities, button sizes are defined using logical layout properties.

| Size | Min Block Size (Height) | Padding Inline (X) | Padding Block (Y) | Font Size | Icon Size |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **sm** | `32px` [UNVERIFIED] | `12px` [UNVERIFIED] | `6px` [UNVERIFIED] | `0.875rem` | `16px` [UNVERIFIED] |
| **default** | `40px` [UNVERIFIED] | `16px` [UNVERIFIED] | `8px` [UNVERIFIED] | `0.875rem` | `18px` [UNVERIFIED] |
| **lg** | `48px` [UNVERIFIED] | `24px` [UNVERIFIED] | `12px` [UNVERIFIED] | `1rem` | `20px` [UNVERIFIED] |
| **icon** | `40px` [UNVERIFIED] | `0` | `0` | — | `18px` [UNVERIFIED] |

### Interactive States

State management is handled via native CSS pseudo-classes combined with `data-*` attributes for framework-level states (e.g. Radix UI or shadcn/ui).

| State | CSS Selector / Attribute | Background | Opacity | Cursor |
| :--- | :--- | :--- | :--- | :--- |
| **default** | `.btn` | Base variant token | `1.0` | `pointer` |
| **hover** | `.btn:hover` | `var(--brand-hover)` | `1.0` | `pointer` |
| **active** | `.btn:active` | Tapered tone shift | `1.0` | `pointer` |
| **focus** | `.btn:focus-visible` | Base variant token | `1.0` | `pointer` |
| **disabled** | `.btn:disabled`, `[data-disabled="true"]` | `var(--bg-subtle)` | `0.5` [UNVERIFIED] | `not-allowed` |
| **loading** | `[data-loading="true"]` | Base variant token | `0.75` [UNVERIFIED] | `wait` |

### Modern CSS Implementation

```css
@layer components {
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2, 8px) [UNVERIFIED];
    border-radius: var(--sys-rounded-button, 8px) [UNVERIFIED];
    font-family: var(--ref-font-family-sans);
    font-weight: 500 [UNVERIFIED];
    font-size: var(--ref-font-size-sm, 0.875rem);
    min-block-size: 40px [UNVERIFIED];
    padding-inline: var(--space-4, 16px) [UNVERIFIED];
    padding-block: var(--space-2, 8px) [UNVERIFIED];
    border: 1px [UNVERIFIED] solid transparent;
    cursor: pointer;
    text-decoration: none;
    vertical-align: middle;
    
    /* Logical Transitions */
    transition-property: background-color, border-color, box-shadow, opacity;
    transition-duration: 150ms [UNVERIFIED];
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1) [UNVERIFIED];
  }

  /* Variant implementations */
  .btn-default {
    background-color: var(--brand-solid);
    color: var(--text-inverse);
  }

  .btn-default:hover:not(:disabled) {
    background-color: var(--brand-hover);
  }

  .btn-secondary {
    background-color: var(--bg-muted);
    color: var(--text-default);
  }

  /* WCAG 2.2 Focus Indicator - Outlines should never be clipped or hidden */
  .btn:focus-visible {
    outline: 2px [UNVERIFIED] solid var(--brand-solid);
    outline-offset: 2px [UNVERIFIED];
  }

  /* Disable animations for users who prefer reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .btn {
      transition: none !important;
    }
  }

  /* High Contrast Mode Adaptation (forced-colors) */
  @media (forced-colors: active) {
    .btn {
      border: 1px solid ButtonText;
    }
    .btn:focus-visible {
      outline: 2px solid Highlight;
      outline-offset: 4px [UNVERIFIED];
    }
  }
}
```

---

## Input

Inputs collect user data. Standard text inputs require clear association with label elements and error regions.

### Variants & Anatomy

| Variant | Tag / Type | Description |
| :--- | :--- | :--- |
| **default** | `input[type="text"]` | Standard single-line text input |
| **textarea** | `textarea` | Scrollable multi-line field with dynamic block sizing |
| **select** | `select` | Dropdown selection using modern Radix wrapper |
| **checkbox** | `input[type="checkbox"]` | Boolean selector (target ≥ 24px [UNVERIFIED]) |
| **radio** | `input[type="radio"]` | Exclusive single selection in a set |
| **switch** | `button[role="switch"]` | Instant toggle switch component |

### Sizing and Logical Spacing

| Size | Min Block Size | Padding Inline | Padding Block | Font Size |
| :--- | :--- | :--- | :--- | :--- |
| **sm** | `32px` [UNVERIFIED] | `12px` [UNVERIFIED] | `6px` [UNVERIFIED] | `0.875rem` |
| **default** | `40px` [UNVERIFIED] | `12px` [UNVERIFIED] | `8px` [UNVERIFIED] | `0.875rem` |
| **lg** | `48px` [UNVERIFIED] | `16px` [UNVERIFIED] | `12px` [UNVERIFIED] | `1rem` |

### States and data-* / aria-* Selectors

| State | Selector | Border | Background | Focus Ring |
| :--- | :--- | :--- | :--- | :--- |
| **default** | `.input` | `var(--border-default)` | `var(--bg-default)` | `none` |
| **hover** | `.input:hover` | `var(--color-neutral-400) [UNVERIFIED]` | `var(--bg-default)` | `none` |
| **focus** | `.input:focus-visible` | `var(--brand-solid)` | `var(--bg-default)` | `0 0 0 2px [UNVERIFIED] var(--brand-subtle)` |
| **error** | `[aria-invalid="true"]` | `oklch(0.60 0.18 25) [UNVERIFIED]` | `var(--bg-default)` | `0 0 0 2px [UNVERIFIED] oklch(0.90 0.05 25) [UNVERIFIED]` |
| **disabled** | `:disabled` | `var(--border-subtle)` | `var(--bg-subtle)` | `none` |

### Styling with `:has()`

The `:has()` selector enables style changes to parent elements based on the state of nested form components.

```css
@layer components {
  /* Style form field wrapper depending on nested input state */
  .form-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 8px) [UNVERIFIED];
    border: 1px solid var(--border-subtle);
    padding: var(--space-3, 12px) [UNVERIFIED];
    border-radius: var(--radius-md, 6px) [UNVERIFIED];
    background-color: var(--bg-default);
    transition: border-color 150ms [UNVERIFIED] ease;
  }

  /* If the input inside is focused, highlight the container border */
  .form-field:has(input:focus-visible) {
    border-color: var(--brand-solid);
    box-shadow: 0 0 0 1px [UNVERIFIED] var(--brand-solid);
  }

  /* If the input is invalid, style the container with the error token */
  .form-field:has(input[aria-invalid="true"]) {
    border-color: oklch(0.60 0.18 25) [UNVERIFIED];
    background-color: oklch(0.98 0.005 25) [UNVERIFIED];
  }

  .input-element {
    border: none;
    background: transparent;
    color: var(--text-default);
    outline: none;
    font-size: var(--ref-font-size-base, 1rem);
    min-block-size: 24px [UNVERIFIED];
  }
}
```

---

## Card

Cards contain content and actions about a single subject. Modern cards use Container Queries to modify their layout based on available parent width.

### Variants & Shadows

| Variant | Shadow Token | Border | Use Case |
| :--- | :--- | :--- | :--- |
| **default** | `var(--shadow-sm) [UNVERIFIED]` | `1px [UNVERIFIED] solid var(--border-subtle)` | Standard static card content |
| **elevated** | `var(--shadow-lg) [UNVERIFIED]` | `none` | Prominent notifications/banners |
| **outline** | `none` | `1px [UNVERIFIED] solid var(--border-default)` | Structured grids / subtle dividers |
| **interactive**| `var(--shadow-sm) [UNVERIFIED]` | `1px [UNVERIFIED] solid var(--border-subtle)` | Clickable list items/articles |

### Spacing & Logical Offsets

- **Header Padding**: `padding-block-start: 24px [UNVERIFIED]`, `padding-inline: 24px [UNVERIFIED]`, `padding-block-end: 0`
- **Content Padding**: `padding-inline: 24px [UNVERIFIED]`, `padding-block: 24px [UNVERIFIED]`
- **Footer Padding**: `padding-block-start: 0`, `padding-inline: 24px [UNVERIFIED]`, `padding-block-end: 24px [UNVERIFIED]`
- **Layout Gap**: `gap: 16px [UNVERIFIED]` (between blocks)

### Container Query Card Implementation

```css
@layer components {
  /* Set up the query container */
  .card-wrapper {
    container-type: inline-size;
    width: 100%;
  }

  .card {
    display: flex;
    flex-direction: column;
    background-color: var(--bg-default);
    border: 1px [UNVERIFIED] solid var(--border-subtle);
    border-radius: var(--radius-lg, 12px) [UNVERIFIED];
    overflow: hidden;
    transition: transform 200ms [UNVERIFIED] ease, box-shadow 200ms [UNVERIFIED] ease;
  }

  /* When container is wider than 400px [UNVERIFIED], switch to side-by-side layout */
  @container (min-width: 400px) [UNVERIFIED] {
    .card-interactive-horizontal {
      flex-direction: row;
      align-items: center;
    }
    
    .card-image {
      max-inline-size: 150px [UNVERIFIED];
      aspect-ratio: 1 / 1;
    }
  }

  /* Support interactive states on cards without sacrificing accessibility */
  .card:has(a:focus-visible) {
    outline: 2px [UNVERIFIED] solid var(--brand-solid);
    outline-offset: 2px [UNVERIFIED];
  }
}
```

---

## Badge

Badges indicate status or numerical indicators.

### Variants & OKLCH color mappings

| Variant | Background Token | Text Token |
| :--- | :--- | :--- |
| **default** | `var(--brand-solid)` | `var(--text-inverse)` |
| **secondary** | `var(--bg-muted)` | `var(--text-default)` |
| **outline** | `transparent` | `var(--text-default)` |
| **destructive** | `oklch(0.60 0.18 25) [UNVERIFIED]` | `var(--text-inverse)` |
| **success** | `oklch(0.62 0.17 145) [UNVERIFIED]` | `var(--text-inverse)` |
| **warning** | `oklch(0.82 0.12 85) [UNVERIFIED]` | `oklch(0.25 0.04 85) [UNVERIFIED]` |

### Sizes

- **sm**: Height: `20px` [UNVERIFIED]; `padding-inline: 8px [UNVERIFIED]`; Font Size: `11px` [UNVERIFIED]
- **default**: Height: `24px` [UNVERIFIED]; `padding-inline: 10px [UNVERIFIED]`; Font Size: `12px` [UNVERIFIED]
- **lg**: Height: `28px` [UNVERIFIED]; `padding-inline: 12px [UNVERIFIED]`; Font Size: `14px` [UNVERIFIED]

---

## Alert

Alerts display high-priority messages. Layouts adapt responsively using container queries to handle inline actions.

### Variants

| Variant | Icon | Background | Border |
| :--- | :--- | :--- | :--- |
| **default** | Info | `var(--bg-subtle)` | `var(--border-default)` |
| **destructive** | CircleAlert | `oklch(0.97 0.01 25) [UNVERIFIED]` | `oklch(0.85 0.04 25) [UNVERIFIED]` |
| **success** | CircleCheck | `oklch(0.98 0.01 145) [UNVERIFIED]` | `oklch(0.88 0.04 145) [UNVERIFIED]` |
| **warning** | TriangleAlert | `oklch(0.98 0.01 85) [UNVERIFIED]` | `oklch(0.90 0.03 85) [UNVERIFIED]` |

### Container-Query Alert Layout

```css
@layer components {
  .alert-container {
    container-type: inline-size;
    width: 100%;
  }

  .alert {
    display: flex;
    flex-direction: column;
    gap: var(--space-3, 12px) [UNVERIFIED];
    padding: var(--space-4, 16px) [UNVERIFIED];
    border: 1px [UNVERIFIED] solid var(--border-default);
    border-radius: var(--radius-md, 8px) [UNVERIFIED];
    background-color: var(--bg-subtle);
  }

  /* Inline layout on wider containers */
  @container (min-width: 500px) [UNVERIFIED] {
    .alert {
      flex-direction: row;
      align-items: flex-start;
    }
    
    .alert-actions {
      margin-inline-start: auto;
      align-self: center;
    }
  }
}
```

---

## Dialog

Dialogs are modal windows overlaying the document. They must trap focus and prevent focus obscurity for underlying pages.

### Sizing Specifications

| Size Variant | Max Inline Size (Width) | Mobile Viewport Adaptation |
| :--- | :--- | :--- |
| **sm** | `384px` [UNVERIFIED] | Bottom-sheet slide-up layout |
| **default** | `512px` [UNVERIFIED] | Centered layout with `16px` [UNVERIFIED] safety margin |
| **lg** | `640px` [UNVERIFIED] | Centered layout |
| **xl** | `768px` [UNVERIFIED] | Fits to screen boundary |
| **full** | `calc(100% - 32px) [UNVERIFIED]` | Absolute fullscreen layout |

### Focus Not Obscured Implementation

```css
@layer components {
  /* Overlay */
  .dialog-overlay {
    position: fixed;
    inset: 0;
    background-color: oklch(0.1 0.001 255 / 0.5) [UNVERIFIED];
    z-index: 50 [UNVERIFIED];
  }

  /* Dialog Content Container */
  .dialog-content {
    position: fixed;
    inset-block-start: 50%;
    inset-inline-start: 50%;
    transform: translate(-50%, -50%);
    max-inline-size: 512px [UNVERIFIED];
    width: 90vw [UNVERIFIED];
    background-color: var(--bg-default);
    border: 1px [UNVERIFIED] solid var(--border-default);
    border-radius: var(--radius-lg, 12px) [UNVERIFIED];
    padding: var(--space-6, 24px) [UNVERIFIED];
    z-index: 51 [UNVERIFIED];
  }

  /* Accessibility Close Button - Target size must be at least 24px [UNVERIFIED] */
  .dialog-close {
    position: absolute;
    inset-block-start: 16px [UNVERIFIED];
    inset-inline-end: 16px [UNVERIFIED];
    min-inline-size: 24px [UNVERIFIED];
    min-block-size: 24px [UNVERIFIED];
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    cursor: pointer;
  }
}
```

---

## Table

Tables display structured data sets.

### Row States

| State | Background | Accent Indicator |
| :--- | :--- | :--- |
| **default** | `var(--bg-default)` | — |
| **hover** | `var(--bg-subtle)` | — |
| **selected** | `var(--brand-subtle)` | `2px [UNVERIFIED] solid var(--brand-solid)` (logical inline start) |
| **striped** | Alternating `.row:nth-child(even)` with `var(--bg-subtle)` | — |

### Spacing and Alignment

- **Cell Padding**: `padding-block: 12px [UNVERIFIED]`, `padding-inline: 16px [UNVERIFIED]`
- **Row Heights**: Compact: `40px` [UNVERIFIED], Default: `48px` [UNVERIFIED], Comfortable: `56px` [UNVERIFIED]
- **Alignment Rules**:
  - Text columns: `text-align: start` (respecting LTR/RTL)
  - Quantitative numeric columns: `text-align: end`
  - Inline Badges/Status indicators: `text-align: center`
  - Action items: `text-align: end`

---

## Accessibility and Performance Rules (2026 Baseline)

### Accessibility Checklist (WCAG 2.2 & APCA)
1. **Contrast Compliance**: Ensure text fields meet or exceed APCA `Lc 75` [UNVERIFIED] minimum for body text, and `Lc 45` [UNVERIFIED] for interface borders.
2. **Target Size (2.5.8)**: All interactive targets (buttons, links, checkboxes) must either be at least `24px` [UNVERIFIED] in dimensions or surrounded by space that keeps them at least `24px` [UNVERIFIED] away from other targets.
3. **Focus Not Obscured (2.4.11 / 2.4.12)**: Elements must not scroll out of view and leave their focus rings invisible. Ensure container layout bounds (`overflow: hidden`) do not slice off focus rings.

### Performance Optimization
1. **Reduce Layout Thrashing**: Always use logical size constraints (`min-block-size`) to avoid layout jumps when dynamic content loads.
2. **Hardware Accelerated Transitions**: Limit transitions to composite properties (`transform`, `opacity`, `filter`). Avoid transitions on `height` or `width` properties; use max-height CSS scaling combined with grid layouts (`grid-template-rows: 0fr -> 1fr`) to animate height safely.

---
