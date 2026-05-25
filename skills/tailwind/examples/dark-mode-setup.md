# Dark Mode Setup — Tailwind 4

Two strategies for dark mode in Tailwind 4. Choose one per project.

---

## Strategy A: Class-based (`.dark` on `<html>`)

Best for: user-controlled dark mode, persisted preference, SSR hydration safety.

### 1. Declare the @variant

```css
/* globals.css */
@import "tailwindcss";

@variant dark (&:is(.dark *));

@theme {
  /* semantic tokens — light defaults */
  --color-background: oklch(100% 0 0);
  --color-foreground: oklch(10%  0 0);
}

/* dark mode overrides */
.dark {
  --color-background: oklch(10%  0 0);
  --color-foreground: oklch(98%  0 0);
}
```

### 2. Toggle from JavaScript

```ts
// lib/theme.ts
type Theme = "light" | "dark" | "system";

export function applyTheme(theme: Theme) {
  const html = document.documentElement;
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  html.classList.toggle("dark", isDark);
}

export function getStoredTheme(): Theme {
  return (localStorage.getItem("theme") as Theme) ?? "system";
}

export function setTheme(theme: Theme) {
  localStorage.setItem("theme", theme);
  applyTheme(theme);
}

// Call on first load to prevent flash
applyTheme(getStoredTheme());
```

### 3. React toggle hook

```tsx
// hooks/use-theme.ts
import { useEffect, useState } from "react";
import { getStoredTheme, setTheme, type Theme } from "@/lib/theme";

export function useTheme() {
  const [theme, setLocalTheme] = useState<Theme>(getStoredTheme);

  useEffect(() => {
    const handler = (e: MediaQueryListEvent) => {
      if (theme === "system") {
        document.documentElement.classList.toggle("dark", e.matches);
      }
    };
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  function change(next: Theme) {
    setLocalTheme(next);
    setTheme(next);
  }

  return { theme, setTheme: change };
}
```

### 4. Prevent flash on initial load (Next.js)

```tsx
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var t = localStorage.getItem('theme') || 'system';
                var d = document.documentElement;
                if (t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  d.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

### 5. Use dark: in components

```tsx
<div className="bg-background text-foreground">
  <p className="text-muted-fg dark:text-muted-fg">Subtitle</p>
  <button className="bg-primary text-primary-fg hover:bg-primary/90">
    Action
  </button>
</div>
```

---

## Strategy B: System preference only (no JS toggle)

Best for: documentation sites, marketing pages, developer tools.

### 1. No @variant needed — use @media directly

```css
/* globals.css */
@import "tailwindcss";

@theme {
  --color-background: oklch(100% 0 0);
  --color-foreground: oklch(10%  0 0);
  --color-muted:      oklch(96%  0 0);
}

@layer base {
  @media (prefers-color-scheme: dark) {
    :root {
      --color-background: oklch(10%  0 0);
      --color-foreground: oklch(98%  0 0);
      --color-muted:      oklch(16%  0 0);
    }
  }
}
```

### 2. No JavaScript required

The browser handles it automatically. `bg-background` picks up the right token based on system preference. No `dark:` prefix needed in HTML — the CSS variable already contains the correct value.

### 3. When you still need dark: variant

If you have a component that should behave differently in dark mode even with Strategy B, add the media-based @variant:

```css
@variant dark (@media (prefers-color-scheme: dark));
```

```html
<img class="dark:invert" src="/logo.svg" />
```

---

## Comparison

| | Strategy A (class) | Strategy B (media) |
|---|---|---|
| User can toggle | Yes | No |
| Requires JS | Yes (for toggle) | No |
| Flash prevention | Needs inline script | None needed |
| Works with SSR | Yes (with suppressHydrationWarning) | Always |
| Recommendation | Apps with user preference | Docs/marketing sites |

---

## Common gotcha: semantic tokens vs raw classes

```tsx
// Fragile — must remember dark: on every dark-mode-aware element
<div className="bg-white dark:bg-gray-950 text-gray-900 dark:text-white">

// Robust — tokens swap automatically
<div className="bg-background text-foreground">
```

Define semantic tokens once in CSS, use `bg-background` everywhere. The dark swap is centralized in `.dark {}` or `@media`.
