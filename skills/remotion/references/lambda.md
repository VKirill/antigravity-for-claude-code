# Remotion Lambda — AWS rendering

`@remotion/lambda` runs renders as massively-parallel AWS Lambda invocations. Each function renders a chunk of frames; results merge back via S3. Fastest path for video rendering at scale; replaces having to maintain Chromium-on-Linux on your own boxes.

> **License note**: Lambda rendering at commercial scale requires Remotion Cloud Rendering Units / a Company License. Check Remotion's licensing page before deploying to production.

## When to use Lambda vs local render

| Scenario | Local `renderMedia` | Lambda |
|---|---|---|
| One-off render on dev machine | Yes | No |
| Long video (>2 min) on a small server | No — slow | Yes |
| Many parallel users requesting renders | No — head-of-line blocking | Yes |
| Render time budget < 30 s | Maybe | Yes (parallel chunks) |
| Video > ~2 hours / output > 5 GB | Yes | No — Lambda caps |
| Need GPU encoding | Yes (with right host) | No — Lambda is CPU-only |
| Cannot use AWS for compliance | Yes | No |

## One-time setup

```bash
# 1. AWS credentials in env: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
# 2. Deploy the Lambda function (one per region)
npx remotion lambda functions deploy

# 3. Deploy your Remotion site (bundle + upload to S3)
npx remotion lambda sites create src/index.ts --site-name=my-video

# 4. Optionally: set permissions policies, see Remotion docs for IAM JSON
```

The deployed site URL (`https://remotionlambda-...s3....amazonaws.com/sites/my-video/index.html`) is your `serveUrl` for Lambda renders. Re-run `sites create` when composition code changes.

## Programmatic render

```ts
import {
  renderMediaOnLambda,
  getFunctions,
  getSites,
  getRenderProgress,
} from "@remotion/lambda/client";

const { functions } = await getFunctions({
  region: "us-east-1",
  compatibleOnly: true,
});

const { sites } = await getSites({ region: "us-east-1" });
const site = sites.find((s) => s.id === "my-video");

const { renderId, bucketName } = await renderMediaOnLambda({
  region: "us-east-1",
  functionName: functions[0].functionName,
  serveUrl: site.serveUrl,
  composition: "HelloWorld",
  inputProps: { title: "Hi" },
  codec: "h264",
  privacy: "public",
  // optional:
  // framesPerLambda: 80,        // chunk size (tune for speed vs concurrency)
  // maxRetries: 1,
  // outName: "hello.mp4",
  // imageFormat: "jpeg",
  // jpegQuality: 80,
});

// Poll progress
while (true) {
  const progress = await getRenderProgress({
    renderId,
    bucketName,
    functionName: functions[0].functionName,
    region: "us-east-1",
  });
  if (progress.done) {
    console.log("URL:", progress.outputFile); // signed S3 URL
    break;
  }
  if (progress.fatalErrorEncountered) {
    throw new Error(progress.errors[0]?.message ?? "Lambda render failed");
  }
  await new Promise((r) => setTimeout(r, 2000));
}
```

`/client` subpath imports avoid pulling in AWS SDK pieces you don't need in browser-adjacent code paths.

## Key parameters

| Param | Notes |
|---|---|
| `region` | AWS region. Must match where you deployed the function + site |
| `functionName` | Returned by `getFunctions()` |
| `serveUrl` | From `getSites()` |
| `composition` | The `id` from your `<Composition>` |
| `inputProps` | JSON-serializable props |
| `codec` | h264 / h265 / vp8 / vp9 / prores / gif / mp3 / wav / aac |
| `privacy` | `"public"` \| `"private"` \| `"no-acl"` — controls S3 ACL of output |
| `framesPerLambda` | Frames per chunk. Smaller → more parallelism but more invocations. Default auto |
| `maxRetries` | Retry chunked render on transient failure (default 1) |
| `concurrencyPerLambda` | Tabs per Lambda. Default 1; rarely tuned |
| `webhook` | `{ url, secret }` — Lambda POSTs when done. Alternative to polling |
| `outName` | Output filename in the bucket |
| `downloadBehavior` | `{ type: "download", fileName }` for forced download header |

## Progress shape

```ts
{
  chunks: number;
  done: boolean;
  encodingStatus: { framesEncoded: number; doneIn: number | null } | null;
  renderMetadata: { ... } | null;
  bucket: string;
  outputFile: string | null;     // signed S3 URL when done
  outKey: string | null;
  timeToFinish: number | null;
  errors: { message: string; stack?: string; chunk?: number; ... }[];
  fatalErrorEncountered: boolean;
  currentTime: number;
  renderId: string;
  costs: { accruedSoFar: number; displayCost: string; currency: string; estimatedCost: number };
  ...
}
```

`costs` is invaluable for cost dashboards — surface `displayCost` per render in your admin UI.

## Webhook flow (preferred over polling at scale)

Pass `webhook` to `renderMediaOnLambda`. Lambda POSTs to your URL when the render finishes or fails. Verify the `X-Remotion-Signature` HMAC against your `secret` before trusting the payload.

```ts
await renderMediaOnLambda({
  // ...
  webhook: {
    url: "https://app.example.com/api/remotion-webhook",
    secret: process.env.REMOTION_WEBHOOK_SECRET!,
  },
});
```

In your handler, validate the signature, look up the `renderId`, update the job row, and notify the user.

## Cost knobs

- **`framesPerLambda`**: Smaller chunks → faster render but each Lambda has fixed startup overhead. Tune by composition length. Defaults are sensible.
- **Memory**: Set when deploying the function (`functions deploy --memory=3008`). Higher memory = proportionally faster CPU. Sweet spot for most renders is 2048–3008 MB.
- **Disk size**: `--disk=2048` MB for compositions with large source videos.
- **Region**: Pick the one nearest your S3 bucket and end users. Cross-region transfer is billed.

## Common failure modes

- **`Lambda timed out`** — bump `framesPerLambda` down so each invocation does fewer frames; or raise function memory (faster CPU).
- **`Disk full`** — raise `--disk` on deploy; clean S3 of stale renders.
- **`Composition not found`** — `composition` id mismatch with `<Composition id="...">` in code; or you forgot to redeploy the site after changing it.
- **Fonts wrong on Lambda but fine locally** — Lambda's Chromium doesn't see your OS fonts. Load via `@remotion/google-fonts` or bundle fonts under `public/`. See [troubleshooting.md](troubleshooting.md).
- **S3 URL expires** — `outputFile` is a presigned URL. Cache it for ≥1 hour or store the object key and re-sign on demand.

## Cleanup

```bash
# Remove old sites
npx remotion lambda sites ls
npx remotion lambda sites rm <site-id>

# Remove old function versions
npx remotion lambda functions ls
npx remotion lambda functions rmall    # uninstall everything

# Renders are S3 objects — set a lifecycle policy on `remotionlambda-*` bucket
```

Always set an S3 lifecycle rule to expire renders older than N days. Otherwise costs leak.

## See also

- [integration-queue.md](integration-queue.md) — queueing Lambda renders behind a BullMQ job (signed URL persistence, retries on top of `maxRetries`)
- [integration-nextjs.md](integration-nextjs.md) — calling Lambda from a Server Action and returning the eventual signed URL to the client
- [troubleshooting.md](troubleshooting.md) — Lambda-specific errors
