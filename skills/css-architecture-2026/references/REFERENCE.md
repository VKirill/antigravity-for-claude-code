# References index

Slim navigator. Open the specific file when needed.

| If you need... | Open |
|---|---|
| Decide file layout, `@layer` order, what goes where | [architecture.md](architecture.md) |
| Name a token, pick OKLCH lightness, build the scale | [tokens.md](tokens.md) |
| Pick a modern CSS feature + verify browser support | [modern-features-2026.md](modern-features-2026.md) |
| Add a11y baseline to existing project | [accessibility.md](accessibility.md) |
| Plan vanilla → React/Vue migration | [migration-to-framework.md](migration-to-framework.md) |
| Build a kitchen-sink demo page | [kitchen-sink.md](kitchen-sink.md) |

## Quick decision tree

```
User wants to start a new project
├─ Has chosen framework + Tailwind?     → use `tailwind` skill
├─ Has chosen framework + shadcn?        → use `shadcn` skill
├─ Plain HTML/CSS first, framework later → THIS SKILL
└─ Just wants design ideas (no code)     → use `ui-ux-pro-max` or `lazyweb:*`
```

```
User has an existing vanilla CSS project — what to audit?
├─ Hardcoded colors?              → tokens.md (move to tokens)
├─ Specificity wars / !important? → architecture.md (cascade layers)
├─ Broken mobile viewport?        → modern-features-2026.md (dvh/svh)
├─ Inaccessible focus / nav?      → accessibility.md
└─ About to migrate to framework? → migration-to-framework.md
```

## Common pitfalls — fast lookup

| Symptom | Fix in |
|---|---|
| Components have `oklch()` literals instead of tokens | [tokens.md](tokens.md#no-hardcoding) |
| `style="--var: ..."` inline in HTML for theming | [architecture.md](architecture.md#data-attribute-theming) |
| `height: 100vh` clipped on mobile | [modern-features-2026.md](modern-features-2026.md#viewport-units) |
| `outline: none` without replacement | [accessibility.md](accessibility.md#focus) |
| `@media` for component breakpoints | [modern-features-2026.md](modern-features-2026.md#container-queries) |
| Dark theme declared but never activates | [tokens.md](tokens.md#theming) |
| No skip-link | [accessibility.md](accessibility.md#skip-link) |
| Animation runs for users who set `prefers-reduced-motion` | [accessibility.md](accessibility.md#reduced-motion) |
| 18 `@import` chained in entry CSS, slow FCP | [architecture.md](architecture.md#bundling) |
