# Component Pattern: cn() + conditional classes

## The problem

Tailwind generates utility classes statically. When you build classes dynamically, two problems arise:

1. **Missing classes** — `bg-${color}-500` won't be scanned, so the class won't be generated
2. **Class conflicts** — `px-2 px-4` produces unpredictable results without `tailwind-merge`

The `cn()` helper solves both with `clsx` (logical conditions) + `tailwind-merge` (deduplication).

---

## Setup

```bash
npm install clsx tailwind-merge
```

```ts
// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

## Basic component

```tsx
// components/ui/button.tsx
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
}

export function Button({
  variant = "default",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        // Base styles — always applied
        "inline-flex items-center justify-center rounded-md font-medium",
        "transition-colors focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",

        // Variant styles — one group, mutually exclusive
        variant === "default"     && "bg-primary text-primary-fg hover:bg-primary/90",
        variant === "outline"     && "border border-border bg-transparent hover:bg-muted hover:text-foreground",
        variant === "ghost"       && "hover:bg-muted hover:text-foreground",
        variant === "destructive" && "bg-destructive text-destructive-fg hover:bg-destructive/90",

        // Size styles — one group, mutually exclusive
        size === "sm" && "h-8 px-3 text-sm",
        size === "md" && "h-10 px-4",
        size === "lg" && "h-12 px-6 text-lg",

        // External overrides — always last so they win
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
```

Usage:
```tsx
<Button>Default</Button>
<Button variant="outline" size="sm">Small Outline</Button>
<Button variant="ghost" className="w-full">Full Width Ghost</Button>
```

---

## With class-variance-authority (CVA)

CVA generates type-safe variant maps that work with `cn()`:

```bash
npm install class-variance-authority
```

```tsx
// components/ui/badge.tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:     "bg-primary text-primary-fg",
        secondary:   "bg-secondary text-secondary-fg",
        destructive: "bg-destructive text-destructive-fg",
        outline:     "border border-border text-foreground",
        success:     "bg-success text-success-fg",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
```

---

## With container queries

```tsx
// components/card.tsx
import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  compact?: boolean;
}

export function Card({ compact, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "@container rounded-xl border bg-card text-card-fg",
        compact ? "p-3" : "p-6",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col @sm:flex-row gap-4",
        className
      )}
      {...props}
    />
  );
}
```

---

## Merging behavior reference

`tailwind-merge` deduplicates by class group (last one wins):

```ts
cn("px-2", "px-4")            // → "px-4"
cn("text-sm", "text-lg")      // → "text-lg"
cn("bg-red-500", "bg-blue-500") // → "bg-blue-500"
cn("font-bold", "font-semibold") // → "font-semibold"
cn("hover:bg-red-500", "hover:bg-blue-500") // → "hover:bg-blue-500"

// Additive (different groups — both kept)
cn("px-4", "py-4")            // → "px-4 py-4"
cn("text-sm", "font-bold")    // → "text-sm font-bold"

// Falsy values dropped
cn("base", false && "skipped", null, undefined, "") // → "base"
```

---

## Common anti-patterns

```tsx
// Never — class string interpolation breaks scanning
const color = isActive ? "blue" : "gray";
<div className={`text-${color}-500`} />

// Correct — full class names must appear in source
<div className={cn(isActive ? "text-blue-500" : "text-gray-500")} />

// Never — string concat without tailwind-merge creates conflicts
<div className={`base-styles ${override}`} />

// Correct — use cn() for any merge scenario
<div className={cn("base-styles", override)} />

// Never — conditionally applying only part of a shorthand
<div className={cn("p-4", isCompact && "py-2")} />
// ^ py-2 won't override p-4 — tailwind-merge resolves px/py/p as same group

// Correct — apply the full shorthand you intend
<div className={isCompact ? "px-4 py-2" : "p-4"} />
```
