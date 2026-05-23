---
name: web-qa-2026
description: "Deterministic web QA/verification suite 2026 — the exact runnable toolchain to verify a built site WITHOUT human eyes: Lighthouse CI assertions, @axe-core/playwright, Playwright visual regression + interaction, stylelint + design-token lint, eslint-jsx-a11y, pa11y-ci, size-limit, unused-CSS, broken-link, html-validate, web-vitals INP/CLS in CI — aggregated into one 'npm run verify'. Use when: npm run verify, lighthouse ci, axe-core, playwright visual regression, screenshot diff, pa11y, size-limit, bundle budget, html-validate, stylelint, web-vitals CI, INP CLS assertion, deterministic QA, automated frontend verification, CI quality gate. SKIP: writing the app code (→stack skills), unit tests (→vitest/playwright skills)."
source: gemini-harvest-2026
risk: low-stakes
---

# web-qa-2026

> Built from a 2026 deep knowledge-harvest (Gemini 3.5 + live web grounding), QC'd for cross-references and package names. Some design-system token values are tagged `[UNVERIFIED]` in the references — confirm against live docs before quoting exact numbers.

## Use this skill when

- Setting up an automated, deterministic 'npm run verify' gate (perf/a11y/visual/lint/bundle) a coding agent runs after every change
- Adding Lighthouse CI / axe / Playwright visual / size-limit assertions that fail the build

## Reference library

| Topic | File |
|---|---|
| Deterministic QA & Build Verification Suite (2026) | [references/deterministic-qa-suite.md](references/deterministic-qa-suite.md) |

## How to use

Each reference is a self-contained, copy-paste-ready 2026 production guide. Route to the file matching the task, apply its recipes, and honor its antipatterns + accessibility/performance notes. Prefer the cheapest technique that satisfies the requirement (CSS before JS, native before library).
