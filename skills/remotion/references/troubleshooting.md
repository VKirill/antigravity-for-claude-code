# Troubleshooting

Common failure modes for Remotion projects, in roughly the order you'll hit them.

## Linux Chromium dependencies

Symptom — `renderMedia` on Linux fails with `error while loading shared libraries: libnss3.so` or similar.

Fix — install the libraries Chromium needs. On Ubuntu/Debian:

```bash
sudo apt-get install -y \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
  libgbm1 libasound2t64 libpangocairo-1.0-0 libgtk-3-0 libxshmfence1 \
  fonts-liberation libappindicator3-1
```

`bun create video` and Remotion's setup docs install these implicitly during template scaffolding. On a bare Ubuntu 24.04 server, install manually.

## FFmpeg

Remotion bundles its own FFmpeg binary via `@remotion/renderer`; you do **not** need a system FFmpeg for `renderMedia`. If you see "FFmpeg not found":

- Check `node_modules/@remotion/compositor-*/` exists (the platform-specific binary).
- Rebuild the install: `rm -rf node_modules pnpm-lock.yaml && pnpm install` (or your package manager equivalent).
- On uncommon architectures (ARM Linux, etc.) verify the binary is published for your platform.

For direct ffmpeg invocations (silence detection, trimming, transcoding) outside of `renderMedia`, install system ffmpeg (`apt-get install ffmpeg`) and use it from Node via `child_process`.

See [upstream/rules/ffmpeg.md](upstream/rules/ffmpeg.md).

## Fonts

Symptom — font renders as fallback (serif/Arial) instead of the one you specified, or differs between dev and production.

Causes:

1. **Font not loaded yet at render time.** Remotion does not magically wait. Use `@remotion/google-fonts` (preferred) or `loadFont()` from `@remotion/fonts`, and `await` font load before first render. See [upstream/rules/google-fonts.md](upstream/rules/google-fonts.md) and [upstream/rules/local-fonts.md](upstream/rules/local-fonts.md).
2. **Self-hosted font behind auth.** Move to `public/fonts/<file>.woff2` so `staticFile()` can serve it.
3. **Lambda render but font only in local OS.** Lambda's Chromium does not see your system fonts. Bundle into `public/` or use Google Fonts.

## OOM / Chromium crash

Symptoms — worker dies mid-render with `Killed` / SIGKILL, or `Page crashed!` in stderr.

Causes & fixes:

- **Too much per-frame DOM** (long lists, many videos). Drop `<Sequence>` mounts for off-screen content using `durationInFrames`.
- **Source `<Video>` or `<Img>` is huge.** Pre-process to a smaller resolution.
- **`renderMedia({ concurrency })` too high.** Each parallel tab holds the entire DOM. Lower to 1–2 and measure.
- **Worker `concurrency` too high.** Multiple parallel renders compound the above. Start at 1.
- **Container memory limit too low.** Set ≥ 4 GB for a single render, ≥ 8 GB if rendering multiple concurrently or with large source videos.

For Lambda OOM: bump function memory (`functions deploy --memory=3008`); halve `framesPerLambda`.

## Lambda timeouts

Symptom — `Lambda timed out` or per-chunk error in `getRenderProgress`.

Default Lambda function timeout is 120 s. Each chunk render must fit in that. Fixes:

- Reduce `framesPerLambda` so each invocation does less work.
- Raise function memory (more memory = faster CPU on Lambda).
- For very slow-per-frame compositions (3D, heavy canvas) bump function timeout via `functions deploy --timeout=300`.

See [lambda.md](lambda.md) for the deploy commands.

## Lambda permissions

Symptom — `AccessDenied` on S3 PUT, or `IAM role does not allow lambda:InvokeFunction`.

The Remotion CLI ships an IAM policy JSON. Re-run `npx remotion lambda policies role` and `policies user` to print the required policies and attach them. Cross-region renders need bucket permissions in the source region.

## Composition not found

Symptom — `Composition with id "X" not found`.

- `id` mismatch between code and your call. The id is the string in `<Composition id="...">`.
- For Lambda: you rebuilt the composition but did not redeploy the site (`npx remotion lambda sites create`).
- For programmatic renders: did you pass the right `serveUrl`?

## Audio drift / desync

- Mismatch between composition `fps` and audio sample rate. Use 30 fps with 48000 Hz audio (or 24/25/30/60 fps generally).
- Audio source has a leading silence Remotion doesn't account for — trim the source.
- `<Audio>` re-mounts every Sequence; prefer one outer `<Audio>` with `startFrom`/`endAt` rather than several small ones.

See [upstream/rules/audio.md](upstream/rules/audio.md).

## Tailwind classes don't take effect during render

- Tailwind animation utilities (`animate-spin`, `animate-pulse`) are CSS animations — forbidden in Remotion. Replace with `interpolate()`-driven inline styles.
- If non-animation classes don't apply: the Tailwind preset path is missing. See [upstream/rules/tailwind.md](upstream/rules/tailwind.md).

## Studio is slow / freezes

- Reduce `<Player>` quality with `renderLoading` placeholders.
- Heavy `calculateMetadata` runs on every prop edit — debounce internally or cache fetched data.
- Disable HMR for compositions you're not actively editing (move them under a different `<Folder>` outside the Studio entry).

## Render output is black / blank

- The composition's root is not `<AbsoluteFill>` and is sized 0×0.
- `useCurrentFrame()` returns a frame before any sequence's `from` — the component is mounted but conditionally renders nothing.
- A parent has `display: none` or `opacity: 0` outside the visible frame range.

Drop a `style={{ background: 'red' }}` on the outer element. If the frame turns red, your child's layout is wrong; if it stays black, the component itself isn't mounting.

## Render output has a watermark / dev banner

Remotion Studio shows a development indicator that does **not** appear in `renderMedia` output. If you see a watermark in the final MP4, something else is drawing it (an `<Img>` you forgot, a CSS pseudo-element, etc.).

## Verbose logs

```bash
npx remotion render <id> --log=verbose
```

For programmatic:

```ts
import { RenderInternals } from "@remotion/renderer";
RenderInternals.Log.verbose = true;
// or pass `logLevel: "verbose"` to renderMedia
```

## When stuck

1. Reproduce locally first (`npx remotion render`) — eliminates infra variables.
2. Reproduce with the smallest possible composition — eliminates code variables.
3. Render a still at frame 0 (`npx remotion still`) — eliminates encoding.
4. Render a 1-second range (`--frames=0-30`) — eliminates audio mux.
5. Inspect `slowestFrames` from `renderMedia` result for outliers.

If still stuck — open `references/upstream/rules/` for the specific topic and read that file end-to-end.
