# Rendering — local & server-side

Local rendering via CLI or `@remotion/renderer` programmatic API. For Lambda see [lambda.md](lambda.md). For queueing renders in a worker see [integration-queue.md](integration-queue.md).

## CLI render — the fast path

```bash
# Render a video by composition id
npx remotion render <composition-id> [output-path]

# Render a single still (PNG / JPEG)
npx remotion still <composition-id> [output-path] --frame=30

# Common flags
--scale=0.5            # half-resolution preview render
--concurrency=8        # parallel chrome tabs (default: half of CPU count)
--codec=h264|h265|vp8|vp9|prores|gif|mp3|wav|aac
--props='{"title":"Hi"}'
--props=./props.json
--log=verbose          # quiet | info | verbose
--frames=30-120        # render only frames 30..120 inclusive
```

`output-path` defaults to `out/<composition-id>.mp4`. The CLI bundles + renders + writes the file.

## Programmatic — `renderMedia()`

Required imports come from two packages:

```ts
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
```

### Three-step flow

```ts
// 1. Bundle the project (output: serveUrl, can be reused)
const serveUrl = await bundle({
  entryPoint: path.resolve("src/index.ts"),
  // optional: webpack overrides, public dir override
});

// 2. Pick the composition you want to render
const composition = await selectComposition({
  serveUrl,
  id: "HelloWorld",
  inputProps: { title: "Hi" },
});

// 3. Render
const result = await renderMedia({
  composition,
  serveUrl,
  codec: "h264",
  outputLocation: "out/hello.mp4",
  inputProps: { title: "Hi" },
});
```

`bundle()` is expensive (Webpack pass). In a worker that renders many videos, bundle **once at boot** and reuse `serveUrl`. See [integration-queue.md](integration-queue.md).

### Frequently-used `renderMedia` parameters

| Param | Type | Notes |
|---|---|---|
| `composition` | VideoConfig | From `selectComposition()` |
| `serveUrl` | string | From `bundle()` or a hosted URL |
| `codec` | `"h264" \| "h265" \| "vp8" \| "vp9" \| "prores" \| "gif" \| "mp3" \| "wav" \| "aac"` | h264 is the default-safe MP4 |
| `outputLocation` | string \| null | Omit to receive `result.buffer` |
| `inputProps` | object | Must be JSON-serializable (`Date`, `Map`, `Set`, `staticFile()` allowed) |
| `concurrency` | number \| string | e.g. `4` or `"50%"` — defaults to half CPU |
| `frameRange` | `number \| [number, number]` | Single frame or inclusive range |
| `imageFormat` | `"jpeg" \| "png" \| "none"` | `jpeg` is fastest; `png` for transparency |
| `jpegQuality` | 0–100 | Default ~80 |
| `crf` | number | Quality knob; lower = better, larger file |
| `audioCodec` | `"aac" \| "mp3" \| "opus" \| "pcm-16"` | Default matches video codec |
| `audioBitrate`, `videoBitrate` | string | e.g. `"128k"`, `"5M"` |
| `muted` | boolean | Drop audio track |
| `hardwareAcceleration` | boolean | GPU encode if available |
| `puppeteerInstance` | Browser | Reuse a `openBrowser()` instance across renders |
| `scale` | number | Output dimension multiplier (`0.5` → half size) |
| `overwrite` | boolean | Replace existing file |
| `onProgress` | `(p) => void` | `{ renderedFrames, encodedFrames, progress }` |
| `timeoutInMilliseconds` | number | Per-frame timeout, default 30000 |
| `cancelSignal` | CancelSignal | From `makeCancelSignal()` |

Return shape:

```ts
{ buffer: Buffer | null; slowestFrames: Array<{ frame: number; time: number }>; contentType: string }
```

`slowestFrames` is gold for perf debugging — it shows which frames blew the per-frame budget.

## Stills — `renderStill()`

For a single PNG/JPEG (poster image, social card, thumbnail):

```ts
import { renderStill } from "@remotion/renderer";

await renderStill({
  composition,
  serveUrl,
  output: "out/poster.png",
  frame: 30,
  imageFormat: "png",
  inputProps: { title: "Hi" },
});
```

Always faster than `renderMedia` for a single frame — no encoder, no audio mux, no FFmpeg.

## Reusing the bundle

A `serveUrl` from `bundle()` is a directory on disk (or http URL). It stays valid until you re-run `bundle()` or wipe the directory. In long-running services, store it once and reuse it for all renders.

When the **composition code changes** the bundle must be regenerated. Strategies:

- Dev: rebundle on every render (cheap-and-cheerful).
- Production: bake the bundle into the worker image at build time. Read `serveUrl` from disk at startup.
- Multi-tenant rendering with user-supplied JSX: keep one bundle per tenant, regenerate when the tenant's React code changes.

## Codec / container quick chooser

| Goal | Codec | Container |
|---|---|---|
| Web playback, universal | `h264` | `.mp4` |
| Better compression, modern web | `h265` | `.mp4` |
| Transparency (alpha) | `prores` (4444) or `vp8/vp9` | `.mov` or `.webm` — see [upstream/rules/transparent-videos.md](upstream/rules/transparent-videos.md) |
| Animated image | `gif` | `.gif` |
| Audio only | `mp3`, `aac`, `wav` | matching container |

## Render-time gotchas

- **Audio drift on long videos**: keep `fps` integer-divisible into common audio sample rates when possible (30 fps + 48000 Hz audio is fine).
- **Slow `<Img>` loads**: prefer `staticFile()` for assets in `public/`; remote URLs add network latency per frame.
- **OOM on long compositions**: lower `concurrency`; each parallel tab holds the whole DOM in memory.
- **Headless Chromium fails on Linux**: missing system libs. See [troubleshooting.md](troubleshooting.md).
- **NEVER call `renderMedia` directly inside an HTTP request handler**: blocks the event loop and times out on long videos. Queue it — see [integration-queue.md](integration-queue.md).

## Server-side render endpoint pattern

A common shape: HTTP endpoint enqueues, worker renders, signed URL returned later. See the full pattern in [integration-queue.md](integration-queue.md) and [integration-nextjs.md](integration-nextjs.md).
