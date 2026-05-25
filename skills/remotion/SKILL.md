---
name: remotion
description: "Remotion — programmatic video framework where React components render to MP4 / WebM / GIF / stills frame-by-frame. Use when: programmatic video, React video, video composition, useCurrentFrame, useVideoConfig, Composition, Sequence, interpolate, calculateMetadata, renderMedia, renderStill, MP4 render, Remotion Lambda, @remotion/player, @remotion/renderer, @remotion/lambda, video template, parameterized video. SKIP: non-React video pipelines, ffmpeg-only transcoding, OBS / screen recording, After Effects export."
stacks:
  - Remotion
  - React
  - TypeScript
tags:
  - video
  - animation
  - react
  - rendering
  - lambda
packages:
  - remotion
  - "@remotion/cli"
  - "@remotion/bundler"
  - "@remotion/renderer"
  - "@remotion/lambda"
  - "@remotion/player"
  - "@remotion/media"
  - "@remotion/google-fonts"
manifests:
  - remotion.config.ts
risk: medium-stakes
source: hybrid(upstream:remotion-dev/remotion + vechkasov-integration)
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- Remotion: `4.0.x`
- React: `19.x`
- TypeScript: `6.0.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->


## Usage

Loaded automatically when the description matches the active task. Read only the reference you need — the upstream `references/upstream/rules/` files are authoritative for framework APIs; sibling references in `references/` cover our integration patterns (Next.js host, BullMQ workers, Lambda pipeline).

## Use this skill when

- Building a programmatic video where the timeline is React + JSX (titles, lower-thirds, data-driven product promos, transcriptions, charts in motion)
- Writing or refactoring `<Composition>` / `<Sequence>` code with `useCurrentFrame` and `useVideoConfig`
- Rendering MP4 / WebM / GIF / PNG from a React tree — CLI (`npx remotion render`) or programmatic (`renderMedia()`)
- Setting up rendering on AWS via `@remotion/lambda` (function deploy, site deploy, `renderMediaOnLambda`, progress / webhook)
- Embedding `<Player>` from `@remotion/player` in a Next.js, React, or other web app
- Parameterizing a composition with `defaultProps`, `inputProps`, and `calculateMetadata` (often driven by a Zod schema)
- Wiring renders behind a queue (BullMQ worker) so HTTP handlers never block on long renders
- Diagnosing render failures — fonts not loading, Chromium OOM, Lambda timeouts, FFmpeg errors

## Do not use this skill when

- The task is plain FFmpeg work (concat, trim, transcode) with no React layer involved
- The task is screen recording (OBS, Loom, system capture) or live streaming
- The task is exporting from a timeline-editor tool (After Effects, Premiere, DaVinci) — Remotion does not import those
- The video pipeline is React Native or Flutter — Remotion runs in headless Chromium and is web-DOM-only
- The user only needs a `<video>` tag UI / video player chrome with no programmatic rendering
- The task is general 2D / canvas animation that never produces a video file (use `react` + a canvas/animation library)

## Purpose

Remotion turns React components into video. The mental model is simple but specific: the timeline is a pure function of `useCurrentFrame()`. There is no real time during render — only frame numbers at a fixed `fps`. Every visual decision (position, opacity, scale) is derived deterministically from the current frame, which means CSS time-based animations and tweening libraries do not work. Animation is done with `interpolate()` and `spring()` driven by the frame.

This skill carries the **Remotion-team-authored canonical rules** (mirrored verbatim under `references/upstream/`) plus our **integration layer**: how Remotion plugs into our Next.js apps via `<Player>` and Server Actions, how renders are offloaded to BullMQ workers that bundle once and reuse the `serveUrl`, how `@remotion/lambda` is deployed for high-throughput cloud rendering, and the Linux/AWS gotchas we have hit in production. When canonical Remotion knowledge and our integration recommendations disagree, upstream wins on framework APIs and we override on infra.

## Capabilities

### Compositions and the frame model

A `<Composition>` declares an id, a React `component`, and the fixed shape of the output (`durationInFrames`, `fps`, `width`, `height`). Inside the component, `useCurrentFrame()` returns the current 0-indexed frame and `useVideoConfig()` returns the live shape. `<Sequence from={N} durationInFrames={M}>` shifts the frame for its children (so the child animates from 0) and unmounts them outside the range. `<AbsoluteFill>` is the standard root — full-canvas, flexbox-ready. CSS `transition`/`@keyframes` and Tailwind `animate-*` classes are forbidden because they depend on wall-clock time.

> Detail: [references/compositions.md](references/compositions.md) · upstream canonical: [references/upstream/rules/compositions.md](references/upstream/rules/compositions.md), [references/upstream/rules/sequencing.md](references/upstream/rules/sequencing.md), [references/upstream/rules/timing.md](references/upstream/rules/timing.md).

### Rendering — CLI and `renderMedia`

The CLI path is `npx remotion render <id> [output]`. The programmatic path is three steps: `bundle()` produces a `serveUrl`; `selectComposition()` resolves the chosen `<Composition>` and applies `calculateMetadata`; `renderMedia()` writes the file. The renderer ships its own FFmpeg — no system install required for the common path. `renderStill()` is the single-frame equivalent for poster images / OG cards. Long-lived workers should `bundle()` **once at boot** and reuse the `serveUrl` across renders.

> Detail: [references/rendering.md](references/rendering.md).

### Remotion Lambda — AWS render pipeline

`@remotion/lambda` splits a render across many AWS Lambda invocations and stitches the result via S3. One-time setup: `npx remotion lambda functions deploy` (per region) + `npx remotion lambda sites create` (per project version). At render time: `renderMediaOnLambda({ region, functionName, serveUrl, composition, inputProps, codec, privacy })` returns `{ renderId, bucketName }`. Track completion via polling `getRenderProgress` or via a signed webhook. `progress.costs.displayCost` is exposed for billing dashboards.

> Detail: [references/lambda.md](references/lambda.md).

### Data-driven templates

Compositions accept `defaultProps` (Studio fallback) and `inputProps` (runtime override). Both must be JSON-serializable; `Date`, `Map`, `Set`, and `staticFile()` references are explicitly allowed. `calculateMetadata({ props, abortSignal })` runs server-side / pre-render and can change `durationInFrames`, `width`, `height`, `fps`, and reshape `props`. A Zod schema attached via `<Composition schema={...}>` gives Studio a typed editor and gives your API a re-validation contract.

> Detail: [references/data-driven.md](references/data-driven.md) · upstream canonical: [references/upstream/rules/calculate-metadata.md](references/upstream/rules/calculate-metadata.md), [references/upstream/rules/parameters.md](references/upstream/rules/parameters.md).

### Embedding `<Player>` in Next.js

`@remotion/player` ships a `<Player>` component that runs the same composition in the browser, scrubbable and interactive. Required props: `component`, `inputProps`, `durationInFrames`, `fps`, `compositionWidth`, `compositionHeight`. Composition modules reference Remotion hooks and must live behind a `"use client"` boundary — they will throw if imported into a Server Component. Server-side `renderStill` works inside a Node-runtime Route Handler (Edge runtime cannot launch Chromium).

> Detail: [references/integration-nextjs.md](references/integration-nextjs.md).

### Queueing renders

Renders exceed HTTP timeouts. The right shape is HTTP enqueue → BullMQ worker renders → signed URL returned later. Workers bundle once at boot; per-worker concurrency starts at 1–2 (one render saturates 2–4 CPU cores). `job.updateProgress` carries phase + percent to the UI via SSE/WebSocket. Lambda-backed workers delegate the heavy lifting to AWS but follow the same lifecycle.

> Detail: [references/integration-queue.md](references/integration-queue.md). Cross-skill: [bullmq](../bullmq/SKILL.md).

### Assets, fonts, audio

Static assets go under `public/` and load via `staticFile("name.ext")`. Images: `<Img>` from `remotion`. Videos: `<Video>` from `@remotion/media`. Audio: `<Audio>` from `@remotion/media`. Google Fonts via `@remotion/google-fonts` is the recommended font path; local fonts via `@remotion/fonts` `loadFont()`. Always `await` font loading before first render — Remotion does not block on missing fonts.

> Upstream canonical: [references/upstream/rules/images.md](references/upstream/rules/images.md), [references/upstream/rules/videos.md](references/upstream/rules/videos.md), [references/upstream/rules/audio.md](references/upstream/rules/audio.md), [references/upstream/rules/google-fonts.md](references/upstream/rules/google-fonts.md), [references/upstream/rules/local-fonts.md](references/upstream/rules/local-fonts.md).

### Captions, transitions, advanced

Captions: `references/upstream/rules/subtitles.md` (entry) → `display-captions.md`, `import-srt-captions.md`, `transcribe-captions.md`. Transitions between scenes: `references/upstream/rules/transitions.md`. 3D via Three.js + React Three Fiber: `references/upstream/rules/3d.md`. MapLibre flyovers: `references/upstream/rules/maplibre.md`.

## Behavioral Traits

- Drives every animation from `useCurrentFrame()` via `interpolate()` or `spring()` — never CSS transitions, never Tailwind `animate-*`, never timers
- Reads `fps` / `width` / `height` from `useVideoConfig()` — never hardcodes them in component bodies
- Bundles once at worker / server boot and reuses `serveUrl` — never re-bundles per render
- Re-validates `inputProps` via the composition's Zod schema at the API edge before enqueuing
- Threads `abortSignal` into every fetch inside `calculateMetadata` so Studio cancels cleanly when props change
- Marks every module that imports composition components `"use client"` (or imports them only from a client component) — Remotion hooks throw in RSC
- Tags Route Handlers / Server Actions that touch the renderer with `runtime = "nodejs"` — Edge cannot launch Chromium
- For renders longer than seconds, always queues via BullMQ rather than calling `renderMedia` inline
- Loads upstream rules from `references/upstream/rules/` for any composition-internal question; loads sibling refs for any infra question
- Surfaces `progress.costs.displayCost` from Lambda renders to admin dashboards

## Important Constraints

- NEVER use CSS `transition` / `@keyframes` / Tailwind `animate-*` classes inside compositions — they depend on wall-clock time and will not render correctly
- NEVER hardcode `fps`, `durationInFrames`, `width`, `height` inside a component body — read them from `useVideoConfig()` so the same composition reuses at 720p/1080p/4K
- NEVER call `renderMedia` directly inside a Next.js Route Handler, Server Action, or any HTTP handler — long renders block the response. Queue them
- NEVER run renders on the Edge runtime — no Chromium binary. Always `runtime = "nodejs"` for any render endpoint
- NEVER pass non-JSON values (functions, class instances, Buffer, streams, regex) in `inputProps` / `defaultProps` — they break worker/Lambda serialization
- NEVER bundle once per job in a worker — bundle at boot and reuse `serveUrl`; per-job bundling wastes 5–30 s of Webpack work
- NEVER import composition components from a Server Component — Remotion hooks need a client runtime context
- ALWAYS pre-load fonts (`@remotion/google-fonts` `waitUntilDone()` or equivalent) before first render; Remotion does not silently wait for fonts
- ALWAYS install Chromium's Linux system libs (`libnss3`, `libatk1.0-0`, `libgbm1`, etc.) on a bare Ubuntu server before running renders
- ALWAYS thread `abortSignal` into fetches inside `calculateMetadata` — Studio re-runs it on every prop edit

## Related Skills

90%-popularity filter applied — only mainstream choices that pair with Remotion in 2026 projects.

### Foundation
- `react` — React 19 runtime; the entire composition tree is React
- `typescript` — props typed via Zod-inferred types; composition schemas
- `nodejs` — server-side bundler/renderer runs on Node 24

### Most common host
- `nextjs` — Next.js 16 App Router; `<Player>` embeds + Server Action enqueue + Route Handler stills

### Validation
- `zod` — Zod 4 schemas drive `<Composition schema={...}>` + API-edge re-validation

### Queue
- `bullmq` — BullMQ 5 worker pool for render jobs (see [integration-queue.md](references/integration-queue.md))

### Where renders run (infra)
- `linux-sysadmin` — Ubuntu 24.04 host setup (Chromium deps, PM2 worker pool)

## API Reference

Domain-specific references (Pattern 2) — load only what you need.

### Our integration layer

| Topic | File |
|---|---|
| Index, decision map, layering rule (upstream vs ours) | [references/REFERENCE.md](references/REFERENCE.md) |
| `<Composition>`, `<Sequence>`, `useCurrentFrame`, `useVideoConfig`, project layout | [references/compositions.md](references/compositions.md) |
| `renderMedia` / `renderStill` / CLI / `bundle` / codec table / per-render gotchas | [references/rendering.md](references/rendering.md) |
| `@remotion/lambda` — function/site deploy, `renderMediaOnLambda`, progress, webhook, costs | [references/lambda.md](references/lambda.md) |
| `defaultProps` / `inputProps` / `calculateMetadata` / Zod schema patterns | [references/data-driven.md](references/data-driven.md) |
| `<Player>` in Next.js — RSC boundary, `runtime = "nodejs"`, Server Action enqueue, `renderStill` Route Handler | [references/integration-nextjs.md](references/integration-nextjs.md) |
| BullMQ render worker — bundle once, concurrency tuning, Lambda-backed worker, graceful shutdown | [references/integration-queue.md](references/integration-queue.md) |
| FFmpeg / fonts / OOM / Lambda timeouts / black-frame debugging | [references/troubleshooting.md](references/troubleshooting.md) |
| Eval cases — routing prompts + expected behaviour (v3) | [references/eval-cases.md](references/eval-cases.md) |

### Upstream canonical reference (verbatim mirror of `remotion-dev/remotion/packages/skills/skills/remotion/` — DO NOT EDIT)

| Topic | File |
|---|---|
| Sync workflow, attribution, license, intentionally-skipped files | [references/upstream/SOURCE.md](references/upstream/SOURCE.md) |
| Upstream navigator — quickstart, project setup, composition basics | [references/upstream/SKILL.md](references/upstream/SKILL.md) |
| Compositions — `<Composition>`, `<Still>`, `<Folder>`, defaultProps, calculateMetadata pointers | [references/upstream/rules/compositions.md](references/upstream/rules/compositions.md) |
| `calculateMetadata` — dynamic duration / dimensions / props | [references/upstream/rules/calculate-metadata.md](references/upstream/rules/calculate-metadata.md) |
| Parameterize with a Zod schema | [references/upstream/rules/parameters.md](references/upstream/rules/parameters.md) |
| `<Sequence>` patterns — delay, trim, limit duration | [references/upstream/rules/sequencing.md](references/upstream/rules/sequencing.md) |
| Advanced timing — `interpolate`, Bézier easing, `spring()` | [references/upstream/rules/timing.md](references/upstream/rules/timing.md) |
| Trimming — cutting beginning / end of animations | [references/upstream/rules/trimming.md](references/upstream/rules/trimming.md) |
| Scene transitions | [references/upstream/rules/transitions.md](references/upstream/rules/transitions.md) |
| Images — sizing, dynamic paths, dimensions | [references/upstream/rules/images.md](references/upstream/rules/images.md) |
| Videos — `<Video>` from `@remotion/media`, trim, volume, speed, loop, pitch | [references/upstream/rules/videos.md](references/upstream/rules/videos.md) |
| Audio — `<Audio>`, trim, volume, speed, pitch | [references/upstream/rules/audio.md](references/upstream/rules/audio.md) |
| Sound effects | [references/upstream/rules/sfx.md](references/upstream/rules/sfx.md) |
| AI voiceover via ElevenLabs TTS | [references/upstream/rules/voiceover.md](references/upstream/rules/voiceover.md) |
| Audio visualization — spectrum, waveform, bass-reactive | [references/upstream/rules/audio-visualization.md](references/upstream/rules/audio-visualization.md) |
| GIFs synchronized with the timeline | [references/upstream/rules/gifs.md](references/upstream/rules/gifs.md) |
| Lottie animations | [references/upstream/rules/lottie.md](references/upstream/rules/lottie.md) |
| Transparent videos (alpha channel) | [references/upstream/rules/transparent-videos.md](references/upstream/rules/transparent-videos.md) |
| Light leaks via `@remotion/light-leaks` | [references/upstream/rules/light-leaks.md](references/upstream/rules/light-leaks.md) |
| Google Fonts loader (recommended) | [references/upstream/rules/google-fonts.md](references/upstream/rules/google-fonts.md) |
| Local fonts via `@remotion/fonts` | [references/upstream/rules/local-fonts.md](references/upstream/rules/local-fonts.md) |
| FFmpeg — when to drop down | [references/upstream/rules/ffmpeg.md](references/upstream/rules/ffmpeg.md) |
| Audio duration via Mediabunny | [references/upstream/rules/get-audio-duration.md](references/upstream/rules/get-audio-duration.md) |
| Video dimensions via Mediabunny | [references/upstream/rules/get-video-dimensions.md](references/upstream/rules/get-video-dimensions.md) |
| Video duration via Mediabunny | [references/upstream/rules/get-video-duration.md](references/upstream/rules/get-video-duration.md) |
| Silence detection | [references/upstream/rules/silence-detection.md](references/upstream/rules/silence-detection.md) |
| Measuring DOM nodes | [references/upstream/rules/measuring-dom-nodes.md](references/upstream/rules/measuring-dom-nodes.md) |
| Measuring text dimensions / fit / overflow | [references/upstream/rules/measuring-text.md](references/upstream/rules/measuring-text.md) |
| HTML in canvas — `<HtmlInCanvas>` for WebGL effects | [references/upstream/rules/html-in-canvas.md](references/upstream/rules/html-in-canvas.md) |
| Captions — entry rule | [references/upstream/rules/subtitles.md](references/upstream/rules/subtitles.md) |
| Display captions in the timeline | [references/upstream/rules/display-captions.md](references/upstream/rules/display-captions.md) |
| Import SRT captions | [references/upstream/rules/import-srt-captions.md](references/upstream/rules/import-srt-captions.md) |
| Transcribe captions | [references/upstream/rules/transcribe-captions.md](references/upstream/rules/transcribe-captions.md) |
| Text animations | [references/upstream/rules/text-animations.md](references/upstream/rules/text-animations.md) |
| 3D — Three.js + React Three Fiber | [references/upstream/rules/3d.md](references/upstream/rules/3d.md) |
| Maps — MapLibre animated routes / flyovers | [references/upstream/rules/maplibre.md](references/upstream/rules/maplibre.md) |
| Tailwind in Remotion | [references/upstream/rules/tailwind.md](references/upstream/rules/tailwind.md) |
| Text-animation assets (typewriter) | [references/upstream/rules/assets/text-animations-typewriter.tsx](references/upstream/rules/assets/text-animations-typewriter.tsx) |
| Text-animation assets (word highlight) | [references/upstream/rules/assets/text-animations-word-highlight.tsx](references/upstream/rules/assets/text-animations-word-highlight.tsx) |
| Charting asset (bar chart) | [references/upstream/rules/assets/charts-bar-chart.tsx](references/upstream/rules/assets/charts-bar-chart.tsx) |

**How to use**: navigate to the specific file relevant to the task. For composition-internal questions start with `upstream/rules/*`; for infra/integration questions start with the sibling files in `references/`.
