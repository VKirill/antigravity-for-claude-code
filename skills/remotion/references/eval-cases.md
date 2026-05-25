# Eval cases — routing prompts (v3)

Each entry: user phrasing → whether `remotion` should be the routing winner, and what behaviour is expected once loaded. Use these to verify description quality and as smoke tests before publishing changes.

## Positive — should load `remotion`

### create-blank-project

**User:** "Scaffold a new Remotion project with TypeScript, no Tailwind."

**Expect:**
- Skill loads.
- Suggests `npx create-video@latest --yes --blank --no-tailwind my-video` or equivalent (verify against upstream/SKILL.md).
- Mentions `src/Root.tsx` and `registerRoot()`.

### add-fade-in

**User:** "How do I fade in a title over the first second of a Remotion video at 30 fps?"

**Expect:**
- Code uses `useCurrentFrame()` + `useVideoConfig()` + `interpolate(frame, [0, fps], [0, 1], { extrapolateRight: 'clamp' })`.
- Does NOT suggest CSS `transition` or `animate-*` Tailwind classes.

### render-mp4-locally

**User:** "Render the `Intro` composition to MP4 from my Node script."

**Expect:**
- Three-step flow: `bundle()` → `selectComposition()` → `renderMedia({ codec: 'h264', outputLocation })`.
- Mentions reusing `serveUrl` across renders.

### lambda-pipeline

**User:** "Set up Remotion Lambda — render a video on AWS and get a URL back."

**Expect:**
- `npx remotion lambda functions deploy` + `lambda sites create`.
- `renderMediaOnLambda` + either polling `getRenderProgress` or webhook flow.
- Cost surfacing via `progress.costs.displayCost`.

### parameterize-with-zod

**User:** "Make my composition take a `videoUrl` and `title` as props, validated with Zod."

**Expect:**
- Zod schema in a `schema.ts`, inferred type, `<Composition schema={...}>` wiring.
- `defaultProps` set, JSON-serializable values only.
- Cross-link to `calculateMetadata` if dynamic duration is needed.

### embed-player-nextjs

**User:** "Embed a Remotion preview inside my Next.js app router page."

**Expect:**
- `<Player>` import from `@remotion/player` inside a `"use client"` component.
- Required props enumerated (`component`, `durationInFrames`, `fps`, `compositionWidth`, `compositionHeight`, `inputProps`).
- Note: composition modules can't be imported into Server Components.

### queue-render-job

**User:** "Long renders are timing out my server action. How should I run them?"

**Expect:**
- BullMQ-style queue + separate worker process.
- Bundle once at boot, reuse `serveUrl`.
- Warn never to call `renderMedia` inline in a Server Action or HTTP handler.

### dynamic-duration

**User:** "I want the video duration to match the duration of an input audio file."

**Expect:**
- `calculateMetadata` with `await getAudioDurationInSeconds` (from `@remotion/media-utils` or Mediabunny — verify against upstream).
- Return `durationInFrames: Math.ceil(audioSec * fps)`.

## Negative — should NOT load `remotion`

### ffmpeg-pure

**User:** "Concatenate two MP4 files with ffmpeg."

**Expect:** Routes to a general FFmpeg / shell answer, not `remotion`. Remotion's bundled ffmpeg is internal; ad-hoc ffmpeg work is not Remotion's domain.

### obs-recording

**User:** "Record my screen with OBS and trim the result."

**Expect:** Does NOT load `remotion`. Different tool category entirely.

### after-effects-export

**User:** "Export my After Effects timeline as PNG sequence."

**Expect:** Does NOT load `remotion`. AE is not React-based; Remotion does not import AE projects (Lottie is a partial overlap — see `upstream/rules/lottie.md`).

### react-native-animation

**User:** "Animate a view in React Native."

**Expect:** Routes to `react-native` / `expo` skills. Remotion is web-DOM-only.

### vue-video-player

**User:** "Add a video player to my Vue app."

**Expect:** Does NOT load `remotion`. Remotion is React-only.

## Behavioural — what the loaded skill must avoid

| Forbidden behaviour | Why |
|---|---|
| Suggesting CSS `@keyframes` or `transition` for time-based animation | Will not render — Remotion uses frame-as-input, not wall-clock |
| Suggesting Tailwind `animate-*` classes | Same — CSS animations don't survive headless render |
| Hardcoding fps/duration in component bodies | Breaks reuse at different resolutions; pass via `useVideoConfig()` |
| Calling `renderMedia` inside a Next.js Route Handler / Server Action body | Long renders block the response and time out |
| Using Edge runtime for any render endpoint | No Chromium binary on Edge |
| Passing non-JSON values in `inputProps` | Breaks JSON serialization across worker / Lambda boundary |
| Suggesting `setInterval` / `requestAnimationFrame` for animation inside a composition | Non-deterministic; renderer drives frames |

## Routing — disambiguation

| Prompt | Skill that should win |
|---|---|
| "trim a video" with no React/Remotion context | NOT remotion — generic ffmpeg/video tools |
| "trim a video inside my Remotion composition" | `remotion` (→ [upstream/rules/trimming.md](upstream/rules/trimming.md)) |
| "react animation" with no video output mention | `react` (general animation libs like Framer Motion) |
| "render a React tree to MP4" | `remotion` |
| "OG image generation" with no Remotion mention | Next.js `next/og` — NOT `remotion` |
| "generate OG image using my Remotion composition" | `remotion` (`renderStill`) |
