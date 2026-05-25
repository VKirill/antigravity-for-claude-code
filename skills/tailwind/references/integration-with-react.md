# Tailwind 4 — React Integration

## Setup: Vite + React

```bash
npm create vite@latest my-app -- --template react-ts
cd my-app
npm install tailwindcss @tailwindcss/vite
```

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
});
```

```css
/* src/index.css */
@import "tailwindcss";

@theme {
  --color-brand-500: oklch(60% 0.20 250);
  --font-sans: "Inter", system-ui, sans-serif;
}
```

```tsx
// src/main.tsx
import "./index.css";
```

---

## Setup: Next.js 15+ App Router

```bash
npx create-next-app@latest --tailwind
# Tailwind 4 is auto-configured by the Next.js 15 scaffold
```

Manual addition to existing project:
```bash
npm install tailwindcss @tailwindcss/vite
```

```css
/* app/globals.css */
@import "tailwindcss";
```

```ts
// next.config.ts — no changes needed; Turbopack handles @tailwindcss/vite
```

---

## The cn() helper

Every Tailwind + React project should have a `cn()` utility. It combines `clsx` (conditional classes) and `tailwind-merge` (deduplication of conflicting classes):

```ts
// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

```bash
npm install clsx tailwind-merge
```

### Why tailwind-merge matters

Without it, conflicting classes silently produce the wrong output:

```tsx
// Without tailwind-merge:
// "px-4 px-8" → only one applies (browser picks last), looks like px-8
// but semantics of consumer expectation is px-8 wins

// With cn():
cn("px-4", "px-8")       // → "px-8"    (last px-* wins)
cn("text-sm", "text-lg") // → "text-lg" (last text-* wins)
cn("bg-blue-500 text-white", isPrimary && "bg-brand-500") // → safe merge
```

### Usage patterns

```tsx
// Conditional classes
<button className={cn(
  "rounded-md px-4 py-2 font-medium transition-colors",
  variant === "primary" && "bg-brand-500 text-white hover:bg-brand-600",
  variant === "ghost"   && "bg-transparent hover:bg-muted",
  disabled && "opacity-50 cursor-not-allowed",
  className  // allow callers to override
)}>

// With CVA (class-variance-authority)
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  "inline-flex items-center rounded-md font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-brand-500 text-white hover:bg-brand-600",
        outline: "border border-border bg-transparent hover:bg-muted",
        ghost:   "hover:bg-muted hover:text-foreground",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-lg",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  }
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>
  & VariantProps<typeof buttonVariants>
  & { className?: string };

export function Button({ variant, size, className, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
```

---

## shadcn/ui integration

shadcn/ui is a collection of copy-paste components built on Radix UI + Tailwind CSS. It reads design tokens from CSS variables defined in `globals.css` (or `app/globals.css`).

### Initialize shadcn in a Tailwind 4 project

```bash
npx shadcn@latest init
```

The `init` command:
1. Writes `components.json` with paths and aliases
2. Adds the required CSS variable structure to your globals file
3. Creates `src/lib/utils.ts` with the `cn()` helper

### What shadcn adds to globals.css

```css
@import "tailwindcss";

@layer base {
  :root {
    --background: oklch(100% 0 0);
    --foreground: oklch(10% 0 0);
    --card: oklch(100% 0 0);
    --card-foreground: oklch(10% 0 0);
    --primary: oklch(60% 0.20 250);
    --primary-foreground: oklch(100% 0 0);
    --muted: oklch(96% 0 0);
    --muted-foreground: oklch(46% 0 0);
    --border: oklch(90% 0 0);
    --radius: 0.5rem;
  }

  .dark {
    --background: oklch(10% 0 0);
    --foreground: oklch(98% 0 0);
    /* … */
  }
}
```

### Adding components

```bash
npx shadcn@latest add button
npx shadcn@latest add dialog
npx shadcn@latest add input
```

Components are written to `src/components/ui/`. They use `cn()` internally and accept `className` for extension.

### Customizing shadcn tokens

Edit the `--primary`, `--radius`, etc. variables in your CSS. shadcn maps them to Tailwind 4 `@theme` tokens via the `oklch()` color space. Change the hue angle in `--primary` to rebrand the entire component set.

---

## Class composition patterns

### Prefer semantic tokens over raw scale in components

```tsx
// Less maintainable:
<div className="bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-50">

// More maintainable (swaps in dark mode via CSS):
<div className="bg-background text-foreground">
```

### Forward className for composability

```tsx
// Always accept and merge external className
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card text-card-foreground shadow-sm",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
```

### Avoid dynamic class construction

```tsx
// Never — Tailwind's scanner won't find these at build time
const color = isDanger ? "red" : "blue";
<div className={`bg-${color}-500`} />

// Always — full class names visible in source
<div className={cn(isDanger ? "bg-red-500" : "bg-blue-500")} />
```

---

## Performance: tailwind-merge configuration

For large projects, configure `tailwind-merge` with your custom class groups to ensure correct precedence:

```ts
import { extendTailwindMerge } from "tailwind-merge";

export const twMergeConfig = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["brand-xs", "brand-sm", "brand-lg"] }],
      "bg-color":  [{ bg: ["brand-50", "brand-100", /* … */ "brand-900"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMergeConfig(clsx(inputs));
}
```

Without this, custom tokens won't be deduplicated by `tailwind-merge` — they'll accumulate instead of replacing each other.
