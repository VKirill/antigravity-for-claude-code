---
name: motion-spec-handoff
description: "Design->dev motion handoff & spec format 2026 — a concrete motion.md / motion-spec.yaml template (per element: trigger, property, from/to, duration, easing/spring, stagger, scroll-range), Rive state-machine handoff, Figma->code limits, and machine-readable agent-to-agent motion specs with spec-vs-build verification. Use when: motion spec, motion.md, motion-spec.yaml, animation handoff, design to dev handoff, rive handoff, smart animate, figma to code animation, agent-to-agent motion contract, verify built motion matches spec. SKIP: implementing the animation itself (→web-animation-router), 3D (→webgl-creative-2026)."
source: gemini-harvest-2026
risk: low-stakes
---

# motion-spec-handoff

> Built from a 2026 deep knowledge-harvest (Gemini 3.5 + live web grounding), QC'd for cross-references and package names. Some design-system token values are tagged `[UNVERIFIED]` in the references — confirm against live docs before quoting exact numbers.

## Use this skill when

- Producing a machine-readable motion spec that another agent/dev implements verbatim
- Choosing Rive vs Lottie vs code for handoff, or verifying built motion matches the spec

## Reference library

| Topic | File |
|---|---|
| Design-to-Development Motion Handoff & Specifications (2026) | [references/motion-spec-handoff.md](references/motion-spec-handoff.md) |

## How to use

Each reference is a self-contained, copy-paste-ready 2026 production guide. Route to the file matching the task, apply its recipes, and honor its antipatterns + accessibility/performance notes. Prefer the cheapest technique that satisfies the requirement (CSS before JS, native before library).
