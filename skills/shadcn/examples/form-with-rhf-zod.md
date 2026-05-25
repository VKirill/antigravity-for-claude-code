# Form with React Hook Form + Zod + shadcn

## Scenario

Build a user profile form with text inputs, a select, a checkbox group, and a submit that calls a Next.js Server Action. Includes loading state, server-side error handling, and success feedback via Sonner toast.

## Setup

```bash
npx shadcn add form input textarea select checkbox button sonner label
npm install @hookform/resolvers zod
```

## Step 1: Define the Zod schema

```ts
// lib/schemas/profile.ts
import { z } from "zod"

export const profileSchema = z.object({
  displayName: z
    .string()
    .min(2, "Display name must be at least 2 characters")
    .max(50, "Display name must be 50 characters or less"),
  email: z.string().email("Enter a valid email address"),
  bio: z
    .string()
    .max(500, "Bio must be 500 characters or less")
    .optional(),
  role: z.enum(["developer", "designer", "manager", "other"], {
    errorMap: () => ({ message: "Select a valid role" }),
  }),
  notifications: z.object({
    email: z.boolean(),
    push: z.boolean(),
    marketing: z.boolean(),
  }),
})

export type ProfileFormValues = z.infer<typeof profileSchema>
```

## Step 2: Create the Server Action

```ts
// app/actions/profile.ts
"use server"
import { profileSchema, type ProfileFormValues } from "@/lib/schemas/profile"
import { revalidatePath } from "next/cache"

export async function updateProfile(data: ProfileFormValues) {
  // Validate on server too (never trust client-only validation)
  const result = profileSchema.safeParse(data)
  if (!result.success) {
    return { success: false, error: "Invalid data" } as const
  }

  try {
    // await db.user.update({ where: { id: ... }, data: result.data })
    revalidatePath("/settings")
    return { success: true } as const
  } catch (err) {
    return { success: false, error: "Failed to update profile" } as const
  }
}
```

## Step 3: Build the form component

```tsx
// components/profile-form.tsx
"use client"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { profileSchema, type ProfileFormValues } from "@/lib/schemas/profile"
import { updateProfile } from "@/app/actions/profile"

interface ProfileFormProps {
  defaultValues?: Partial<ProfileFormValues>
}

const notificationOptions = [
  { id: "email", label: "Email notifications" },
  { id: "push", label: "Push notifications" },
  { id: "marketing", label: "Marketing emails" },
] as const

export function ProfileForm({ defaultValues }: ProfileFormProps) {
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: defaultValues?.displayName ?? "",
      email: defaultValues?.email ?? "",
      bio: defaultValues?.bio ?? "",
      role: defaultValues?.role ?? "developer",
      notifications: {
        email: defaultValues?.notifications?.email ?? true,
        push: defaultValues?.notifications?.push ?? false,
        marketing: defaultValues?.notifications?.marketing ?? false,
      },
    },
  })

  async function onSubmit(values: ProfileFormValues) {
    const result = await updateProfile(values)

    if (!result.success) {
      // Surface server error to a specific field
      if (result.error === "Email already taken") {
        form.setError("email", { message: result.error })
      } else {
        toast.error("Failed to save profile", { description: result.error })
      }
      return
    }

    toast.success("Profile updated!")
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

        {/* Display name */}
        <FormField
          control={form.control}
          name="displayName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Display Name</FormLabel>
              <FormControl>
                <Input placeholder="Jane Smith" {...field} />
              </FormControl>
              <FormDescription>
                This is your public display name.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Email */}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="jane@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Bio (optional textarea) */}
        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bio</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Tell us a little about yourself..."
                  className="resize-none"
                  rows={4}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                {field.value?.length ?? 0}/500 characters
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Role select */}
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="developer">Developer</SelectItem>
                  <SelectItem value="designer">Designer</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Notification checkboxes */}
        <div>
          <FormLabel className="text-base">Notifications</FormLabel>
          <FormDescription className="mb-3">
            Select which notifications you'd like to receive.
          </FormDescription>
          <div className="space-y-2">
            {notificationOptions.map((option) => (
              <FormField
                key={option.id}
                control={form.control}
                name={`notifications.${option.id}`}
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">
                      {option.label}
                    </FormLabel>
                  </FormItem>
                )}
              />
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <Button
            type="submit"
            disabled={form.formState.isSubmitting || !form.formState.isDirty}
          >
            {form.formState.isSubmitting ? "Saving..." : "Save profile"}
          </Button>
          {form.formState.isDirty && (
            <Button
              type="button"
              variant="outline"
              onClick={() => form.reset()}
            >
              Discard changes
            </Button>
          )}
        </div>

      </form>
    </Form>
  )
}
```

## Step 4: Wire up in a page

```tsx
// app/settings/profile/page.tsx
import { ProfileForm } from "@/components/profile-form"
import { getCurrentUser } from "@/lib/auth"

export default async function ProfileSettingsPage() {
  const user = await getCurrentUser()

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Profile Settings</h1>
        <p className="text-muted-foreground">Update your profile information.</p>
      </div>
      <ProfileForm
        defaultValues={{
          displayName: user.name,
          email: user.email,
          bio: user.bio ?? "",
          role: user.role,
          notifications: user.notificationPreferences,
        }}
      />
    </div>
  )
}
```

## Verification checklist

- [ ] Display name under 2 chars shows "at least 2 characters" error on submit
- [ ] Email field shows "Enter a valid email address" for invalid input
- [ ] Bio counter updates as user types; shows error at 501+ chars
- [ ] Select shows correct initial value; selecting different option updates form state
- [ ] Checkboxes reflect `defaultValues` on load
- [ ] Submit button disabled while submitting and when form is pristine
- [ ] "Discard changes" button appears only when form is dirty
- [ ] On success: toast fires "Profile updated!", button re-disables (form no longer dirty)
- [ ] On server error: toast fires with error message OR field-level error appears on email
- [ ] Screen reader announces each label correctly (test with VoiceOver / NVDA)
