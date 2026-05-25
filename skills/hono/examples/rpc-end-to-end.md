# Example — End-to-end RPC with `hc<AppType>()`

Server publishes `AppType`; client imports it; types flow.

## File tree

```
apps/
├── api/                  # Hono server (Node or Workers)
│   ├── src/
│   │   ├── app.ts        # chained routes; exports AppType
│   │   └── server.ts     # @hono/node-server entry
│   ├── package.json
│   └── tsconfig.json
└── web/                  # React consumer
    ├── src/
    │   ├── api.ts        # `hc<AppType>()` setup
    │   └── App.tsx       # uses the client
    └── package.json
```

`apps/web/package.json` depends on `apps/api` via pnpm workspace: `"@my/api": "workspace:*"`.

## `apps/api/src/app.ts`

```ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const PostInput = z.object({ title: z.string().min(1), body: z.string() });
const Post = z.object({ id: z.number(), title: z.string(), body: z.string() });

const fakeDb: Array<z.infer<typeof Post>> = [
  { id: 1, title: 'First', body: 'Hello world' },
];

const app = new Hono();

const routes = app
  .get('/posts', (c) => c.json(fakeDb))
  .get('/posts/:id', (c) => {
    const id = Number(c.req.param('id'));
    const post = fakeDb.find((p) => p.id === id);
    if (!post) return c.json({ error: 'not_found' as const }, 404);
    return c.json(post);
  })
  .post('/posts', zValidator('json', PostInput), (c) => {
    const body = c.req.valid('json');
    const post = { id: fakeDb.length + 1, ...body };
    fakeDb.push(post);
    return c.json(post, 201);
  })
  .delete('/posts/:id', (c) => {
    const id = Number(c.req.param('id'));
    const i = fakeDb.findIndex((p) => p.id === id);
    if (i < 0) return c.json({ error: 'not_found' as const }, 404);
    fakeDb.splice(i, 1);
    return c.body(null, 204);
  });

export type AppType = typeof routes;
export default app;
```

## `apps/api/src/server.ts`

```ts
import { serve } from '@hono/node-server';
import app from './app';
serve({ fetch: app.fetch, port: 3001 });
```

## `apps/web/src/api.ts`

```ts
import { hc } from 'hono/client';
import type { AppType } from '@my/api/src/app';

export const api = hc<AppType>('http://localhost:3001');
```

## `apps/web/src/App.tsx`

```tsx
import { useEffect, useState } from 'react';
import { api } from './api';

type Post = { id: number; title: string; body: string };

export default function App() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [title, setTitle] = useState('');

  useEffect(() => {
    (async () => {
      const res = await api.posts.$get();
      if (res.ok) setPosts(await res.json());
    })();
  }, []);

  async function create() {
    const res = await api.posts.$post({ json: { title, body: 'placeholder' } });
    if (res.ok) {
      const newPost = await res.json();   // typed Post
      setPosts((ps) => [...ps, newPost]);
      setTitle('');
    }
  }

  async function remove(id: number) {
    const res = await api.posts[':id'].$delete({ param: { id: String(id) } });
    if (res.status === 204) setPosts((ps) => ps.filter((p) => p.id !== id));
  }

  return (
    <div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} />
      <button onClick={create}>add</button>
      <ul>{posts.map((p) => (
        <li key={p.id}>{p.title} <button onClick={() => remove(p.id)}>×</button></li>
      ))}</ul>
    </div>
  );
}
```

## Tests for the server

```ts
import { describe, it, expect } from 'vitest';
import app from '../src/app';

describe('posts', () => {
  it('lists posts', async () => {
    const res = await app.request('/posts');
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveLength(1);
  });

  it('creates a post', async () => {
    const res = await app.request('/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'New', body: 'B' }),
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ title: 'New' });
  });

  it('rejects bad body', async () => {
    const res = await app.request('/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown post', async () => {
    const res = await app.request('/posts/999');
    expect(res.status).toBe(404);
  });
});
```

## Why this works

- Routes MUST be chained (`app.get(...).post(...).delete(...)`) — TypeScript types the chain
- `AppType` is `typeof routes`, NOT `typeof app`
- The client is a `Proxy` — `api.posts.$get()` is just `fetch('/posts', { method: 'GET' })` with full types
- No code-generation step; types come from the same source as the server
- Errors per-status are narrowed if you return distinct shapes per status code
