# Tokens

CSS custom properties as the single source of truth for color, space, type, radius, shadow, motion, z-index. No literal values in components. Ever.

## Naming convention: semantic, not literal

✅ **Semantic** (says what it does):
```
--color-fg                  /* foreground text */
--color-fg-muted
--color-bg                  /* page background */
--color-surface             /* card / panel background */
--color-border
--color-border-hover
--color-accent              /* the one brand color */
--color-accent-hover
--color-success
--color-danger
--color-warning
--space-1   --space-2   --space-3   --space-4   ...
--fs-xs     --fs-sm     --fs-base   --fs-lg     ...
--radius-sm --radius-md --radius-lg
--shadow-sm --shadow-md --shadow-lg
--duration-fast  --duration-normal  --duration-slow
--z-dropdown --z-modal --z-tooltip
```

❌ **Literal** (says what it looks like — breaks when you rebrand):
```
--gray-700              /* what does this even mean in a card? */
--blue-500              /* primary or info or both? */
--font-14
--space-16px            /* what about 14px? */
--shadow-small          /* what scope of small? */
```

Rule: when you rebrand from a gray-blue scheme to a warm-beige scheme, you should be able to change `tokens.css` and never touch a component. Semantic names allow this. Literal names don't.

## Color: use OKLCH

OKLCH is a perceptually uniform color space. Same lightness number = same perceived brightness, across all hues. This means accessibility math (contrast checks) is reliable, and dark theme generation is trivial.

Browser support: Safari 15.4+, Chrome 111+, Firefox 113+ — universal since 2023.

```css
:root {
  /* Base scale — light theme */
  --color-bg:        oklch(99% 0.003 250);
  --color-surface:   oklch(97% 0.005 250);
  --color-fg:        oklch(18% 0.012 250);
  --color-fg-muted:  oklch(50% 0.015 250);
  --color-border:    oklch(92% 0.008 250);

  /* Brand: one accent color, full chroma */
  --color-accent:        oklch(62% 0.22  285);
  --color-accent-hover:  oklch(54% 0.24  285);
  --color-accent-fg:     oklch(99% 0.005 285);   /* text on accent bg */

  /* Semantic */
  --color-danger:        oklch(58% 0.20 25);
  --color-danger-hover:  oklch(50% 0.22 25);
  --color-success:       oklch(60% 0.18 145);
  --color-success-hover: oklch(52% 0.18 145);
  --color-warning:       oklch(75% 0.16 80);
}
```

### Reading OKLCH

`oklch(LIGHTNESS CHROMA HUE)`:

- **Lightness**: 0% (black) to 100% (white). Perceptually linear.
- **Chroma**: 0 (neutral) to ~0.4 (max saturation). Practical range 0.005–0.25.
- **Hue**: 0–360°. 0 = red, 60 = yellow, 120 = green, 180 = cyan, 240 = blue, 300 = magenta.

Tip: hold hue+chroma constant, vary lightness — you get accessible color pairs. `oklch(20% 0.01 250)` text on `oklch(99% 0.01 250)` background = WCAG AAA contrast automatically.

### Theming

Light/dark in two paired blocks:

```css
:root {
  color-scheme: light;
  --color-bg:  oklch(99% 0.003 250);
  --color-fg:  oklch(18% 0.012 250);
  /* ...all light tokens... */
}

[data-theme="dark"] {
  color-scheme: dark;
  --color-bg:  oklch(13% 0.012 250);
  --color-fg:  oklch(95% 0.008 250);
  /* ...all dark tokens... */
}

/* Auto-activate dark for users who prefer it system-wide */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --color-bg:  oklch(13% 0.012 250);
    --color-fg:  oklch(95% 0.008 250);
    /* ...all dark tokens... */
  }
}
```

The `:not([data-theme="light"])` lets a user override the system preference by setting `data-theme="light"` on `<html>`.

## Space scale

Base ratio: **4px** (or 0.25rem). Doubles where useful:

```css
:root {
  --space-0:   0;
  --space-1:   0.25rem;   /* 4px  */
  --space-2:   0.5rem;    /* 8px  */
  --space-3:   0.75rem;   /* 12px */
  --space-4:   1rem;      /* 16px */
  --space-5:   1.25rem;   /* 20px */
  --space-6:   1.5rem;    /* 24px */
  --space-8:   2rem;      /* 32px */
  --space-10:  2.5rem;    /* 40px */
  --space-12:  3rem;      /* 48px */
  --space-16:  4rem;      /* 64px */
  --space-20:  5rem;      /* 80px */
  --space-24:  6rem;      /* 96px */
}
```

Use names that say the multiplier (`--space-4` = "4 units"), not the value (`--space-16px` rots if you switch base).

## Typography scale

Use rem for fluidity. Include all real-world sizes; don't leave "13px" stranded between `--fs-sm` (12.5px) and `--fs-base` (14px).

```css
:root {
  --fs-xs:    0.6875rem;  /* 11px   — micro labels */
  --fs-sm:    0.75rem;    /* 12px   — secondary text */
  --fs-13:    0.8125rem;  /* 13px   — nav, dense rows */
  --fs-base:  0.875rem;   /* 14px   — body */
  --fs-md:    1rem;       /* 16px   — primary body */
  --fs-lg:    1.125rem;   /* 18px   — section title */
  --fs-xl:    1.375rem;   /* 22px   — page heading */
  --fs-2xl:   1.75rem;    /* 28px   — feature */
  --fs-3xl:   2.25rem;    /* 36px   — display */
  --fs-4xl:   3rem;       /* 48px   — hero */

  --lh-tight:    1.15;
  --lh-snug:     1.35;
  --lh-normal:   1.5;
  --lh-relaxed:  1.625;

  --ff-sans:  'Inter Variable', system-ui, sans-serif;
  --ff-mono:  'JetBrains Mono', ui-monospace, monospace;
}
```

### Inter is overused

For a brand with character, pick something else:

| Font | Vibe | Use case |
|---|---|---|
| Geist (Vercel) | Clean, modern, tech | Dev tools, SaaS, dashboards |
| IBM Plex Sans | Corporate, friendly | Enterprise, documentation |
| Söhne (commercial) | Editorial, premium | Brands wanting Linear/Substack feel |
| Söhne free alt: Public Sans | Same flavor, free | Same |
| JetBrains Mono | Tech accent | Code blocks, kbd, mono-counters |
| Geist Mono | Tech accent | Same |
| Manrope | Friendly, soft | Consumer apps, creator economy |
| Cal Sans (display only) | Bold display | Headings only, not body |

## Radius scale

```css
:root {
  --radius-sm:   0.25rem;   /* 4px  — inputs, kbd */
  --radius-md:   0.5rem;    /* 8px  — buttons, badges */
  --radius-lg:   0.75rem;   /* 12px — cards */
  --radius-xl:   1rem;      /* 16px — modals */
  --radius-pill: 9999px;
}
```

## Shadow scale

Use OKLCH for shadow color too — keeps shadow tinted with the brand instead of pure black-with-opacity.

```css
:root {
  --shadow-sm:  0 1px 2px   0 oklch(20% 0.01 250 / 0.05);
  --shadow-md:  0 4px 8px  -2px oklch(20% 0.01 250 / 0.08),
                0 2px 4px  -2px oklch(20% 0.01 250 / 0.06);
  --shadow-lg:  0 12px 24px -4px oklch(20% 0.01 250 / 0.10),
                0 4px 8px   -4px oklch(20% 0.01 250 / 0.08);
}
```

## Motion

```css
:root {
  --duration-fast:    120ms;
  --duration-normal:  200ms;
  --duration-slow:    400ms;

  --ease-out:  cubic-bezier(0.2, 0.8, 0.2, 1);
  --ease-in:   cubic-bezier(0.8, 0.2, 1.0, 0.2);
  --ease-in-out: cubic-bezier(0.6, 0, 0.4, 1);
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-fast: 0ms;
    --duration-normal: 0ms;
    --duration-slow: 0ms;
  }
}
```

Override durations to 0 — animations effectively disable without rewriting every keyframe rule.

## Z-index scale

```css
:root {
  --z-base:       1;
  --z-dropdown:   1000;
  --z-sticky:     1020;
  --z-overlay:    1040;
  --z-modal:      1050;
  --z-popover:    1060;
  --z-toast:      1070;
  --z-tooltip:    1080;
}
```

## No-hardcoding rule

Every color and dimension in components/layout must come from a token. Audit grep:

```bash
# Find hardcoded colors outside tokens.css
grep -rE '(oklch\(|#[0-9a-f]{3,8}|rgb\(|hsl\()' css/ \
  --include='*.css' \
  --exclude='tokens.css'
```

Expected output: nothing. If anything matches → add a semantic token for it.

## Common rebrand-ready tokens to add

If your project has any of these, tokenize them up front:

```css
--color-fg-hover:           /* button text on hover */
--color-border-hover:       /* card border on hover */
--color-bg-elevated:        /* dropdown / popover */
--color-bg-overlay:         /* modal backdrop */
--color-accent-gradient-to: /* gradient end if you have brand gradients */
--avatar-bg-default:        /* placeholder avatar tint */
--avatar-fg-default:
--code-bg:                  /* inline code */
--code-fg:
--kbd-shadow:               /* the bevel under <kbd> */
```

These tend to leak as literals into components if you don't define them centrally.
