# Typed Server API with h3 + Zod

End-to-end example: typed POST endpoint for creating a user, with Zod validation, error handling, and a typed client-side composable.

## Server route — `server/api/users.post.ts`

```ts
import { z } from 'zod'

const CreateUserSchema = z.object({
  name:  z.string().min(1).max(100),
  email: z.string().email(),
  role:  z.enum(['admin', 'user', 'viewer']).default('user'),
})

// Export the type for use in client composable
export type CreateUserInput = z.infer<typeof CreateUserSchema>

export interface UserCreatedResponse {
  id:        string
  name:      string
  email:     string
  role:      string
  createdAt: string
}

export default defineEventHandler(async (event): Promise<UserCreatedResponse> => {
  const rawBody = await readBody(event)
  const result = CreateUserSchema.safeParse(rawBody)

  if (!result.success) {
    throw createError({
      statusCode: 422,
      message: 'Validation failed',
      data: result.error.flatten(),
    })
  }

  const { name, email, role } = result.data

  // Check for existing user
  const existing = await getUserByEmail(email)  // your DB call
  if (existing) {
    throw createError({ statusCode: 409, message: 'Email already registered' })
  }

  const user = await createUser({ name, email, role })  // your DB call

  setResponseStatus(event, 201)
  return {
    id:        user.id,
    name:      user.name,
    email:     user.email,
    role:      user.role,
    createdAt: user.createdAt.toISOString(),
  }
})
```

## Client composable — `app/composables/useCreateUser.ts`

```ts
import type { CreateUserInput, UserCreatedResponse } from '~/server/api/users.post'

interface UseCreateUserReturn {
  createUser:  (input: CreateUserInput) => Promise<UserCreatedResponse>
  loading:     Ref<boolean>
  error:       Ref<string | null>
}

export function useCreateUser(): UseCreateUserReturn {
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function createUser(input: CreateUserInput): Promise<UserCreatedResponse> {
    loading.value = true
    error.value = null

    try {
      return await $fetch<UserCreatedResponse>('/api/users', {
        method: 'POST',
        body: input,
      })
    } catch (err: unknown) {
      const e = err as { data?: { message?: string }; message?: string }
      error.value = e?.data?.message ?? e?.message ?? 'Unknown error'
      throw err
    } finally {
      loading.value = false
    }
  }

  return { createUser, loading, error }
}
```

## Page component — `app/pages/users/create.vue`

```vue
<script setup lang="ts">
import type { CreateUserInput } from '~/server/api/users.post'

definePageMeta({ middleware: 'auth' })

const { createUser, loading, error } = useCreateUser()
const router = useRouter()

const form = reactive<CreateUserInput>({
  name:  '',
  email: '',
  role:  'user',
})

async function handleSubmit() {
  try {
    const user = await createUser(form)
    await router.push(`/users/${user.id}`)
  } catch {
    // error.value is already set by the composable
  }
}
</script>

<template>
  <div class="max-w-md mx-auto p-6">
    <h1 class="text-2xl font-bold mb-4">Create User</h1>

    <form @submit.prevent="handleSubmit" class="space-y-4">
      <div>
        <label class="block text-sm font-medium mb-1">Name</label>
        <input v-model="form.name" type="text" required class="w-full border rounded px-3 py-2" />
      </div>

      <div>
        <label class="block text-sm font-medium mb-1">Email</label>
        <input v-model="form.email" type="email" required class="w-full border rounded px-3 py-2" />
      </div>

      <div>
        <label class="block text-sm font-medium mb-1">Role</label>
        <select v-model="form.role" class="w-full border rounded px-3 py-2">
          <option value="user">User</option>
          <option value="admin">Admin</option>
          <option value="viewer">Viewer</option>
        </select>
      </div>

      <p v-if="error" class="text-red-600 text-sm">{{ error }}</p>

      <button
        type="submit"
        :disabled="loading"
        class="w-full bg-blue-600 text-white py-2 rounded disabled:opacity-50"
      >
        {{ loading ? 'Creating...' : 'Create User' }}
      </button>
    </form>
  </div>
</template>
```

## Key patterns demonstrated

1. **Schema export** — `CreateUserInput` and `UserCreatedResponse` are exported from the server file and imported by the client. No duplicate type definitions.
2. **`safeParse` over `parse`** — catches validation errors without throwing; re-throws as HTTP 422 with structured error data.
3. **Conflict check before creation** — returns 409 Conflict if email exists; server responsibility.
4. **`$fetch` in composable** — fire-and-forget inside an event handler (button submit), not inside SSR lifecycle, so `$fetch` is correct (not `useAsyncData`).
5. **`definePageMeta` middleware** — auth guard applied at route level, not inside component logic.
