# Tailwind CSS Integration (2026 Edition)

Integration guide for mapping modern design system tokens to Tailwind CSS v4 using the CSS-first configuration architecture.

> [!NOTE]
> This integration translates tokens mapped from DTCG files into Tailwind configurations.
> - For core tokens definition and compilations, refer to [design-tokens-architecture.md](design-tokens-architecture.md).
> - For color parameters and semantic `light-dark()` setup, refer to [oklch_color_systems_2026.md](oklch_color_systems_2026.md).

---

## Tailwind CSS v4: CSS-first Configuration

Tailwind CSS v4 replaces the JavaScript configuration file (`tailwind.config.ts`) with a CSS-first approach. All themes, custom keyframes, and utilities are declared directly in your main CSS file inside the `@theme` block.

### Global CSS File (`styles/global.css`)

```css
@import "tailwindcss";

@layer base {
  :root {
    /* Native color-scheme declaration triggers light-dark() evaluation */
    color-scheme: light dark;

    /* Semantic Tokens (Mapped from Tier 2 in DTCG) */
    --bg-default: light-dark(oklch(0.985 0.001 255), oklch(0.10 0.001 255));
    --bg-subtle: light-dark(oklch(0.96 0.001 255), oklch(0.18 0.001 255));
    --bg-muted: light-dark(oklch(0.89 0.001 255), oklch(0.30 0.001 255));
    --bg-overlay: light-dark(oklch(0.985 0.001 255), oklch(0.18 0.001 255));

    --text-default: light-dark(oklch(0.10 0.001 255), oklch(0.985 0.001 255));
    --text-muted: light-dark(oklch(0.50 0.001 255), oklch(0.80 0.001 255));
    --text-inverse: light-dark(oklch(0.985 0.001 255), oklch(0.10 0.001 255));

    --brand-solid: light-dark(oklch(0.60 0.18 255), oklch(0.50 0.1476 255));
    --brand-subtle: light-dark(oklch(0.96 0.008 255), oklch(0.18 0.038 255));
    --brand-text: light-dark(oklch(0.50 0.16 255), oklch(0.80 0.0623 255));
    --brand-hover: light-dark(oklch(0.50 0.16 255), oklch(0.40 0.1009 255));

    --border-default: light-dark(oklch(0.80 0.001 255), oklch(0.40 0.001 255));
    --border-subtle: light-dark(oklch(0.89 0.001 255), oklch(0.30 0.001 255));
    
    --radius-base: 0.5rem [UNVERIFIED];
  }
}

/* Tailwind v4 Theme Configuration overrides config.ts */
@theme {
  --color-background: var(--bg-default);
  --color-foreground: var(--text-default);

  /* Semantic palette overrides */
  --color-primary: var(--brand-solid);
  --color-primary-foreground: var(--text-inverse);

  --color-secondary: var(--bg-muted);
  --color-secondary-foreground: var(--text-default);

  --color-muted: var(--bg-subtle);
  --color-muted-foreground: var(--text-muted);

  --color-accent: var(--bg-subtle);
  --color-accent-foreground: var(--text-default);

  --color-destructive: oklch(0.60 0.18 25) [UNVERIFIED];
  --color-destructive-foreground: var(--text-inverse);

  --color-border: var(--border-default);
  --color-ring: var(--brand-solid);

  /* Radius overrides */
  --radius-lg: var(--radius-base);
  --radius-md: calc(var(--radius-base) - 2px) [UNVERIFIED];
  --radius-sm: calc(var(--radius-base) - 4px) [UNVERIFIED];

  /* Animations & Keyframes */
  --animate-accordion-down: accordion-down 0.2s [UNVERIFIED] ease-out;
  --animate-accordion-up: accordion-up 0.2s [UNVERIFIED] ease-out;

  @keyframes accordion-down {
    from { height: 0; }
    to { height: var(--radix-accordion-content-height); }
  }
  @keyframes accordion-up {
    from { height: var(--radix-accordion-content-height); }
    to { height: 0; }
  }
}
```

---

## Modern Tailwind v4 Features

### 1. Built-in Container Queries
In Tailwind v4, container queries are supported out-of-the-box without plugins. Define a parent as a container and styles children relative to it.

```tsx
export function ResponsiveCard() {
  return (
    <div className="@container w-full">
      <div className="flex flex-col @md:flex-row p-6 bg-background border border-border rounded-lg">
        <div className="w-full @md:w-1/3">
          {/* Responsive aspect ratio */}
          <div className="aspect-video @md:aspect-square bg-muted rounded" />
        </div>
        <div className="flex-1 pl-0 @md:pl-6 pt-4 @md:pt-0">
          <h3 className="text-lg font-bold text-foreground">Container Query Card</h3>
          <p className="text-muted-foreground text-sm">Resizes based on parent container width, not the viewport.</p>
        </div>
      </div>
    </div>
  );
}
```

### 2. Parent-child state styling with `:has()`
Use native `:has()` modifiers in Tailwind to style wrappers.

```tsx
export function FormField() {
  return (
    /* Styles the container when the input receives focus-visible outline */
    <div className="flex flex-col p-4 border border-border rounded-md transition-all has-[:focus-visible]:border-primary">
      <label className="text-xs text-muted-foreground">Username</label>
      <input 
        type="text" 
        className="bg-transparent border-0 outline-none text-foreground text-sm pt-1"
        placeholder="johndoe"
      />
    </div>
  );
}
```

### 3. Native Zero-Class Dark Mode
Because semantic variables leverage CSS `light-dark()`, dark mode is activated automatically by the browser based on system preferences. Toggling manually is handled via JavaScript by altering `color-scheme` or class mappings.

```typescript
function toggleTheme(isDark: boolean) {
  // Update class for legacy selector-based configurations
  document.documentElement.classList.toggle('dark', isDark);
  
  // Set the document color scheme. This triggers the native light-dark() evaluation
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
}
```

---

## Component Utility Definitions (`@utility`)

In Tailwind v4, registering custom components is done using the `@utility` directive instead of `@layer components` or plugin definitions.

```css
@utility btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--ref-font-size-sm, 0.875rem);
  font-weight: 500 [UNVERIFIED];
  min-block-size: 40px [UNVERIFIED];
  padding-inline: 16px [UNVERIFIED];
  padding-block: 8px [UNVERIFIED];
  border-radius: var(--radius-md);
  border: 1px [UNVERIFIED] solid transparent;
  cursor: pointer;
  
  /* Focus rings (WCAG 2.2 target size and visibility) */
  &:focus-visible {
    outline: 2px [UNVERIFIED] solid var(--color-ring);
    outline-offset: 2px [UNVERIFIED];
  }

  /* Disable transitions on systems that prefer reduced motion */
  @media (prefers-reduced-motion: reduce) {
    transition: none !important;
  }
}

@utility btn-default {
  background-color: var(--color-primary);
  color: var(--color-primary-foreground);
  
  &:hover:not(:disabled) {
    background-color: light-dark(oklch(0.50 0.16 255), oklch(0.40 0.1009 255));
  }
}
```

---

## Radix & shadcn/ui Compatibility

To integrate shadcn/ui components (which use `@radix-ui` primitives), style animations and theme attributes inside the `@theme` block.

```css
@theme {
  /* Accordion and modal animations mapping */
  --animate-accordion-down: accordion-down 0.2s [UNVERIFIED] ease-out;
  --animate-accordion-up: accordion-up 0.2s [UNVERIFIED] ease-out;
}
```

Radix elements rely heavily on `data-*` states (e.g. `data-state="open"`). Style these using Tailwind state variants or standard CSS selectors nested in `@utility`:

```css
@utility dropdown-content {
  background-color: var(--color-background);
  border: 1px [UNVERIFIED] solid var(--color-border);
  box-shadow: var(--shadow-md) [UNVERIFIED];
  opacity: 0;
  transition: opacity 150ms [UNVERIFIED] ease;

  &[data-state="open"] {
    opacity: 1;
  }
}
```
