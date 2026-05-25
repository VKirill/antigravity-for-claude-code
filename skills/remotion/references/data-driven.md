# Data-driven compositions — props, calculateMetadata, Zod schemas

Patterns for parameterizing a composition: typed props, dynamic duration/dimensions, schema-validated input. Extends [upstream/rules/calculate-metadata.md](upstream/rules/calculate-metadata.md) and [upstream/rules/parameters.md](upstream/rules/parameters.md).

## The three layers

1. **`defaultProps`** — static fallback Studio uses when no input is supplied
2. **`inputProps`** — runtime overrides passed via `renderMedia` / `--props=` / Lambda invoke
3. **`calculateMetadata`** — async function that reshapes props AND can change `durationInFrames`, `width`, `height`, `fps` based on the resolved input

## Zod schema as the contract

```ts
// src/compositions/ProductPromo/schema.ts
import { z } from "zod";

export const productPromoSchema = z.object({
  productId: z.string(),
  videoUrl: z.string().url(),
  highlightFrames: z.array(z.tuple([z.number(), z.number()])).default([]),
  watermarkOpacity: z.number().min(0).max(1).default(0.5),
});

export type ProductPromoProps = z.infer<typeof productPromoSchema>;
```

Wire it to the composition so Studio renders a typed editor:

```tsx
import { Composition } from "remotion";
import { productPromoSchema } from "./compositions/ProductPromo/schema";
import { ProductPromo } from "./compositions/ProductPromo/ProductPromo";

<Composition
  id="ProductPromo"
  component={ProductPromo}
  schema={productPromoSchema}
  defaultProps={{
    productId: "demo",
    videoUrl: "https://remotion.media/sample.mp4",
    highlightFrames: [],
    watermarkOpacity: 0.5,
  }}
  durationInFrames={300}
  fps={30}
  width={1080}
  height={1920}
/>
```

## calculateMetadata — dynamic shape

```tsx
import {
  CalculateMetadataFunction,
  Composition,
} from "remotion";
import { productPromoSchema, ProductPromoProps } from "./schema";
import { ProductPromo } from "./ProductPromo";

const calculateMetadata: CalculateMetadataFunction<ProductPromoProps> = async ({
  props,
  abortSignal,
}) => {
  // Fetch real product data
  const data = await fetch(`https://api.example.com/products/${props.productId}`, {
    signal: abortSignal,
  }).then((r) => r.json());

  return {
    durationInFrames: Math.ceil(data.intendedDurationSeconds * 30),
    width: data.aspect === "portrait" ? 1080 : 1920,
    height: data.aspect === "portrait" ? 1920 : 1080,
    props: {
      ...props,
      videoUrl: data.cdnUrl,            // override with the real CDN URL
    },
    fps: 30,
  };
};

<Composition
  id="ProductPromo"
  component={ProductPromo}
  schema={productPromoSchema}
  defaultProps={...}
  fps={30}
  width={1080}
  height={1920}
  durationInFrames={300}
  calculateMetadata={calculateMetadata}
/>
```

Key points:

- **`abortSignal`** must be threaded into every fetch — Studio cancels mid-edit when props change.
- The function returns a partial — only fields you want to override.
- The **shape returned must match** the composition's prop type (returning the wrong fields silently produces broken renders).
- **Side-effect-free**: do not POST/PATCH/DELETE; this runs many times during preview.

## JSON-serializable input rules

`inputProps` (and `defaultProps`) must be JSON-serializable. Remotion explicitly supports:

- All JSON primitives
- `Date` instances
- `Map` and `Set`
- `staticFile("path")` references

Do **not** pass: functions, class instances, `Buffer`, streams, DOM nodes, regexes, symbols.

## Passing props from the CLI

```bash
# Inline JSON
npx remotion render ProductPromo --props='{"productId":"sku-42"}'

# From a file
npx remotion render ProductPromo --props=./jobs/sku-42.json
```

## Passing props programmatically

```ts
import { renderMedia, selectComposition } from "@remotion/renderer";

const composition = await selectComposition({
  serveUrl,
  id: "ProductPromo",
  inputProps: { productId: "sku-42", videoUrl: "...", highlightFrames: [], watermarkOpacity: 0.5 },
});

// composition.durationInFrames now reflects calculateMetadata's output

await renderMedia({
  serveUrl,
  composition,
  codec: "h264",
  inputProps: { productId: "sku-42", videoUrl: "...", highlightFrames: [], watermarkOpacity: 0.5 },
  outputLocation: "out/sku-42.mp4",
});
```

Pass `inputProps` to **both** `selectComposition` and `renderMedia`. `selectComposition` needs them so `calculateMetadata` can resolve duration/dimensions before render.

## Validating server-side

The composition's Zod schema is your source of truth. Re-validate at the API edge:

```ts
import { productPromoSchema } from "@/remotion/compositions/ProductPromo/schema";

const props = productPromoSchema.parse(await request.json());
// now safe to enqueue / pass to renderMedia
```

This catches bad input before spinning up Chromium.

## getInputProps() inside the component

The render-side counterpart of `inputProps` is `getInputProps()`:

```tsx
import { getInputProps } from "remotion";

const root = getInputProps(); // returns the raw inputProps object
```

Useful at the Root level for one-time setup; inside a `<Composition>` component, prefer accepting props as React props (typed via the Zod-inferred type) so Studio's prop editor works.

## Multi-tenant templates

Pattern for "user picks a template, fills in fields, gets a render":

1. Each template = a `<Composition>` with a Zod schema as its public contract.
2. UI form is auto-generated from the schema (e.g., via `zod-to-json-schema` + JSON-schema form lib).
3. Form submit → POST to API → schema-validate → enqueue render with `inputProps`.
4. Worker reads inputProps, calls `selectComposition` + `renderMedia` (local) or `renderMediaOnLambda`.

See [integration-queue.md](integration-queue.md) for the worker side and [integration-nextjs.md](integration-nextjs.md) for the form side.

## Anti-patterns

- **Hardcoded fps/duration in the component body** — pass via `useVideoConfig()` always.
- **Network calls inside the component** — they run every frame. Resolve in `calculateMetadata` instead.
- **Non-serializable values in `defaultProps`** — Studio's prop editor breaks.
- **Skipping `abortSignal`** in `calculateMetadata` — leaks fetches when the user edits props rapidly.
