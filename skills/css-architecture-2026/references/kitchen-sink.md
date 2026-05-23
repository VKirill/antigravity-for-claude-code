# Kitchen-sink pattern

A single page that renders every component in every state. Built once, used forever for visual QA. Survives migration as the seed for Storybook.

## What it is

> "Kitchen-sink" — English idiom: "everything but the kitchen sink". A page with one of every component, in every state, on the same page.

Not a real screen of the app. A catalogue:

- All button variants × all sizes × all states (default, hover, focus, active, disabled, loading)
- All form inputs (text, email, password, select, checkbox, radio, slider, textarea) with valid / invalid / disabled
- All alerts (info, success, warning, error)
- All badges, avatars, cards, tables
- All overlay components (modal, drawer, tooltip, popover)
- Typography scale rendered with real copy in brand voice

## Why it earns its place

| Without | With |
|---|---|
| Visual bug hides until that combination ships in a real screen | Caught immediately — every combination is on one page |
| Token change requires manual check of every component | Open kitchen-sink in browser, scroll once, see everything |
| Design review needs a build-and-deploy cycle | Open `kitchen-sink.html` directly |
| Onboarding new dev: "what components do we have?" | "Open kitchen-sink, scroll" |
| Framework migration risks visual regression | Storybook seeded from kitchen-sink — automatic visual diff |

## Structure

One section per component category. Each section follows the same pattern: heading + grid of variants + description.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <title>Kitchen-Sink — Design System</title>
  <link rel="stylesheet" href="/css/index.css">
</head>
<body>
  <a href="#main" class="skip-link">Skip to content</a>

  <header class="ks-header">
    <h1>Kitchen-Sink</h1>
    <p class="ks-header__desc">Every component, every state, one page.</p>
    <div class="ks-controls">
      <button type="button" data-theme-toggle>Toggle theme</button>
    </div>
  </header>

  <main id="main" class="ks-main">

    <section class="ks-section" aria-labelledby="buttons-heading">
      <h2 id="buttons-heading">Buttons</h2>
      <p class="ks-section__desc">Primary action, secondary, ghost, danger, success.</p>

      <div class="ks-grid">
        <div class="ks-cell">
          <span class="ks-label">Variants</span>
          <button class="button button--primary">Primary</button>
          <button class="button button--secondary">Secondary</button>
          <button class="button button--ghost">Ghost</button>
          <button class="button button--danger">Danger</button>
          <button class="button button--success">Success</button>
        </div>
        <div class="ks-cell">
          <span class="ks-label">Sizes</span>
          <button class="button button--primary button--sm">Small</button>
          <button class="button button--primary button--md">Medium</button>
          <button class="button button--primary button--lg">Large</button>
        </div>
        <div class="ks-cell">
          <span class="ks-label">States</span>
          <button class="button button--primary">Default</button>
          <button class="button button--primary" disabled>Disabled</button>
          <button class="button button--primary button--loading">Loading</button>
        </div>
        <div class="ks-cell">
          <span class="ks-label">With icon</span>
          <button class="button button--primary">
            <svg class="button__icon" aria-hidden="true">...</svg>
            With icon
          </button>
          <button class="button button--icon" aria-label="Close">
            <svg aria-hidden="true">...</svg>
          </button>
        </div>
      </div>
    </section>

    <section class="ks-section" aria-labelledby="forms-heading">
      <h2 id="forms-heading">Forms</h2>
      <!-- inputs, selects, checkboxes, radios, sliders -->
    </section>

    <section class="ks-section" aria-labelledby="cards-heading">
      <h2 id="cards-heading">Cards</h2>
      <!-- card variants -->
    </section>

    <!-- ...alerts, badges, avatars, tables, nav, modals... -->

    <section class="ks-section" aria-labelledby="typography-heading">
      <h2 id="typography-heading">Typography</h2>
      <p class="ks-section__desc">Scale renders with real brand-voice copy, not lorem ipsum.</p>
      <article class="ks-type-demo">
        <h1>Display: we don't make presentations</h1>
        <h2>H2: we make results</h2>
        <h3>H3: the marketing tool that decides for itself</h3>
        <p>Body: when your team spends 70% of time on routine, automation isn't a perk. It's the only way to scale without doubling headcount.</p>
        <p class="text-muted">Body muted: with the same secondary tonality you saw above, in the lighter foreground.</p>
        <code class="ks-mono">Mono: var(--ff-mono) for accents, code blocks, &lt;kbd&gt;</code>
      </article>
    </section>

  </main>

  <script type="module" src="/js/kitchen-sink.js" defer></script>
</body>
</html>
```

## Helper styles (only for kitchen-sink page)

These are ONE place where a page-specific stylesheet earns its keep. Put in `css/pages/kitchen-sink.css` and import in `index.css` only if `kitchen-sink.html` is referenced (or accept the small overhead).

```css
/* css/pages/kitchen-sink.css */

.ks-header {
  padding: var(--space-8);
  border-block-end: 1px solid var(--color-border);
}

.ks-main {
  padding-inline: var(--space-8);
  padding-block: var(--space-12);
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
  max-inline-size: 80rem;
  margin-inline: auto;
}

.ks-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.ks-section h2 {
  font-size: var(--fs-xl);
  margin-block: 0;
}

.ks-section__desc {
  color: var(--color-fg-muted);
  margin-block: 0;
}

.ks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: var(--space-6);
}

.ks-cell {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.ks-label {
  font-size: var(--fs-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-fg-muted);
}
```

## Rules for content inside

### Use real brand-voice copy, not lorem

Lorem ipsum hides typography issues. Real copy in your tone-of-voice surfaces them. Example for an "anti-agency" brand:

> "We don't make presentations. We make results."
> "Stop paying for slides. Pay for the funnel."

Generic placeholder text:
> "Lorem ipsum dolor sit amet, consectetur adipiscing elit."

The first reveals if your body font handles short impactful sentences well. The second doesn't.

### Show every state explicitly

Don't rely on `:hover` simulation in DevTools. Render all states explicitly:

```html
<div class="ks-cell">
  <span class="ks-label">Input states</span>
  <input class="input" type="text" placeholder="Default">
  <input class="input" type="text" placeholder="Disabled" disabled>
  <input class="input is-error" type="text" value="invalid@" aria-invalid="true">
  <input class="input is-success" type="text" value="ok@example.com">
</div>
```

For `:hover` and `:focus-visible`, add explicit cells with `data-state` attributes that pseudo-trigger via JS or document expected appearance.

### Include the rarely-seen

- Empty states (table with no rows, list with "Nothing here yet")
- Loading skeletons
- Error states (banner, inline)
- Long-text overflow handling (text-overflow ellipsis, breaks)
- Right-to-left if you target RTL languages

## Visual QA workflow

After any token or component change:

1. Open `kitchen-sink.html`
2. Scroll top to bottom
3. Toggle theme — scroll again
4. Toggle `prefers-reduced-motion` in DevTools — animations should freeze
5. Test keyboard nav — Tab through everything, all focus rings visible
6. Run Lighthouse — accessibility ≥ 95

## After framework migration: Storybook

Kitchen-sink becomes a Storybook entry per component:

```tsx
// Button.stories.tsx
import { Button } from './Button';

export default { title: 'Components/Button' };

export const Variants = () => (
  <>
    <Button variant="primary">Primary</Button>
    <Button variant="secondary">Secondary</Button>
    <Button variant="ghost">Ghost</Button>
    <Button variant="danger">Danger</Button>
  </>
);

export const States = () => (
  <>
    <Button variant="primary">Default</Button>
    <Button variant="primary" disabled>Disabled</Button>
    <Button variant="primary" loading>Loading</Button>
  </>
);
```

Each section of the vanilla kitchen-sink becomes a `.stories.tsx` file. Storybook then gives you the controls panel, accessibility plugin, visual regression (Chromatic), and per-story URLs for design review.

## Common pitfalls

| Pitfall | Fix |
|---|---|
| Kitchen-sink imports random extra components for "fullness" that aren't used in the app | Only include components from `components/`. New component → add a section. No section → component might be dead. |
| Kitchen-sink uses tokens that don't exist in `tokens.css` (because copied from another project) | Audit: every `var(--...)` in kitchen-sink must exist in tokens.css. |
| Heading hierarchy broken (`h1` → `h3` → `h2`) | Use `h1` for page, `h2` for section, `h3` for variant group. Don't skip levels. |
| No way to toggle theme on the page | Add `<button data-theme-toggle>` — script flips `[data-theme]` on `<html>`. |
| Page ships to production | Keep kitchen-sink off the production routes. In Vite: `build.rollupOptions.input` excludes it. In a static site: don't link to it from the main app. |
