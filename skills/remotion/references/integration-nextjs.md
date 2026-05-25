# Next.js integration — Player + server-side render

How to embed a Remotion preview in a Next.js (App Router) app and trigger renders from Server Actions or Route Handlers. Pairs with [integration-queue.md](integration-queue.md) for the render side and [lambda.md](lambda.md) for the cloud-render side.

## Two packages

- **`@remotion/player`** — the embeddable `<Player>` for browser preview. Client-only.
- **`remotion` + `@remotion/renderer` + `@remotion/bundler`** — server-side render. Node-only.

Keep their imports in separate modules. The renderer pulls Webpack + a headless Chromium download; you do not want that bundled into the browser.

## Embedding `<Player>`

`<Player>` runs the same composition code that renders on the server — but interactively, in the user's browser. Live edits to props re-render frames immediately.

```tsx
// app/preview/MyVideoPlayer.tsx
"use client";

import { Player } from "@remotion/player";
import { ProductPromo } from "@/remotion/compositions/ProductPromo/ProductPromo";
import type { ProductPromoProps } from "@/remotion/compositions/ProductPromo/schema";

export function MyVideoPlayer({ props }: { props: ProductPromoProps }) {
  return (
    <Player
      component={ProductPromo}
      inputProps={props}
      durationInFrames={300}
      fps={30}
      compositionWidth={1080}
      compositionHeight={1920}
      style={{ width: "100%", aspectRatio: "9 / 16" }}
      controls
      autoPlay
      loop
    />
  );
}
```

### Required `<Player>` props

| Prop | Type | Notes |
|---|---|---|
| `component` | React component | Same component you'd put in `<Composition>` |
| `inputProps` | object | Same shape as `<Composition>`'s defaultProps/schema |
| `durationInFrames` | number | Match the composition |
| `fps` | number | Match the composition |
| `compositionWidth` | number | Intrinsic width |
| `compositionHeight` | number | Intrinsic height |

### Common optional props

- `controls` — show built-in play/pause/scrubber
- `autoPlay`, `loop`
- `style` / `className` — sizes the iframe-like container (composition scales to fit)
- `clickToPlay` — toggle play on click
- `doubleClickToFullscreen`
- `spaceKeyToPlayOrPause`
- `playbackRate`
- `numberOfSharedAudioTags` — preallocate `<audio>` elements (fixes mobile autoplay)

### Imperative ref

```tsx
const playerRef = useRef<PlayerRef>(null);
playerRef.current?.play();
playerRef.current?.seekTo(60);
playerRef.current?.getCurrentFrame();
```

Use this when you need to drive playback from outside React tree (toolbar buttons, keyboard shortcuts).

## RSC / Client boundary

The composition components themselves are React, **but they reference Remotion hooks** (`useCurrentFrame`, `useVideoConfig`). Those hooks require the Remotion runtime context — they will throw in a Server Component. **Always mark composition-tree modules `"use client"`** or import them only from a `"use client"` file.

```tsx
// app/preview/page.tsx — Server Component
import { MyVideoPlayer } from "./MyVideoPlayer";          // client component
import { getProductForUser } from "@/lib/products";

export default async function Page() {
  const product = await getProductForUser();
  return <MyVideoPlayer props={{ productId: product.id, videoUrl: product.cdnUrl, highlightFrames: [], watermarkOpacity: 0.5 }} />;
}
```

The composition code lives under `src/remotion/` (or similar) and is imported only by client components and by the standalone Remotion bundle entry (`src/index.ts`).

## next.config — webpack/Turbopack notes

`@remotion/player` ships ESM. With recent Next.js it works out of the box. If you see "cannot use import statement outside a module" against `remotion`:

- Add `transpilePackages: ["remotion", "@remotion/player"]` to `next.config.js`.
- Use a dynamic import with `ssr: false`:

```tsx
const Player = dynamic(() => import("@remotion/player").then((m) => m.Player), {
  ssr: false,
});
```

## Server Action that triggers a render

DO NOT call `renderMedia` inline — it can take minutes. Enqueue instead.

```ts
// app/actions/start-render.ts
"use server";

import { productPromoSchema } from "@/remotion/compositions/ProductPromo/schema";
import { renderQueue } from "@/lib/queues";   // BullMQ Queue instance

export async function startRender(formData: FormData) {
  const raw = JSON.parse(formData.get("props") as string);
  const props = productPromoSchema.parse(raw);

  const job = await renderQueue.add(
    "product-promo",
    { compositionId: "ProductPromo", props },
    { attempts: 3, removeOnComplete: { age: 24 * 3600 } },
  );

  return { jobId: job.id };
}
```

See [integration-queue.md](integration-queue.md) for the worker side. Client polls `/api/jobs/[id]` or subscribes via SSE/WebSocket for completion.

## Route Handler — server-side still

For one-frame stills (social preview cards, OG images) `renderStill` is fast enough to call inline:

```ts
// app/api/og/[productId]/route.ts
import { NextRequest } from "next/server";
import path from "path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

export const runtime = "nodejs";    // NOT edge — Chromium needed

let serveUrlPromise: Promise<string> | null = null;
function getServeUrl() {
  if (!serveUrlPromise) {
    serveUrlPromise = bundle({
      entryPoint: path.resolve(process.cwd(), "src/remotion/index.ts"),
    });
  }
  return serveUrlPromise;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ productId: string }> }) {
  const { productId } = await ctx.params;
  const serveUrl = await getServeUrl();
  const inputProps = { productId, /* ... */ };
  const composition = await selectComposition({ serveUrl, id: "OgCard", inputProps });

  const outPath = `/tmp/og-${productId}.png`;
  await renderStill({ composition, serveUrl, output: outPath, frame: 0, inputProps, imageFormat: "png" });

  const buf = await (await import("node:fs/promises")).readFile(outPath);
  return new Response(buf, { headers: { "content-type": "image/png", "cache-control": "public, max-age=3600" } });
}
```

Notes:

- `runtime = "nodejs"` is mandatory. The Edge runtime cannot launch Chromium.
- Bundle once at startup, not per request. The `serveUrlPromise` cache handles that.
- For Next.js 16 with async params, `ctx.params` is a Promise — await it.
- For PNG OG cards, prefer Next.js's built-in `next/og` if you can. Use Remotion-rendered stills when you need the same composition that powers your videos.

## Versioning Remotion + Next.js

Keep the Remotion side in its own dependency block. The Player runs in the browser bundle; the bundler/renderer run in serverless or worker code. If you deploy to Vercel:

- The `@remotion/player` portion works on Vercel out of the box.
- `renderMedia` does **not** work on Vercel Functions (no Chromium, no ffmpeg, short timeout). Use Remotion Lambda or a self-hosted worker. See [lambda.md](lambda.md).

## Anti-patterns

- **Importing composition components into a Server Component.** Will crash at first render.
- **Calling `renderMedia` from a Route Handler / Server Action.** Blocks the response, times out, leaks Chromium.
- **Using Edge runtime for any render.** No Chromium binary available.
- **Sharing the `<Player>` ref across React contexts.** Fork it via callbacks or use a state library.
