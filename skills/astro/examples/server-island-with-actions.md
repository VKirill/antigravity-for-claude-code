# Server Island + Action — end-to-end

**Scenario**: A static marketing page that shows a personalized greeting (server-rendered per-request from session cookies) and a newsletter signup form that uses an Astro Action with Zod validation.

Why combine the two: the page itself is cached/static at the CDN (good Core Web Vitals); only the greeting component re-renders on the origin; the form works without JS (progressive enhancement) and gets a typed response when hydrated.

## Project layout

```
src/
├── components/
│   ├── Greeting.astro         ← Server Island (server:defer)
│   └── SignupForm.astro       ← Form posting to action
├── actions/
│   └── index.ts               ← defineAction with Zod
├── layouts/
│   └── Base.astro             ← <ClientRouter /> + slot
└── pages/
    └── index.astro            ← Static page mounting both
```

## 1. Define the Action

```ts
// src/actions/index.ts
import { defineAction } from "astro:actions";
import { z } from "astro/zod";

export const server = {
  subscribe: defineAction({
    accept: "form", // accept both JS-fetch and progressive HTML form POST
    input: z.object({
      email: z.string().email(),
      source: z.string().optional(),
    }),
    handler: async ({ email, source }, context) => {
      // context.cookies / context.request available
      await saveSubscriberToDb({ email, source });
      return { ok: true, email };
    },
  }),
};

async function saveSubscriberToDb(_args: { email: string; source?: string }) {
  // ... your DB call
}
```

## 2. Server Island for personalized greeting

```astro
---
// src/components/Greeting.astro
const session = Astro.cookies.get("session")?.value;
const user = session ? await lookupUser(session) : null;
---

<p class="text-lg">
  {user ? `Welcome back, ${user.name}!` : "Hello, stranger."}
</p>
```

In the page, mount it with `server:defer`:

```astro
---
// src/pages/index.astro
import Base from "../layouts/Base.astro";
import Greeting from "../components/Greeting.astro";
import SignupForm from "../components/SignupForm.astro";
---
<Base title="Home">
  <Greeting server:defer>
    <!-- fallback shown until the island streams in -->
    <span slot="fallback" class="text-gray-400">Loading…</span>
  </Greeting>

  <SignupForm />
</Base>
```

The page HTML ships statically; the `<Greeting>` component is rendered on each request and streamed into the static shell.

## 3. Form posting to the Action (progressive)

```astro
---
// src/components/SignupForm.astro
import { actions } from "astro:actions";
---
<form
  method="POST"
  action={actions.subscribe}
  class="flex gap-2"
>
  <input
    name="email"
    type="email"
    required
    placeholder="you@example.com"
    class="px-3 py-2 border rounded"
  />
  <input type="hidden" name="source" value="homepage" />
  <button type="submit" class="px-4 py-2 bg-black text-white rounded">
    Subscribe
  </button>
</form>
```

No client JS needed — Astro handles the form-encoded POST and runs the action.

## 4. Typed client-side enhancement (optional)

If you want optimistic UI or inline errors, hydrate a small island that calls the action via the typed client:

```tsx
// src/components/SignupFormReact.tsx
import { actions } from "astro:actions";
import { useState } from "react";

export function SignupFormReact() {
  const [state, setState] = useState<"idle" | "submitting" | "ok" | "error">("idle");

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setState("submitting");
        const fd = new FormData(e.currentTarget);
        const { data, error } = await actions.subscribe(fd);
        setState(error ? "error" : "ok");
      }}
    >
      {/* ... fields ... */}
      <button disabled={state === "submitting"}>Subscribe</button>
      {state === "ok" && <p>Thanks!</p>}
    </form>
  );
}
```

Mount with `client:visible`:

```astro
<SignupFormReact client:visible />
```

## 5. astro.config.mjs requirements

```js
// SSR adapter is required for both Server Islands and Actions
adapter: node({ mode: "standalone" })
output: "server"
```

For mostly-static sites: keep `output: 'server'` but mark the page `export const prerender = true` — Astro still resolves Server Islands and Actions correctly because they always render on the server.

## Verification

- **Without JS**: form still submits, action runs, server responds with redirect or HTML.
- **With JS hydrated** (`client:visible` island): action call is typed, errors surface inline.
- **Greeting**: page HTML at the CDN does NOT contain user-specific text; greeting streams in from origin per request.
- **Core Web Vitals**: LCP stays static-fast; greeting renders within ~50–200ms of HTML arrival via streaming.

## Common gotchas

- Server Islands require `output: 'server'` (or `'hybrid'` legacy). Pure `'static'` builds skip them.
- Actions require an SSR adapter — set `adapter:` even if your pages are mostly prerendered.
- `accept: 'form'` is required for progressive-enhancement form posts; without it, the form falls back to a JSON-only call.
- Zod for actions ships under `astro/zod` (re-export of the framework-bundled Zod) — prefer it over a separate `zod` install to avoid duplicate copies.
