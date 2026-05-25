# Tailwind 4 — Design Tokens & @theme

## The @theme directive

`@theme` maps CSS custom property names to Tailwind utility class generation rules. Any `--color-*`, `--font-*`, `--spacing-*`, `--radius-*`, etc. token you declare becomes a utility class.

```css
@import "tailwindcss";

@theme {
  /* --color-{name} → text-{name}, bg-{name}, border-{name}, ring-{name}, … */
  --color-brand-500: oklch(60% 0.20 250);

  /* --font-{name} → font-{name} */
  --font-display: "Cal Sans", "Inter", sans-serif;

  /* --spacing-{n} → p-{n}, m-{n}, gap-{n}, inset-{n}, w-{n}, h-{n}, … */
  --spacing-18: 4.5rem;

  /* --radius-{name} → rounded-{name} */
  --radius-card: 0.75rem;

  /* --shadow-{name} → shadow-{name} */
  --shadow-soft: 0 2px 8px -1px oklch(0% 0 0 / 0.12);
}
```

---

## oklch color space — why and how

Tailwind 4's default palette uses oklch. Custom colors should too:

```
oklch(L% C H)
  L = lightness (0%–100%)
  C = chroma (saturation, 0–0.37 practical range)
  H = hue angle (0–360)
```

Benefits over hex/rgb:
- Equal perceptual lightness steps — `brand-100` through `brand-900` look evenly spaced
- Predictable manipulation — bumping L% changes brightness without hue shift
- P3 gamut by default — richer colors on wide-gamut displays (modern Macs, OLED phones)

### Full brand palette (50–900)

```css
@theme {
  --color-brand-50:  oklch(97% 0.02 250);
  --color-brand-100: oklch(93% 0.05 250);
  --color-brand-200: oklch(87% 0.09 250);
  --color-brand-300: oklch(80% 0.13 250);
  --color-brand-400: oklch(72% 0.17 250);
  --color-brand-500: oklch(60% 0.20 250);   /* primary */
  --color-brand-600: oklch(51% 0.19 250);
  --color-brand-700: oklch(42% 0.16 250);
  --color-brand-800: oklch(33% 0.13 250);
  --color-brand-900: oklch(24% 0.09 250);
  --color-brand-950: oklch(16% 0.06 250);
}
```

Change the hue angle (250 = blue-purple) to shift the entire palette to any hue while keeping step consistency.

---

## Semantic tokens — light and dark

Avoid using raw scale values (`bg-brand-500`) inside components. Use semantic aliases that swap on dark mode:

```css
@theme {
  /* semantic tokens */
  --color-background: oklch(100% 0 0);       /* white */
  --color-foreground: oklch(10% 0 0);        /* near-black */
  --color-muted:      oklch(96% 0 0);
  --color-muted-fg:   oklch(46% 0 0);
  --color-border:     oklch(90% 0 0);
  --color-card:       oklch(100% 0 0);
  --color-primary:    var(--color-brand-500);
  --color-primary-fg: oklch(100% 0 0);
}

.dark {
  --color-background: oklch(10% 0 0);
  --color-foreground: oklch(98% 0 0);
  --color-muted:      oklch(16% 0 0);
  --color-muted-fg:   oklch(64% 0 0);
  --color-border:     oklch(22% 0 0);
  --color-card:       oklch(13% 0 0);
  --color-primary:    var(--color-brand-400);  /* lighter for dark bg */
  --color-primary-fg: oklch(10% 0 0);
}
```

These generate `bg-background`, `text-foreground`, `bg-muted`, `text-muted-fg`, etc.

---

## Typography tokens

```css
@theme {
  /* font families */
  --font-sans:    "Inter", system-ui, sans-serif;
  --font-display: "Cal Sans", "Inter", sans-serif;
  --font-mono:    "JetBrains Mono", "Fira Code", monospace;

  /* font sizes — scale + line height as tuple */
  --text-xs:   0.75rem;   /* 12px */
  --text-sm:   0.875rem;  /* 14px */
  --text-base: 1rem;      /* 16px */
  --text-lg:   1.125rem;  /* 18px */
  --text-xl:   1.25rem;   /* 20px */
  --text-2xl:  1.5rem;    /* 24px */
  --text-3xl:  1.875rem;  /* 30px */
  --text-4xl:  2.25rem;   /* 36px */

  /* letter spacing */
  --tracking-tight: -0.025em;
  --tracking-wide:   0.025em;

  /* line heights */
  --leading-tight:  1.25;
  --leading-normal: 1.5;
  --leading-loose:  2;

  /* font weights */
  --font-weight-normal:    400;
  --font-weight-medium:    500;
  --font-weight-semibold:  600;
  --font-weight-bold:      700;
}
```

---

## Spacing tokens

```css
@theme {
  /* extend the default spacing scale */
  --spacing-4\.5: 1.125rem;   /* 18px */
  --spacing-18:   4.5rem;     /* 72px */
  --spacing-22:   5.5rem;     /* 88px */
  --spacing-88:   22rem;      /* 352px */
  --spacing-128:  32rem;      /* 512px */
}
```

Escaped dots in token names: `--spacing-4\.5` generates `p-4.5`, `m-4.5`, etc.

---

## Overriding default tokens

To replace a Tailwind default (not extend it):

```css
@theme default {
  /* replaces the built-in brand blue entirely */
  --color-blue-500: oklch(55% 0.22 230);
}
```

`@theme default {}` marks tokens as overrides, suppressing the built-in value.

---

## @tailwindcss/typography (prose plugin)

```bash
npm install @tailwindcss/typography
```

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
```

Use: `<article class="prose prose-lg dark:prose-invert max-w-none">`. Customization via `@theme`:

```css
@theme {
  --tw-prose-body:        var(--color-foreground);
  --tw-prose-headings:    var(--color-foreground);
  --tw-prose-links:       var(--color-primary);
  --tw-prose-code:        var(--color-foreground);
  --tw-prose-pre-bg:      var(--color-muted);
  --tw-prose-invert-body: var(--color-foreground); /* dark mode */
}
```

---

## Gotchas

- Raw values in `@theme` must be valid CSS values — `oklch(60% 0.20 250)` not a Tailwind scale name
- Nested CSS variables: `var(--color-brand-500)` works in `@theme` values
- Token names are case-sensitive and must match the expected namespace prefix to generate utilities
- `@theme` is processed at build time — dynamic values from JS are not supported (use inline styles for runtime values)
