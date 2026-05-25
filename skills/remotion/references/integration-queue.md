# Queue integration — BullMQ workers for renders

Renders are long, CPU/RAM-heavy, and unpredictable. The right shape is: **HTTP request enqueues, worker renders, signed URL returned later**. Cross-skill reference: the [bullmq](../../bullmq/SKILL.md) skill covers queue mechanics in depth — this file covers the Remotion-specific worker shape.

## Why a queue

- Render duration can exceed any HTTP timeout (60s on most edges, 5–15 min on Lambda functions).
- Chromium has bounded concurrency per host — queueing exposes a knob (`concurrency`) for matching workers to hosts.
- Failures should retry, not 500 to the user.
- Cost reporting and observability hang off the job lifecycle naturally.

## Queue + Worker shape

```ts
// lib/queues/renderQueue.ts
import { Queue, Worker, type Processor } from "bullmq";
import { Redis } from "ioredis";

const connection = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,  // BullMQ requirement
});

export type RenderJobData = {
  compositionId: string;
  props: Record<string, unknown>;
  outputName: string;
  userId: string;
};

export type RenderJobResult = {
  outputUrl: string;
  durationMs: number;
  cost?: { displayCost: string };
};

export const renderQueue = new Queue<RenderJobData, RenderJobResult>("renders", { connection });
```

```ts
// worker.ts — run as a separate process (PM2 / Docker / systemd)
import path from "path";
import fs from "node:fs/promises";
import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { RenderJobData, RenderJobResult } from "./lib/queues/renderQueue";

const connection = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

// Bundle ONCE at boot, reuse for every job
const serveUrlPromise = bundle({
  entryPoint: path.resolve(process.cwd(), "src/remotion/index.ts"),
});

const worker = new Worker<RenderJobData, RenderJobResult>(
  "renders",
  async (job) => {
    const start = Date.now();
    const serveUrl = await serveUrlPromise;

    const composition = await selectComposition({
      serveUrl,
      id: job.data.compositionId,
      inputProps: job.data.props,
    });

    await job.updateProgress({ phase: "rendering", percent: 0 });

    const outputLocation = `/tmp/${job.id}.mp4`;
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation,
      inputProps: job.data.props,
      onProgress: ({ progress }) => job.updateProgress({ phase: "rendering", percent: Math.round(progress * 100) }),
    });

    // Upload to your storage (S3 / R2 / etc.) and produce a signed URL
    const outputUrl = await uploadAndSign(outputLocation, job.data.outputName);
    await fs.unlink(outputLocation).catch(() => {});

    return { outputUrl, durationMs: Date.now() - start };
  },
  {
    connection,
    concurrency: Number(process.env.RENDER_CONCURRENCY ?? 1),
    lockDuration: 5 * 60 * 1000,   // 5 min; longer than your worst render frame
  },
);

worker.on("failed", (job, err) => console.error("[render] failed", job?.id, err));
process.on("SIGTERM", async () => { await worker.close(); process.exit(0); });
```

## Concurrency tuning

Rule of thumb: one Remotion render saturates ~2–4 CPU cores and 1–2 GB RAM (varies wildly with composition complexity). On an 8-core 16 GB worker host, start with `concurrency: 2` and measure.

Inside a single render, `renderMedia({ concurrency })` controls **frame-level parallelism**. The two knobs compose: `concurrency: 2` jobs × `concurrency: 4` frames = 8 parallel Chromium tabs.

## Lifecycle hooks

| Where | Use for |
|---|---|
| `job.updateProgress({ phase, percent })` | Surface render progress to the user via SSE/WebSocket |
| `worker.on("completed", ...)` | Persist final URL, notify user |
| `worker.on("failed", ...)` | Slack alert, increment failure counter, persist diagnostic |
| `worker.on("stalled", ...)` | Process crashed; usually means OOM — see [troubleshooting.md](troubleshooting.md) |

## Retry policy

```ts
await renderQueue.add(
  "product-promo",
  data,
  {
    attempts: 3,
    backoff: { type: "exponential", delay: 30_000 },
    removeOnComplete: { age: 24 * 3600, count: 1000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
);
```

Render failures are usually one of:

- Transient (Chromium crash, network timeout fetching assets) → retry helps
- Deterministic (bad inputProps, missing font, asset 404) → retry wastes money

Wrap your `renderMedia` call to **distinguish** and call `job.discard()` on non-retryable failures so BullMQ does not retry them.

## Lambda-backed worker

The same shape works with Remotion Lambda — the worker just delegates rendering to AWS:

```ts
import { renderMediaOnLambda, getRenderProgress } from "@remotion/lambda/client";

const { renderId, bucketName } = await renderMediaOnLambda({
  region, functionName, serveUrl,
  composition: job.data.compositionId,
  inputProps: job.data.props,
  codec: "h264",
  privacy: "public",
  webhook: { url: process.env.LAMBDA_WEBHOOK_URL!, secret: process.env.LAMBDA_WEBHOOK_SECRET! },
});

await job.updateData({ ...job.data, lambdaRenderId: renderId, lambdaBucket: bucketName });
// Worker can either poll getRenderProgress or hand off to webhook handler that fulfils a Promise

// If polling:
while (true) {
  const p = await getRenderProgress({ renderId, bucketName, functionName, region });
  await job.updateProgress({ phase: "lambda", percent: Math.round((p.chunks ? p.chunks : 0) * 100) });
  if (p.done) return { outputUrl: p.outputFile!, durationMs: Date.now() - start, cost: { displayCost: p.costs.displayCost } };
  if (p.fatalErrorEncountered) throw new Error(p.errors[0]?.message ?? "Lambda render failed");
  await new Promise((r) => setTimeout(r, 2000));
}
```

For high volume prefer the webhook flow over polling (see [lambda.md](lambda.md)).

## Graceful shutdown

Renders are long. Forced SIGKILL leaks Chromium processes and partial files. Always:

```ts
process.on("SIGTERM", async () => {
  await worker.close();    // waits for current job to finish (up to grace period)
  process.exit(0);
});
```

In Kubernetes / PM2, set the terminationGracePeriodSeconds / kill-timeout to at least your p99 render duration.

## Observability checklist

- Log job id + composition id + duration per render
- Surface BullMQ `getMetrics()` to your dashboard
- Track Chromium peak RSS via a sidecar (or `process.resourceUsage()` after render)
- For Lambda renders, persist `costs.displayCost` per render in your DB

## Anti-patterns

- **Bundling per job** — wastes 5–30 s per job on Webpack. Bundle at worker boot.
- **`concurrency: cpus.length`** — 1 render already uses several cores; you'll thrash. Start at 1–2 and measure.
- **Trusting client-supplied props blindly** — re-validate against your Zod schema in the worker (see [data-driven.md](data-driven.md)).
- **Returning the local path** — return a signed URL to remote storage; workers are ephemeral.
- **No `removeOnComplete`** — Redis fills up. Set an age-based cleanup.

See also: [bullmq SKILL](../../bullmq/SKILL.md) for queue patterns generally.
