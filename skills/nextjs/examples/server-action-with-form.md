# Server Action with Form — Full Flow

## Scenario

A user submits a "Create Post" form. The action validates with Zod, inserts into the database, revalidates the cache, and redirects. The form shows inline field errors on failure and disables the submit button during submission.

## Stack

- Next.js 16 (App Router)
- React 19 `useActionState`
- Zod 4
- Prisma 7 (or any DB)

## Step 1: Define the Zod schema

```ts
// lib/schemas/post.ts
import { z } from 'zod'

export const CreatePostSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  content: z.string().min(10, 'Content must be at least 10 characters'),
  published: z.boolean().default(false),
})

export type CreatePostInput = z.infer<typeof CreatePostSchema>
```

## Step 2: Define the action state type

```ts
// lib/actions/types.ts
export type ActionState<T extends Record<string, unknown> = Record<string, string[]>> = {
  errors?: Partial<T>
  message?: string
  success?: boolean
}
```

## Step 3: Write the Server Action

```ts
// app/posts/actions.ts
'use server'

import { revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { CreatePostSchema } from '@/lib/schemas/post'
import type { ActionState } from '@/lib/actions/types'
import { db } from '@/lib/db'

type PostErrors = {
  title: string[]
  content: string[]
  published: string[]
}

export async function createPost(
  prevState: ActionState<PostErrors>,
  formData: FormData
): Promise<ActionState<PostErrors>> {
  const raw = {
    title: formData.get('title'),
    content: formData.get('content'),
    published: formData.get('published') === 'on',
  }

  const parsed = CreatePostSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors as PostErrors,
      message: 'Please fix the errors below.',
    }
  }

  try {
    const post = await db.post.create({ data: parsed.data })
    revalidateTag('posts')                        // invalidate posts cache
    revalidateTag(`post-${post.id}`)              // invalidate this post's cache
  } catch (err) {
    console.error('createPost error:', err)
    return { message: 'Failed to create post. Please try again.' }
  }

  redirect(`/posts`)                              // throws — terminates action on success
}
```

## Step 4: Write the form component

```tsx
// app/posts/new/page.tsx
import { CreatePostForm } from './CreatePostForm'

export const metadata = { title: 'New Post' }

export default function NewPostPage() {
  return (
    <main>
      <h1>Create Post</h1>
      <CreatePostForm />
    </main>
  )
}
```

```tsx
// app/posts/new/CreatePostForm.tsx
'use client'

import { useActionState } from 'react'
import { createPost } from '../actions'

const initialState = {}

export function CreatePostForm() {
  const [state, action, isPending] = useActionState(createPost, initialState)

  return (
    <form action={action} noValidate>
      {/* Global message (non-field error) */}
      {state.message && !state.success && (
        <p role="alert" className="error-banner">{state.message}</p>
      )}

      <div>
        <label htmlFor="title">Title</label>
        <input
          id="title"
          name="title"
          type="text"
          aria-describedby="title-error"
          aria-invalid={!!state.errors?.title}
          required
        />
        {state.errors?.title && (
          <ul id="title-error" role="alert">
            {state.errors.title.map((e) => <li key={e}>{e}</li>)}
          </ul>
        )}
      </div>

      <div>
        <label htmlFor="content">Content</label>
        <textarea
          id="content"
          name="content"
          rows={8}
          aria-describedby="content-error"
          aria-invalid={!!state.errors?.content}
          required
        />
        {state.errors?.content && (
          <ul id="content-error" role="alert">
            {state.errors.content.map((e) => <li key={e}>{e}</li>)}
          </ul>
        )}
      </div>

      <div>
        <label>
          <input type="checkbox" name="published" />
          Publish immediately
        </label>
      </div>

      <button type="submit" disabled={isPending} aria-busy={isPending}>
        {isPending ? 'Creating…' : 'Create Post'}
      </button>
    </form>
  )
}
```

## Step 5: Add optimistic update (optional)

When you want the UI to respond immediately before the server confirms:

```tsx
'use client'

import { useActionState, useOptimistic } from 'react'
import { createPost } from '../actions'

export function CreatePostFormOptimistic({ existingPosts }: { existingPosts: Post[] }) {
  const [state, action, isPending] = useActionState(createPost, {})
  const [optimisticPosts, addOptimistic] = useOptimistic(
    existingPosts,
    (current, newPost: Post) => [...current, newPost]
  )

  function handleAction(formData: FormData) {
    addOptimistic({
      id: 'optimistic',
      title: formData.get('title') as string,
      content: formData.get('content') as string,
      published: false,
    })
    action(formData)
  }

  return (
    <>
      <ul>
        {optimisticPosts.map((post) => (
          <li key={post.id} style={{ opacity: post.id === 'optimistic' ? 0.5 : 1 }}>
            {post.title}
          </li>
        ))}
      </ul>
      <form action={handleAction}>{/* fields */}</form>
    </>
  )
}
```

## Verification checklist

- [ ] Submitting with empty fields shows inline errors per-field
- [ ] Submitting valid data creates the post and redirects to `/posts`
- [ ] Submit button is disabled while form is pending (`isPending = true`)
- [ ] `revalidateTag('posts')` fires — posts list page shows new post without hard reload
- [ ] DB error returns non-success message without crashing
- [ ] Zod validation error message text matches schema constraints
