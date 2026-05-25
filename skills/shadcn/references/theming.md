# shadcn/ui — Theming

## How theming works

shadcn theming is built entirely on CSS custom properties (variables). Components reference semantic tokens like `bg-background`, `text-foreground`, `bg-primary` — these map to CSS variables, not hardcoded colors. Swap the variable values and the entire app re-themes with zero component edits.

The variables use HSL **channel notation** — no `hsl()` wrapper — so Tailwind can apply opacity modifiers:

```css
/* Correct — channel notation */
--primary: 221.2 83.2% 53.3%;

/* Wrong — full hsl() value breaks opacity modifiers */
--primary: hsl(221.2, 83.2%, 53.3%);
```

Then in Tailwind: `bg-primary/50` (50% opacity) works correctly with channel notation.

## Tailwind v4 setup

Tailwind v4 removes `tailwind.config.js` colors. Use `@theme inline` in your CSS:

```css
/* app/globals.css */
@import "tailwindcss";

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
    --sidebar-background: 0 0% 98%;
    --sidebar-foreground: 240 5.3% 26.1%;
    --sidebar-primary: 240 5.9% 10%;
    --sidebar-primary-foreground: 0 0% 98%;
    --sidebar-accent: 240 4.8% 95.9%;
    --sidebar-accent-foreground: 240 5.9% 10%;
    --sidebar-border: 220 13% 91%;
    --sidebar-ring: 217.2 91.2% 59.8%;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 48%;
    --sidebar-background: 240 5.9% 10%;
    --sidebar-foreground: 240 4.8% 95.9%;
    --sidebar-primary: 224.3 76.3% 48%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 240 3.7% 15.9%;
    --sidebar-accent-foreground: 240 4.8% 95.9%;
    --sidebar-border: 240 3.7% 15.9%;
    --sidebar-ring: 217.2 91.2% 59.8%;
  }
}

@theme inline {
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-card: hsl(var(--card));
  --color-card-foreground: hsl(var(--card-foreground));
  --color-popover: hsl(var(--popover));
  --color-popover-foreground: hsl(var(--popover-foreground));
  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
  --color-secondary: hsl(var(--secondary));
  --color-secondary-foreground: hsl(var(--secondary-foreground));
  --color-muted: hsl(var(--muted));
  --color-muted-foreground: hsl(var(--muted-foreground));
  --color-accent: hsl(var(--accent));
  --color-accent-foreground: hsl(var(--accent-foreground));
  --color-destructive: hsl(var(--destructive));
  --color-destructive-foreground: hsl(var(--destructive-foreground));
  --color-border: hsl(var(--border));
  --color-input: hsl(var(--input));
  --color-ring: hsl(var(--ring));
  --color-sidebar-background: hsl(var(--sidebar-background));
  --color-sidebar-foreground: hsl(var(--sidebar-foreground));
  --color-sidebar-primary: hsl(var(--sidebar-primary));
  --color-sidebar-primary-foreground: hsl(var(--sidebar-primary-foreground));
  --color-sidebar-accent: hsl(var(--sidebar-accent));
  --color-sidebar-accent-foreground: hsl(var(--sidebar-accent-foreground));
  --color-sidebar-border: hsl(var(--sidebar-border));
  --color-sidebar-ring: hsl(var(--sidebar-ring));
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}
```

## Dark mode: class strategy

shadcn uses the `class` strategy for dark mode — add `class="dark"` to the `<html>` element.

### Next.js App Router with next-themes

```bash
npm install next-themes
```

```tsx
// app/providers.tsx
"use client"
import { ThemeProvider } from "next-themes"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </ThemeProvider>
  )
}
```

```tsx
// app/layout.tsx
import { Providers } from "./providers"

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

```tsx
// components/theme-toggle.tsx
"use client"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Moon, Sun } from "lucide-react"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  )
}
```

## CSS variable semantic map

| Variable | Semantic usage |
|---|---|
| `--background` / `--foreground` | Page background + default text |
| `--card` / `--card-foreground` | Card surfaces |
| `--popover` / `--popover-foreground` | Dropdown/tooltip/popover surfaces |
| `--primary` / `--primary-foreground` | Primary buttons, active states, links |
| `--secondary` / `--secondary-foreground` | Secondary buttons, subtle backgrounds |
| `--muted` / `--muted-foreground` | Disabled states, placeholder text, subtle labels |
| `--accent` / `--accent-foreground` | Hover state for neutral elements |
| `--destructive` / `--destructive-foreground` | Delete, error, danger actions |
| `--border` | Borders on inputs, cards, separators |
| `--input` | Input field border (typically same as `--border`) |
| `--ring` | Focus ring color |
| `--radius` | Base border-radius; scaled for sm/md/lg/xl |
| `--sidebar-*` | Sidebar navigation component tokens |

## Customizing the brand color

To change the primary color (brand color) for your app:

1. Find the HSL values for your brand color
2. Update `--primary` in `:root` and `--primary` in `.dark`
3. Ensure `--primary-foreground` has sufficient contrast (WCAG AA = 4.5:1)

```css
:root {
  /* Example: indigo brand */
  --primary: 239 84% 67%;        /* indigo-500 */
  --primary-foreground: 0 0% 100%;
}
.dark {
  --primary: 239 84% 73%;        /* slightly lighter for dark mode */
  --primary-foreground: 0 0% 100%;
}
```

## Base color presets (what `baseColor` does)

The `baseColor` in `components.json` controls the neutral gray scale: `--background`, `--foreground`, `--border`, `--input`, `--muted`, etc.

| Base color | Feel | Best for |
|---|---|---|
| `zinc` | Cool, modern, neutral | SaaS, dashboards |
| `slate` | Slightly blue-tinted | Enterprise, technical |
| `stone` | Warm gray | Content, editorial |
| `gray` | Pure neutral | Flexible, universal |
| `neutral` | Same as gray | Minimal apps |

Changing `baseColor` after init requires regenerating all components with `npx shadcn add --all --overwrite`.

## Radius customization

`--radius` drives the base radius; components use `calc()` offsets:

```css
--radius: 0.5rem;   /* default — rounded */
--radius: 0.25rem;  /* tighter — more corporate */
--radius: 0.75rem;  /* rounder — more friendly */
--radius: 0rem;     /* square — brutalist */
```

Components reference `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl` which compute from `--radius`.

## Tailwind v3 setup (legacy)

If using Tailwind v3 (before v4 migration):

```js
// tailwind.config.js
module.exports = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        // ... rest of tokens
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
}
```

With Tailwind v4, this config is replaced by `@theme inline` in CSS (shown above).
