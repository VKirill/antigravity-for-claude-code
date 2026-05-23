---
name: webgl-creative-2026
description: "WebGL/WebGPU creative front-end for 2026 — Three.js + React Three Fiber + drei + TSL + WebGPU production setup, a GLSL shader recipe library (mesh gradients, aurora, voronoi, metaballs, fbm, displacement, particles), living animated backgrounds, and cursor/scrollytelling effects. Use when: webgl, webgpu, three.js, react three fiber, r3f, drei, TSL, shader, glsl, fragment shader, mesh gradient, particle field, noise background, aurora, metaball, displacement, magnetic cursor, scrollytelling, image-sequence scrub, 3D hero, immersive scene. SKIP: 2D DOM/SVG animation (→web-animation-router), video render (→remotion)."
source: gemini-harvest-2026
risk: low-stakes
---

# webgl-creative-2026

> Built from a 2026 deep knowledge-harvest (Gemini 3.5 + live web grounding), QC'd for cross-references and package names. Some design-system token values are tagged `[UNVERIFIED]` in the references — confirm against live docs before quoting exact numbers.

## Use this skill when

- Setting up a Three.js / R3F / WebGPU scene (with WebGL2 fallback and TSL materials)
- Writing GLSL shaders for backgrounds or effects (gradients, noise, aurora, metaballs, displacement, particles)
- Building an animated 'living' background and gating it for perf/mobile/reduced-motion
- Cursor-reactive distortion, magnetic elements, or scroll-driven 3D camera/scrollytelling

## Reference library

| Topic | File |
|---|---|
| Three.js + React Three Fiber + WebGPU Production Setup (May 2026) | [references/threejs_webgpu_r3f_knowledge_base.md](references/threejs_webgpu_r3f_knowledge_base.md) |
| Production GLSL Shader Recipe Library (WebGL 2.0 / GLSL ES 3.00) | [references/glsl-shader-recipes.md](references/glsl-shader-recipes.md) |
| Typology & Implementation of "Living" Website Backgrounds (2026) | [references/living-backgrounds.md](references/living-backgrounds.md) |
| Cursor Effects & Scrollytelling Patterns (May 2026) | [references/cursor-scrollytelling.md](references/cursor-scrollytelling.md) |

## How to use

Each reference is a self-contained, copy-paste-ready 2026 production guide. Route to the file matching the task, apply its recipes, and honor its antipatterns + accessibility/performance notes. Prefer the cheapest technique that satisfies the requirement (CSS before JS, native before library).
