---
name: ui-craft
description: "UI/UX verification discipline for frontend changes. From Krug + Wathan/Schoger + Nielsen 10 + WCAG 2.2. Use when: worker-ui-verifier inspects frontend diffs, audits accessibility, evaluates visual hierarchy, validates responsive. Trigger terms: usability, hierarchy, contrast, focus indicator, WCAG, ARIA, Lighthouse, screenshot diff, squint test. SKIP: backend API design, server config."
stacks:
  - stack-agnostic
tags:
  - ui-ux
  - usability
  - accessibility
  - wcag
  - visual-hierarchy
  - lighthouse
source: "Krug + Wathan/Schoger + Nielsen 10 + WCAG 2.2 — model knowledge + public standards"
---

## Use this skill when

- worker-ui-verifier is dispatched to inspect a frontend diff (React / Vue / Astro / Nuxt component change).
- Lighthouse audit needed (performance / a11y / SEO / best-practices scores).
- Screenshot diff comparison after a CSS or layout change.
- Evaluating a new component's visual hierarchy.
- Validating responsive behavior across breakpoints.

## Do not use this skill when

- Backend API changes with no visible UI.
- Pure database or config changes.
- Server-side rendering logic without rendered output to check.
- Animation-library specifics (use web-animation-router skill instead).

## Purpose

Verify frontend changes against four axes: usability (Krug), visual design (Wathan/Schoger), heuristic evaluation (Nielsen 10), accessibility (WCAG 2.2). Each axis turns into a concrete checklist for worker-ui-verifier — what to load in headless Chrome, what to measure, what to flag. Replaces "looks fine to me" with reproducible criteria.

## Capabilities

### Usability heuristics (Krug)

Three laws from *Don't Make Me Think*:

1. **Don't make me think** — every page and control self-evident at first glance, zero ambiguity.
2. Doesn't matter how many clicks if each is mindless — but every unclear click is a bug.
3. Get rid of half the words on a page, then half of what's left.

The **squint test**: blur the screenshot mentally — can you still tell what each region is in under 3 seconds? If no, hierarchy is broken.

Apply when:
- Inspecting a new screen — squint test first.
- A new button label — is the action obvious without surrounding context?
- A form — is each field's purpose clear from the label alone, no placeholder substitution?

### Visual design tactics (Wathan/Schoger, Refactoring UI)

Hierarchy emerges from four axes, not just one:

- **Size** — biggest = most important.
- **Weight** — bold for primary, regular for secondary.
- **Color** — saturated for primary, muted gray for secondary.
- **Whitespace** — more breathing room around important elements.

Use 2-3 of these axes per hierarchy step, never all 4 (overload). Spacing system on a scale (4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 px), not arbitrary px values. Color in HSL or OKLCH lightness scale with 50/100/.../900 shades, not random hex. Depth via subtle shadow (low opacity + tight blur) beats hard "drop shadow".

Apply when:
- Reviewing a card / panel / dialog — does the primary action stand out via 2-3 hierarchy axes?
- A new color appears — is it on the existing scale or a one-off?
- Spacing looks "off" — likely arbitrary px values not aligned to the scale.

### Nielsen 10 heuristic evaluation

Each heuristic is a concrete checklist item:

1. **Visibility of system status** — loading spinner, progress, success/error feedback present.
2. **Match real world** — language users know, not internal jargon.
3. **User control & freedom** — undo, cancel, escape clearly available.
4. **Consistency & standards** — same control = same behavior across the app.
5. **Error prevention** — confirm destructive actions, validate before submit.
6. **Recognition over recall** — show options, don't make users remember.
7. **Flexibility & efficiency** — shortcuts for power users, accessible to novices.
8. **Aesthetic & minimalist** — every element earns its place.
9. **Help users recover from errors** — clear error message + how to fix.
10. **Help & documentation** — searchable, contextual, concise.

Apply when:
- Going through a diff systematically — match each new screen against the 10.

### Accessibility (WCAG 2.2)

Non-negotiable checks:

- **Color contrast** — body text ≥ 4.5:1, large text ≥ 3:1 against background (SC 1.4.3).
- **Keyboard navigation** — every action reachable via Tab + Enter/Space, no traps.
- **Focus indicator** — visible focus ring; never `outline: none` without a `:focus-visible` replacement.
- **Semantic HTML** — `<button>` for actions, `<a>` for navigation, `<h1>`...`<h6>` hierarchical, `<label for>` on inputs.
- **Alt text** — every meaningful `<img>` with descriptive alt; `alt=""` for decorative.
- **ARIA** — only when semantic HTML can't express the role; `aria-label`, `aria-labelledby`, `aria-describedby`.
- **Touch targets** — ≥ 44×44 px on mobile (SC 2.5.5).
- **Reduced motion** — `prefers-reduced-motion` respected; animations can be disabled.

Apply when:
- Running Lighthouse a11y audit — score < 95 = blocking finding.
- Inspecting a new interactive element — keyboard reachable, visible focus, AA contrast.

### Tooling for the verifier run

Standard worker-ui-verifier flow uses chrome-devtools MCP:

- `new_page` + `navigate_page` to the changed URL.
- `emulate` — at least one mobile (e.g., 375×667 / 390×844) + one desktop (1280×800 or 1440×900).
- `take_screenshot` per breakpoint for visual evidence.
- `lighthouse_audit` for perf / a11y / SEO / best-practices scores.
- `list_console_messages` — any errors or warnings = finding.
- `list_network_requests` — failed requests, slow assets, missing CORS.
- `take_snapshot` — DOM snapshot for assertion against expected structure.

Apply when:
- Running the verifier — always emulate at least 1 mobile + 1 desktop.
- Check console for errors BEFORE reporting "looks good".

## Behavioral Traits

- Always squint at a new screen first — does hierarchy emerge instantly?
- Always check keyboard navigation, not just mouse.
- Always test at least one mobile breakpoint + one desktop.
- Always run Lighthouse a11y and flag scores < 95.
- Always flag low contrast even if Lighthouse missed it (manual ratio check).
- Always flag false affordance (non-clickable looks clickable, or vice-versa).
- Distinguish heuristic violations (Nielsen) from WCAG violations (a11y) — both reported, both prioritized.

## Important Constraints

- NEVER mark "passes" without checking both mobile + desktop viewports.
- NEVER mark "passes" with Lighthouse a11y score < 95.
- NEVER mark "passes" with contrast ratio below WCAG AA threshold (4.5:1 body, 3:1 large).
- NEVER ignore console errors or warnings in the verifier run.
- NEVER use `outline: none` without an explicit replacement focus ring.
- NEVER skip the squint test on a new screen — it's the cheapest hierarchy check.
- ALWAYS verify keyboard navigation reaches every interactive element.
- ALWAYS check that `prefers-reduced-motion` is respected on animations.

## Anti-patterns

### ❌ Mystery Meat Navigation

**Source:** Krug. **Why wrong:** Icons without labels — the user has to hover or guess what each one does.

**Fix:** Label icons, OR use icons only for universal meanings (search, close, settings, back).

### ❌ Hierarchy by Size Alone

**Source:** Wathan/Schoger. **Why wrong:** Making the primary text bigger AND bolder AND saturated color AND with more whitespace — all 4 axes maxed → visual noise, no actual hierarchy.

**Fix:** Vary on 2-3 axes per hierarchy step, never all 4.

### ❌ Removed Focus Indicator

**Source:** WCAG SC 2.4.7. **Why wrong:** `outline: none` without a `:focus-visible` ring kills keyboard navigation for everyone who isn't using a mouse.

**Fix:** Always provide a visible focus ring (border, outline, or box-shadow) on every interactive element.

### ❌ False Affordance

**Source:** Krug. **Why wrong:** A card looks clickable but isn't, or a button-shaped element is just text — wastes user clicks and erodes trust in the interface.

**Fix:** Actions look like actions (hover state, cursor: pointer); content looks like content (no hover transform, no cursor change).

### ❌ Squint Test Failure

**Source:** Krug. **Why wrong:** A blurred screenshot shows no hierarchy — no clear "first thing to look at" — the user has nowhere to start.

**Fix:** Make the primary element dominate via at least 2 of the 4 hierarchy axes (size + weight, or color + spacing, etc.).

### ❌ Placeholder-Only Label

**Source:** Nielsen + a11y. **Why wrong:** Input with no `<label>`, only `placeholder` — disappears as soon as user types, no accessible name for screen readers.

**Fix:** Real `<label>` element associated via `for`/`id`; placeholder is supplemental hint only.

## Related Skills

### Sibling methodology skills
- `coder-craft` — when the fix is a code change (most cases)
- `debugging-craft` — when a console error or layout break needs diagnosis
- `cybersecurity-audit` — for security-sensitive UI (auth forms, payment inputs)

### Adjacent UI-specific skills (load via skill_hints based on stack)
- `shadcn` — accessible component baseline for React + Tailwind
- `css-architecture-2026` — token / spacing / color system foundation
- `tailwind` — utility-class scale aligns with Wathan/Schoger's scale
- `playwright` — interactive verification beyond static screenshots
- `web-animation-router` — animation-specific concerns (motion, GSAP, autoanimate)

## Citations from source

> If something requires a large investment of time — or looks like it will — it's less likely to be used.
> — *Krug, Don't Make Me Think (paraphrased)*

> The biggest reason designs feel "off" is rarely a single bad decision — it's a thousand near-misses on spacing, color, and weight.
> — *Wathan & Schoger, Refactoring UI (paraphrased)*

> Visual presentation of text and images of text has a contrast ratio of at least 4.5:1 [for body text].
> — *WCAG 2.2, SC 1.4.3 Contrast (Minimum)*

> Recognition rather than recall: minimize the user's memory load by making elements, actions, and options visible.
> — *Nielsen, 10 Usability Heuristics, #6*

## Sources

- Steve Krug — *Don't Make Me Think Revisited* (3rd ed., 2014) — integrated from model knowledge (book unavailable on this run; canonical content well-represented)
- Adam Wathan & Steve Schoger — *Refactoring UI* (2018) — "start with a feature, not a layout" (p. 7), grayscale-first hierarchy (p. 11), spacing scale base-16 multiplied (p. 63), HSL not Hex with 8-10 shades per color (p. 134), 45-75 char line length (p. 99), light-from-above depth simulation (p. 153), "labels are a last resort" (p. 41)
- Jakob Nielsen — *10 Usability Heuristics for User Interface Design* (1994, public framework) — full text at nngroup.com
- W3C — *Web Content Accessibility Guidelines (WCAG) 2.2* (2023, public standard) — full text at w3.org/TR/WCAG22
