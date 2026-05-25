# Remotion — Reference Index

Decision map for the rest of `references/`. Open the file you need; do not preload everything.

## Decision map

| If you are... | Open |
|---|---|
| Just learning the model — `<Composition>`, `<Sequence>`, `useCurrentFrame`, `useVideoConfig` | [compositions.md](compositions.md) |
| Rendering an MP4/WebM locally — CLI or `renderMedia()` from Node | [rendering.md](rendering.md) |
| Pushing renders to AWS — `@remotion/lambda`, `renderMediaOnLambda`, progress polling | [lambda.md](lambda.md) |
| Driving a composition from external data — props, `calculateMetadata`, Zod schemas | [data-driven.md](data-driven.md) |
| Embedding the preview in a Next.js app — `@remotion/player`, RSC boundaries, server actions | [integration-nextjs.md](integration-nextjs.md) |
| Offloading renders to a worker — BullMQ job, queue lifecycle, retries | [integration-queue.md](integration-queue.md) |
| Stuck — FFmpeg missing, font not loading, Lambda timeout, Chromium OOM | [troubleshooting.md](troubleshooting.md) |
| Wanting routing eval prompts for this skill | [eval-cases.md](eval-cases.md) |
| Needing the **canonical upstream rules** (compositions, sequencing, timing, transitions, captions, audio, etc.) | [upstream/SOURCE.md](upstream/SOURCE.md) — read its index, then open the specific `upstream/rules/<topic>.md` |

## Layering rule

Two reference sets coexist:

- **`upstream/`** — verbatim mirror of `remotion-dev/remotion/packages/skills/skills/remotion/`. Source-of-truth for framework APIs and patterns. Maintained by the Remotion team. Read-only.
- **Sibling files in `references/`** (this directory) — our integration extensions: how Remotion plugs into our Next.js apps, our BullMQ worker pool, our local dev/server matrix, our deployment quirks.

When the two diverge on a framework-level fact, **upstream wins**. When they diverge on infra (where renders run, how queues are configured, how Next.js hosts the Player), **our sibling files win** — because upstream doesn't know our infra.

## Quick links by API

| API / package | Primary reference |
|---|---|
| `<Composition>`, `registerRoot()` | [compositions.md](compositions.md), [upstream/rules/compositions.md](upstream/rules/compositions.md) |
| `<Sequence>`, `useCurrentFrame()`, `useVideoConfig()`, `interpolate()`, `spring()` | [compositions.md](compositions.md), [upstream/rules/sequencing.md](upstream/rules/sequencing.md), [upstream/rules/timing.md](upstream/rules/timing.md) |
| `renderMedia()`, `renderStill()`, `bundle()`, `selectComposition()` | [rendering.md](rendering.md) |
| `@remotion/lambda` — `deployFunction`, `deploySite`, `renderMediaOnLambda`, `getRenderProgress` | [lambda.md](lambda.md) |
| `calculateMetadata`, `defaultProps`, Zod `schema` | [data-driven.md](data-driven.md), [upstream/rules/calculate-metadata.md](upstream/rules/calculate-metadata.md), [upstream/rules/parameters.md](upstream/rules/parameters.md) |
| `<Player>` from `@remotion/player` | [integration-nextjs.md](integration-nextjs.md) |
| BullMQ render worker | [integration-queue.md](integration-queue.md) |
