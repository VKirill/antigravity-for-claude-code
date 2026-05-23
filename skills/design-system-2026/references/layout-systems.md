# Layout Systems (2026 Edition)

Implementing layout structures that scale intrinsically, adapt to component containment, and eliminate viewport-dependent breakpoints.

---

> [!NOTE]
> For integration with color systems, see [oklch_color_systems_2026.md](oklch_color_systems_2026.md). For alignment with fluid font scales and line lengths, cross-reference [typography-systems.md](typography-systems.md).

---

## 1. Bento Grid Architecture

The "Bento Grid" relies on a 12-column CSS grid where items span varying tracks, wrapping cleanly using fractional columns and aspect ratios to preserve geometric cohesion.

### Bento Spacing Parameters
*   **Item Gap**: `clamp(1rem, 0.95rem + 0.25vw, 1.25rem)` (fluidly scaling).
*   **Item Padding**: `clamp(1rem, 0.85rem + 0.5vw, 1.5rem)` (providing generous breathing room).
*   **Corner Radius**: `clamp(1rem, 0.95rem + 0.25vw, 1.25rem)` (matching the outer grid gap to maintain concentric rhythm).

### Grid Configuration CSS
```css
.bento-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: var(--space-md);
}

.bento-item {
  border-radius: var(--radius-md);
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

/* Explicit span assignments */
.span-large  { grid-column: span 8; }
.span-medium { grid-column: span 4; }
.span-small  { grid-column: span 3; }

/* Responsive reflow triggers */
@media (max-width: 1024px) {
  .span-large  { grid-column: span 12; }
  .span-medium { grid-column: span 6; }
}
@media (max-width: 640px) {
  .bento-grid > * {
    grid-column: span 12 !important;
  }
}
```

---

## 2. Asymmetric Grids & CSS Subgrid

Asymmetric editorial layouts require nested cards to align their headers, paragraphs, and CTAs to the parent grid structure, regardless of content variations.

### Subgrid Rows Alignment
CSS Subgrid (baseline standard since late 2023) allows a child element to inherit the row or column track definitions of its parent grid container.

```css
/* Parent Grid Container */
.editorial-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  grid-template-rows: auto auto auto; /* 3 explicit vertical rows */
  gap: var(--space-md);
}

/* Nested Grid Card aligning to rows */
.editorial-card-wrapper {
  grid-column: span 1;
  grid-row: span 3; /* spans all 3 parent rows */
  
  display: grid;
  grid-template-rows: subgrid; /* inherits rows directly from .editorial-grid */
  gap: var(--space-2xs);
}
```

---

## 3. Container Queries & Component Responsiveness

Container queries shift responsiveness from the viewport (`@media`) to the parent element (`@container`). This enables components to adapt their layout dynamically depending on where they are placed in the DOM (e.g. sidebar vs main panel).

### Container Query CSS
```css
/* 1. Define Container Context */
.card-container {
  container-type: inline-size; /* monitors inline width changes */
  container-name: card;
}

/* 2. Style Default Mobile-first View */
.cq-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-sm);
}

/* 3. Apply Container Query Thresholds */
@container card (min-width: 480px) {
  .cq-card {
    flex-direction: row; /* shifts to horizontal layout */
    align-items: center;
    gap: var(--space-md);
    padding: calc(3cqi + 1rem); /* scales padding with container width units (cqi) */
  }
}
```

---

## 4. Fluid Spacing Scale (clamp-based)

To avoid erratic page layouts, padding, margins, and gaps scale proportionally with the viewport between $320\text{px}$ and $1440\text{px}$.

### Spacing Tokens Formula:
$$\text{Spacing Step} = \text{clamp}(S_{min}, \text{Intercept} + \text{Slope} \times 100\text{vw}, S_{max})$$

```css
:root {
  --space-3xs: clamp(0.25rem, 0.2143rem + 0.1786vw, 0.375rem);   /* 4px -> 6px */
  --space-2xs: clamp(0.5rem, 0.4643rem + 0.1786vw, 0.625rem);    /* 8px -> 10px */
  --space-xs: clamp(0.75rem, 0.7143rem + 0.1786vw, 0.875rem);    /* 12px -> 14px */
  --space-sm: clamp(1rem, 0.9286rem + 0.3571vw, 1.25rem);       /* 16px -> 20px */
  --space-md: clamp(1.5rem, 1.3571rem + 0.7143vw, 2rem);        /* 24px -> 32px */
  --space-lg: clamp(2rem, 1.7143rem + 1.4286vw, 3rem);          /* 32px -> 48px */
}
```

---

## 5. CSS `:has()` Layout Selection

The `:has()` relational selector allows styling parent nodes based on properties or elements present in their children or adjacent siblings.

### Sibling Adaptations (Quantity Queries)
Configure grid layouts to adjust column allocations automatically based on the count of child nodes:

```css
/* Standard grid: 2 columns */
.auto-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-md);
}

/* Sibling count adapt: if container has 4 or more children, change to 4 columns */
.auto-grid:has(> :nth-child(4)) {
  grid-template-columns: repeat(4, 1fr);
}
```

### Parent Borders Conditional Styling
```css
/* Color border changes on card if an active badge exists */
.status-card {
  border: 1px solid var(--border-subtle);
}
.status-card:has(.badge-active) {
  border-left: 4px solid var(--color-success-500);
}
```

---

## 6. Intrinsic Layouts (Every Layout Models)

Intrinsic design uses browser layout algorithms (flexbox, wrapping, auto-margins) to layout components instead of hardcoded media breakpoints.

### 1. The Switcher
Lays items horizontally, but switches to a vertical stack when viewport width falls below a threshold limit.
```css
.switcher {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
}

.switcher > * {
  flex-grow: 1;
  flex-basis: calc((40rem - 100%) * 999); /* Switches to vertical below 40rem */
}
```

### 2. The Sidebar
Creates a sidebar column that wraps below the main content area when space is constrained.
```css
.sidebar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
}

.sidebar-side {
  flex-grow: 1;
  flex-basis: 250px; /* Sidebar snaps width */
}

.sidebar-main {
  flex-grow: 999;
  flex-basis: calc(50% - var(--space-md)); /* takes remaining room */
}
```

---

## 7. Media Scale (Aspect Ratio & Object Fit)

To prevent Cumulative Layout Shift (CLS) when loading image/video elements, containers must explicitly state an aspect ratio, and contents must crop cleanly without distortion.

```css
.media-container {
  aspect-ratio: 16 / 9; /* Reservates structural spacing prior to load */
  overflow: hidden;
  border-radius: var(--radius-md);
  width: 100%;
}

.media-container img,
.media-container video {
  width: 100%;
  height: 100%;
  object-fit: cover; /* Crops media without stretching or skewing */
  object-position: center;
}
```

---

## 8. Deterministic Layout Audits

### 1. Horizontal Overflow Inspection Script
Run this script inside browser console audits or Puppeteer CI test runs to catch horizontal page breaks:

```javascript
// CI / Console check for layout overflows
function inspectOverflow() {
  const elements = document.querySelectorAll('*');
  let hasOverflow = false;
  
  elements.forEach(el => {
    if (el.offsetWidth > document.documentElement.offsetWidth) {
      console.error('❌ Overflowing Element detected:', el);
      hasOverflow = true;
    }
  });
  
  if (!hasOverflow) {
    console.log('✅ PASS: No horizontal overflows detected.');
  }
}
```

---

## 9. Layout Antipatterns

1. **Relying solely on viewport media queries (`@media (max-width)`)**
   *   *Why*: Brittle. Component layouts will break if placed in narrow columns like sidebars. Use `@container` queries instead to ensure design robustness.
2. **Declaring layout dimensions via fixed heights (`height: 400px`)**
   *   *Why*: Causes overflow bugs when dynamic text wraps or language translations lengthen strings. Always use `min-height` or let content determine layout size.
3. **Hardcoding gaps inside inner flex containers**
   *   *Why*: Hardcoded margins break layout rhythm. Use CSS `gap` properties inside standard layout containers or the Intrinsic Stack primitive.
