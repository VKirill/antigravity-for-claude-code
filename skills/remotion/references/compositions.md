# Compositions — fundamentals

> Framework-level patterns for `<Composition>`, `<Sequence>`, `useCurrentFrame`, `useVideoConfig`, `registerRoot`. For the upstream authoritative version, see [upstream/rules/compositions.md](upstream/rules/compositions.md). This file extends it with our integration patterns (TypeScript-first defaults, Zod-typed props, file layout).

## The mental model

A Remotion video is a **React tree rendered frame-by-frame at a fixed fps**. There is no real time — only the current frame number. Every visual decision (position, opacity, scale) is a pure function of `useCurrentFrame()`.

Two side effects of that model that bite newcomers:

- **CSS transitions/animations are forbidden.** They depend on wall-clock time and will not render correctly. Use `interpolate()` driven by `useCurrentFrame()` instead.
- **Tailwind `animate-*` classes are forbidden** for the same reason — they compile to CSS animations.

## Project layout (our convention)

```
src/
├── index.ts            # registerRoot(Root)
├── Root.tsx            # <Composition> declarations
├── compositions/
│   ├── HelloWorld/
│   │   ├── HelloWorld.tsx     # the component
│   │   ├── schema.ts          # Zod schema + inferred props type
│   │   └── metadata.ts        # calculateMetadata (optional)
│   └── ProductPromo/
│       └── ...
└── shared/             # reusable Sequences, easings, etc.
```

`index.ts` only contains `registerRoot(RemotionRoot)`. Do not put business logic there — the studio re-imports it constantly.

## registerRoot

```tsx
// src/index.ts
import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
```

## A composition

```tsx
// src/Root.tsx
import { Composition } from "remotion";
import { HelloWorld } from "./compositions/HelloWorld/HelloWorld";

export const RemotionRoot = () => (
  <Composition
    id="HelloWorld"
    component={HelloWorld}
    durationInFrames={150}
    fps={30}
    width={1080}
    height={1920}
    defaultProps={{ title: "Hello World" }}
  />
);
```

Required props on `<Composition>`: `id`, `component`, `durationInFrames`, `fps`, `width`, `height`. Adding `defaultProps` is recommended even for non-parameterized videos so Studio has something to render.

## useCurrentFrame + useVideoConfig

```tsx
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";

export const FadeIn = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();

  const opacity = interpolate(frame, [0, fps], [0, 1], {
    extrapolateRight: "clamp",
  });

  return <div style={{ opacity, fontSize: width / 20 }}>Hello</div>;
};
```

Always pull `fps`, `width`, `height` from `useVideoConfig()`, never from hardcoded constants. The same component should re-render correctly at 720p, 1080p, and 4K.

## Sequence — the timeline primitive

`<Sequence>` shifts the frame for its children and optionally clips their lifetime:

```tsx
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";

export const Scene = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={fps * 2}>
        <Intro />
      </Sequence>
      <Sequence from={fps * 2} durationInFrames={fps * 3}>
        <Body />
      </Sequence>
      <Sequence from={fps * 5} layout="none">
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
```

- `from` — frame at which the child mounts. Inside the child, `useCurrentFrame()` returns `actualFrame - from` (so children animate from 0).
- `durationInFrames` — frame after which the child unmounts. Omit to last to the end of the parent.
- `layout="none"` — Sequence is `position: absolute; inset: 0` by default; this prop disables that wrapper for inline content.

## AbsoluteFill

`<AbsoluteFill>` is just `<div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>`. Use it as the root of nearly every scene — it guarantees children stack at the full canvas.

## TypeScript-typed props (our default)

```tsx
// src/compositions/HelloWorld/schema.ts
import { z } from "zod";

export const helloWorldSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
});

export type HelloWorldProps = z.infer<typeof helloWorldSchema>;
```

Pair the Zod schema with the Composition (see [data-driven.md](data-driven.md) and [upstream/rules/parameters.md](upstream/rules/parameters.md)) so Studio renders a typed form for editing props.

## Easing the right way

```tsx
import { interpolate, Easing } from "remotion";

const opacity = interpolate(frame, [0, fps], [0, 1], {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
  easing: Easing.bezier(0.16, 1, 0.3, 1),
});
```

For physics-style motion use `spring()` (see [upstream/rules/timing.md](upstream/rules/timing.md)):

```tsx
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

const frame = useCurrentFrame();
const { fps } = useVideoConfig();
const scale = spring({ frame, fps, config: { damping: 200 } });
```

## Anti-patterns

- **Hardcoding frame thresholds in the component body** instead of accepting props or reading `useVideoConfig().fps`. Breaks when the composition is reused at a different fps.
- **`setInterval` / `requestAnimationFrame`** inside a Remotion component. The renderer drives frames; runtime timers don't survive headless render.
- **Reading `Date.now()` for animation**. Non-deterministic. Use `frame`.
- **Mutating refs to drive visuals**. The frame must be the only input. Refs are fine for measurement (see [upstream/rules/measuring-dom-nodes.md](upstream/rules/measuring-dom-nodes.md)) — not for animation state.

## What's not covered here

- `<Still>` for poster frames, `<Folder>` for sidebar grouping — [upstream/rules/compositions.md](upstream/rules/compositions.md).
- Trim/loop/speed primitives — [upstream/rules/trimming.md](upstream/rules/trimming.md), [upstream/rules/sequencing.md](upstream/rules/sequencing.md).
- Scene transitions — [upstream/rules/transitions.md](upstream/rules/transitions.md).
- Dynamic duration/dimensions — [data-driven.md](data-driven.md) + [upstream/rules/calculate-metadata.md](upstream/rules/calculate-metadata.md).
