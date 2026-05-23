---
name: media-asset-pipeline
description: "Web media asset pipeline & budgets 2026 — glTF/GLB optimization (Draco, meshopt, KTX2 via gltf-transform), Blender baking, polygon/draw-call/texture budgets, AVIF/WebP responsive images, video rules, Lottie→dotLottie/ThorVG migration, deterministic budget checks. Use when: gltf, glb, draco, meshopt, ktx2, basis, gltf-transform, 3d model optimization, texture compression, blender bake, avif, webp, responsive images, srcset, fetchpriority, lottie, dotlottie, thorvg, asset budget, file size lint. SKIP: writing the 3D scene code (→webgl-creative-2026)."
source: gemini-harvest-2026
risk: low-stakes
---

# media-asset-pipeline

> Built from a 2026 deep knowledge-harvest (Gemini 3.5 + live web grounding), QC'd for cross-references and package names. Some design-system token values are tagged `[UNVERIFIED]` in the references — confirm against live docs before quoting exact numbers.

## Use this skill when

- Optimizing 3D models (Draco/meshopt/KTX2) before shipping to the web
- Choosing image formats and responsive strategy (AVIF/WebP, srcset, priority hints)
- Migrating Lottie to dotLottie/ThorVG, or setting media file-size budgets + CI checks

## Reference library

| Topic | File |
|---|---|
| 3D & Media Asset Pipeline: Budgets & Optimizations (May 2026) | [references/media-asset-pipeline.md](references/media-asset-pipeline.md) |

## How to use

Each reference is a self-contained, copy-paste-ready 2026 production guide. Route to the file matching the task, apply its recipes, and honor its antipatterns + accessibility/performance notes. Prefer the cheapest technique that satisfies the requirement (CSS before JS, native before library).
