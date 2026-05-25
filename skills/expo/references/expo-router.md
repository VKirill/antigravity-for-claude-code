# Expo Router — File-Based Navigation

Expo Router is the default routing system for Expo SDK 55. It wraps React Navigation and reads file structure under `app/` to derive routes.

## Enable

```ts
// app.config.ts
export default {
  expo: {
    scheme: 'myapp',
    plugins: ['expo-router'],
    experiments: { typedRoutes: true },
  },
};
```

`package.json` must declare `"main": "expo-router/entry"`.

## File-route mapping

| File | URL |
|---|---|
| `app/index.tsx` | `/` |
| `app/about.tsx` | `/about` |
| `app/posts/[id].tsx` | `/posts/:id` |
| `app/posts/[...slug].tsx` | catch-all |
| `app/(tabs)/feed.tsx` | `/feed` (group doesn't appear in URL) |
| `app/+not-found.tsx` | 404 fallback |
| `app/+html.tsx` | web HTML shell |

## Layouts

`_layout.tsx` is **not** a page — it wraps every route in its directory. Choose a navigator:

```tsx
// app/_layout.tsx — root
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Home' }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
```

```tsx
// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: 'Feed' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
```

```tsx
// app/(drawer)/_layout.tsx
import { Drawer } from 'expo-router/drawer';

export default function DrawerLayout() {
  return <Drawer />;
}
```

`Slot` renders the matched child without any navigator wrapper — useful for auth shells.

```tsx
import { Slot } from 'expo-router';
export default function AuthLayout() {
  return <Slot />;
}
```

## Hooks and components

```tsx
import {
  Link,
  Redirect,
  Stack,
  useRouter,
  useLocalSearchParams,
  useSegments,
  useNavigation,
  usePathname,
} from 'expo-router';
```

- `useRouter()` — programmatic navigation: `push`, `replace`, `back`, `setParams`, `dismiss`
- `useLocalSearchParams<T>()` — params for the current screen (re-renders on change)
- `useGlobalSearchParams()` — params from the nearest matching segment (does NOT re-render in stale frames)
- `useSegments()` — typed array of current segments, useful in root layouts for auth gating
- `usePathname()` — current pathname string

## Typed routes

With `experiments.typedRoutes: true`, route strings auto-complete and `<Link href="/posts/[id]" params={{ id }} />` is type-checked. Param types are inferred per route:

```tsx
import { useLocalSearchParams } from 'expo-router';

export default function Post() {
  // Statically infer from route shape
  const { id } = useLocalSearchParams<'/posts/[id]'>();
  return <Text>Post {id}</Text>;
}
```

Or pass an explicit generic:

```tsx
const { user, query } = useLocalSearchParams<{ user: string; query?: string }>();
```

## Modals

A screen becomes a modal via `Stack.Screen options.presentation`:

```tsx
<Stack.Screen
  name="modal"
  options={{
    presentation: 'modal',
    sheetAllowedDetents: [0.5, 1], // bottom-sheet detents (web/narrow)
  }}
/>
```

Push a modal:

```tsx
router.push('/modal');
```

## Redirects and auth gating

Static redirect at a layout level:

```tsx
import { Redirect } from 'expo-router';
if (!session) return <Redirect href="/(auth)/sign-in" />;
```

Conditional gate in a layout:

```tsx
// app/(app)/_layout.tsx
import { Redirect, Stack, useSegments } from 'expo-router';
import { useAuth } from '@/lib/auth';

export default function AppLayout() {
  const { session, isLoading } = useAuth();
  if (isLoading) return null;
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  return <Stack />;
}
```

Pattern: place protected screens under `(app)`, sign-in under `(auth)`. Each has its own `_layout.tsx`. The root `_layout.tsx` decides which to mount.

## Deep links

Configure `scheme` in app config. Universal/app links are documented in [auth-and-deep-links.md](auth-and-deep-links.md). Test with:

```bash
npx uri-scheme open myapp://posts/42 --ios
npx uri-scheme open myapp://posts/42 --android
```

Programmatic builder:

```ts
import * as Linking from 'expo-linking';
const url = Linking.createURL('/posts/42'); // myapp://posts/42
```

## Anchor / initial route

To set the back-stack anchor for a layout (e.g., a modal that should land on `index` when dismissed):

```tsx
export const unstable_settings = {
  anchor: 'index',
};
```

## Anti-patterns

- Mixing React Navigation imports (`@react-navigation/native-stack`) with `expo-router`'s — use only `expo-router` exports
- Putting state in `_layout.tsx` that needs to outlive a navigator unmount — use a top-level provider in the root layout
- Forgetting `experiments.typedRoutes: true` — you lose autocomplete and type-checked params
- Using `router.push` inside a render — wrap in an effect or event handler
- Hand-rolling auth gating per screen — gate at the layout level
