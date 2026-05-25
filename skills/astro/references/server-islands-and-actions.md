# Server Islands & Astro Actions

Two complementary Astro 6.x primitives for dynamic behavior inside otherwise-static pages.

## Server Islands — `server:defer`

Render a page statically (cacheable, CDN-friendly) but defer one component to be SSR'd per-request, streamed in after the shell loads.

### Setup

Server Islands require an SSR-capable adapter (Node/Vercel/Cloudflare/Netlify) and `output: 'server'` or `'hybrid'`.

```js
// astro.config.mjs
import vercel from '@astrojs/vercel/serverless'

export default defineConfig({
  output: 'hybrid',
  adapter: vercel(),
})
```

### Use the directive

```astro
---
// src/pages/index.astro
export const prerender = true   // static page

import RecommendedProducts from '../components/RecommendedProducts.astro'
import LiveCounter from '../components/LiveCounter.astro'
---
<html>
  <body>
    <h1>Welcome</h1>
    <RecommendedProducts server:defer userId={Astro.cookies.get('uid')?.value} />
    <LiveCounter server:defer />
  </body>
</html>
```

### Fallback content

While the server island streams in, show a fallback:

```astro
<RecommendedProducts server:defer>
  <p slot="fallback">Loading recommendations…</p>
</RecommendedProducts>
```

### Caveats

- Server Islands can't accept slots that need framework children — only Astro children work
- Each island = one HTTP request from the shell page to the island endpoint
- Stream-in is via inline `<script>` that fetches and inlines the response — degrades gracefully (the fallback stays visible if JS fails)
- Don't use for top-of-page hero blocks (CLS risk)

## Astro Actions

Type-safe RPC + form integration. Define server functions in `src/actions/index.ts` and call from any client island or HTML form.

### Define actions

```ts
// src/actions/index.ts
import { defineAction } from 'astro:actions'
import { z } from 'astro:schema'

export const server = {
  subscribe: defineAction({
    accept: 'form',                       // 'form' | 'json' (default)
    input: z.object({
      email: z.string().email(),
      consent: z.boolean(),
    }),
    handler: async ({ email, consent }, context) => {
      if (!consent) throw new Error('Consent required')
      await db.subscribers.create({ data: { email } })
      return { ok: true, message: 'Subscribed' }
    },
  }),

  upvote: defineAction({
    input: z.object({ postId: z.string() }),
    handler: async ({ postId }, context) => {
      const userId = context.cookies.get('uid')?.value
      if (!userId) throw new Error('Must be logged in')
      return await db.upvotes.upsert({
        where: { postId_userId: { postId, userId } },
        create: { postId, userId },
        update: {},
      })
    },
  }),
}
```

### Call from a form (progressive enhancement)

```astro
---
// src/pages/newsletter.astro
import { actions } from 'astro:actions'
---
<form method="POST" action={actions.subscribe}>
  <input name="email" type="email" required />
  <label><input name="consent" type="checkbox" required /> I agree</label>
  <button>Subscribe</button>
</form>
```

The form works with **JS disabled** — Astro intercepts on the server. With JS enabled, the action returns a typed result and the page re-renders.

### Call from a client island

```tsx
// src/components/UpvoteButton.tsx
import { actions } from 'astro:actions'
import { useState } from 'react'

export default function UpvoteButton({ postId }: { postId: string }) {
  const [count, setCount] = useState(0)
  return (
    <button onClick={async () => {
      const { data, error } = await actions.upvote({ postId })
      if (error) return alert(error.message)
      setCount((c) => c + 1)
    }}>
      ▲ {count}
    </button>
  )
}
```

### Reading action results in a page after form submit

```astro
---
import { actions, getActionContext } from 'astro:actions'

const { action, setActionResult } = getActionContext(Astro)
if (action?.calledFrom === 'form') {
  // optionally inspect action.name, action.data
}
---
{Astro.getActionResult(actions.subscribe)?.data?.message && (
  <p>{Astro.getActionResult(actions.subscribe)!.data.message}</p>
)}
```

### Error handling

Actions return `{ data, error }`. `error` is a typed `ActionError` with `code`, `message`, optional `fields` (Zod issues). On the client:

```tsx
const { data, error } = await actions.subscribe(input)
if (error?.code === 'BAD_REQUEST' && error.fields) {
  // display field-level validation errors
}
```

Throw a custom code in the handler:

```ts
import { ActionError } from 'astro:actions'

handler: async ({ email }) => {
  if (await isBlacklisted(email)) {
    throw new ActionError({ code: 'FORBIDDEN', message: 'Email blocked' })
  }
}
```

## When to use which

| Scenario | Use |
|---|---|
| Read-only personalized region in a static page | Server Islands |
| User submits a form (newsletter, contact, login) | Actions (`accept: 'form'`) |
| Client-side button triggers a server mutation | Actions (JSON) |
| External API consumed by mobile apps too | Plain `src/pages/api/` endpoint |
| Per-request dashboard data | Full SSR page (`prerender = false`) |

## Common pitfalls

- **Server Islands without an adapter** → build fails. Server Islands need SSR capability.
- **Heavy auth checks in every Server Island** — auth once via middleware, pass via `Astro.locals`
- **Action handlers that don't validate input** — Zod schema is mandatory; never skip it
- **Calling actions in `getStaticPaths()`** — actions run per-request, not at build
- **Forgetting `accept: 'form'`** for HTML form submission — defaults to JSON which won't accept `multipart/form-data`
