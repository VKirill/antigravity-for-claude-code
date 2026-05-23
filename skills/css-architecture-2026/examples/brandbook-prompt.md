# Brandbook authoring prompt (tested)

A two-stage prompt for generating a `brandbook.html` page from scratch. Tested in a real CRM-foundation project. The structure follows: **proposals first, implementation after sign-off**.

## When to use

The user already has a CSS foundation (`tokens.css`, `base.css`, BEM components, `@layer` order). They want a brandbook page that:

- Documents the visual system (palette, typography, components in brand context)
- Defines tone of voice and manifesto in brand-voice copy
- Becomes the source of truth for future marketing materials and the main landing page

## Pre-prompt prerequisites

The user should answer three questions before the prompt is sent (the prompt below uses placeholders):

1. **Brand feeling** — e.g. "anti-agency, direct speech, dare-to-tell-the-truth"
2. **Visual direction** — e.g. "minimalism, lots of whitespace, monochrome + 1 accent"
3. **Target audience** — e.g. "mid-market businesses (₽500K–₽3M/mo marketing budget)"

Without these the LLM produces a generic "blue-teal SaaS agency" brandbook. With them, voice and palette land.

## The prompt

```
Context:
I have a CSS foundation in /css/ (tokens, base, layout, components,
utilities, entry index.css with cascade layers). Architecture: ITCSS-style,
BEM, flat selectors, OKLCH colors. A kitchen-sink.html exists for
component QA.

Positioning: {{BRAND_FEELING}}. Visual direction: {{VISUAL_DIRECTION}}.
Audience: {{AUDIENCE}}.

References for spirit: Linear, Basecamp, 37signals, early Stripe, Vercel.
Not references: typical agency landings, "creative studios" with
gradients and abstract waves.

Task: produce brandbook.html in the project root. This is a SOURCE-OF-TRUTH
document — every future marketing piece refers back to it.

BRANDBOOK STRUCTURE:

1. Cover
   - Brand name (if absent — propose 3 in the positioning style)
   - Positioning tagline, one line
   - Revision date

2. Manifesto (one screen)
   - 5–7 principles as direct statements
   - Style: short sentences, periods as rhythm, no fluff
   - This sets the canonical tone of voice for everything else

3. Tone of voice
   - What we say / What we don't say (two columns with examples)
   - 5 pairs of opposites
   - Real sentences: how to announce a case study, how to refuse a client,
     how to answer a price objection, how to describe a service, how to
     write the first cold message

4. Logo
   - Wordmark only, no icon
   - Sizes: 24px, 48px, 96px
   - Minimum size, clear space
   - On light and dark backgrounds
   - DON'TS: don't stretch, don't change tracking, no effects — show
     these as visual examples

5. Color palette
   - Base: pure white + warm near-black (e.g. oklch(13% 0.012 250))
   - 4–5 neutral grays for hierarchy
   - ONE accent color — propose 3 options with rationale, NOT "corporate blue"
   - Each color: OKLCH, hex fallback, token name from tokens.css, where used
   - WCAG contrast ratio for each text/background pair

6. Typography
   - One primary font with rationale (Inter is overused — consider
     Geist, IBM Plex Sans, Public Sans, Söhne alt)
   - Optional secondary font for accents (mono — JetBrains Mono, Geist Mono)
   - Scale: 8–10 sizes with real usage (display, h1, h2, h3, body-lg,
     body, body-sm, caption, mono)
   - Living examples: real brand-voice headlines and paragraphs,
     not "The quick brown fox"

7. Spacing and grid
   - Base ratio (4px / 8px)
   - Spacing scale
   - Max content width
   - Principles: "whitespace matters more than you think" + concrete rules

8. Components in brand context
   - Buttons: primary, secondary, ghost
   - Input
   - Badge
   - Case-study card (placeholder)
   - Everything rendered with real brand-voice text, not lorem ipsum

9. Real-world applications (rendered in HTML, NOT images)
   - Email signature
   - Case-study / article card
   - Landing section heading
   - CTA block
   - Footer

10. Don'ts
    - Things I do NOT do in materials
    - 6–8 visual examples with "why not" labels

IMPLEMENTATION RULES:

- brandbook.html uses the existing /css/index.css. Don't create a parallel
  stylesheet system.
- If brandbook needs page-specific styles (swatches, typography demos,
  mockups) — add /css/pages/brandbook.css and import in index.css into
  a sensible layer (propose which).
- If tokens.css needs changes for the new palette / typography — show
  diff and rationale FIRST, then change.
- If typography requires Google Fonts — wire @font-face, don't leave a
  system stack. Justify the choice.
- BEM, flat selectors, all values through tokens.

WORK ORDER:

STAGE 1 — PROPOSALS (no code yet):
  a) 3 brand-name options (if there isn't one — check README/package.json)
  b) 3 accent color options with rationale
  c) 2–3 font-pair options with rationale
  d) Manifesto draft (5 lines) — for me to confirm tone

  STOP. Wait for my choice on each.

STAGE 2 — IMPLEMENTATION:
  After my answers — build brandbook.html and necessary CSS changes.

STAGE 3 — REPORT:
  - What was created / changed
  - Which tokens added or changed and why
  - What's left to refine
  - Any open questions

Start with stage 1. Don't touch code yet.
```

## Why this prompt structure works

### "Stage 1 — proposals before code"

The default LLM behavior is to dive straight to implementation, producing one variant that "felt right". The user gets a defaulty brand. With explicit proposals stage, the LLM offers options and the user picks — voice and identity are forced through human choice.

### Negative references included

"Not references: typical agency landings, creative studios with gradients" — without explicit negatives, models drift to the average of their training data: gradient agencies, abstract waves, Inter font, blue-teal. Negatives sharpen the result.

### Manifesto as ToV anchor

Manifesto is the canonical voice sample. Every other section ("How we describe a service", "How we refuse a client") references it. Without the manifesto first, sections diverge tonally.

### Don'ts section

Most AI-generated brandbooks lack don'ts. The model later violates its own brandbook generating ad copy because there's no explicit prohibition list to check against. Including don'ts in the brandbook itself disciplines downstream generation.

### Real copy everywhere

Replace `lorem ipsum` with brand-voice text in the brandbook itself. This catches typography issues (your bold headline font might struggle with short impactful Russian phrases that have lots of consonants — only visible with real text).

## Variations

### For a different positioning

Swap `{{BRAND_FEELING}}` / `{{VISUAL_DIRECTION}}` / `{{AUDIENCE}}`:

- **Premium consulting**: "calm and high-end", "warm swiss style", "enterprise"
- **Technical / dev tools**: "precise and engineer-grade", "tech dashboard aesthetic with mono accents", "developers and CTOs"
- **Consumer-facing**: "warm and human", "soft minimalism with one expressive accent", "millennials, small business owners"

### For a follow-up landing page

After the brandbook is approved, the next prompt becomes much shorter:

```
Build /index.html — the main landing for {{POSITIONING}}, audience {{AUDIENCE}}.

Strictly follow brandbook.html as the source of truth: palette, typography,
tone-of-voice, components, don'ts.

Sections: hero, problem, services, case-studies, social-proof, CTA, footer.

Same CSS foundation, BEM, tokens. Real brand-voice copy throughout.
Stage 1: outline + 3 hero-headline options. Stage 2: implementation. Stage 3: report.
```

The landing inherits brand identity automatically — the brandbook does the heavy lifting.

## Anti-patterns this prompt avoids

- Asking for the brandbook in one shot (LLM picks the safest default)
- Skipping the don'ts (LLM later contradicts its own brandbook)
- Lorem ipsum (typography issues hide)
- "Pick a color and font for me" (results in Inter + blue)
- Skipping rationale for choices (you can't defend or iterate on the brand later)
