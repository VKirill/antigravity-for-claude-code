# React 19 — Server Components

Covers: RSC vs Client Component decision matrix, async Server Components, Suspense streaming, composition across the server/client boundary, caveats.

> Note: React Server Components require a framework (Next.js App Router, Remix, custom RSC setup). The patterns here are framework-agnostic where possible; Next.js-specific patterns (Server Actions, `generateMetadata`) are noted and defer to the `nextjs` skill.

---

## Decision Matrix

| Question | Answer → Component type |
|---|---|
| Needs `onClick`, `onChange`, or any DOM event handler? | Client (`"use client"`) |
| Needs `useState`, `useReducer`, `useContext`? | Client |
| Needs browser APIs (`window`, `localStorage`, `navigator`)? | Client |
| Needs animation libraries that hook into the DOM? | Client |
| Fetches data from a database, file system, or internal API? | Server (default) |
| Accesses environment secrets? | Server |
| Renders heavy static content with no interactivity? | Server |
| Imports a large library only needed for rendering? | Server (bundle stays on server) |
| Consumes a client-created Context? | Client |
| Receives RSC-rendered children as props? | Can be Client (interleaving pattern) |

---

## Server Components

Server Components run during SSR or at request time on the server. They:
- Can be `async` — `await` directly in the function body
- Contribute zero JavaScript to the client bundle
- Cannot use hooks (except `use()` for Context), browser APIs, or event handlers

```tsx
// app/features/users/UserProfile.tsx — no 'use client' = Server Component
interface UserProfileProps {
  userId: string;
}

async function UserProfile({ userId }: UserProfileProps) {
  // Direct DB/API call — no useEffect, no loading state
  const user = await db.users.findUnique({ where: { id: userId } });

  if (!user) return <p>User not found</p>;

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
      {/* Client component for interactive part */}
      <FollowButton userId={user.id} />
    </div>
  );
}
```

### Async data in Server Components

```tsx
// Multiple parallel fetches
async function Dashboard({ userId }: { userId: string }) {
  const [user, stats, recentPosts] = await Promise.all([
    fetchUser(userId),
    fetchUserStats(userId),
    fetchRecentPosts(userId),
  ]);

  return (
    <main>
      <UserCard user={user} />
      <StatsGrid stats={stats} />
      <PostList posts={recentPosts} />
    </main>
  );
}
```

---

## Client Components

Add `"use client"` at the top of the file to mark it as a Client Component boundary.

```tsx
// components/FollowButton.tsx
"use client";

import { useState, useTransition } from 'react';

interface FollowButtonProps {
  userId: string;
}

function FollowButton({ userId }: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleFollow() {
    startTransition(async () => {
      await followUser(userId);
      setIsFollowing(true);
    });
  }

  return (
    <button onClick={handleFollow} disabled={isPending}>
      {isPending ? 'Following...' : isFollowing ? 'Following' : 'Follow'}
    </button>
  );
}
```

`"use client"` marks the boundary — all imports within this file become client-side too. Keep Client Components small and focused at the leaves of the tree.

---

## Composition Across the Boundary

### Server → Client: pass serializable props

Server Components can render Client Components and pass props. Only serializable values cross the boundary: strings, numbers, arrays, plain objects, Dates. Not: functions, class instances, Promises (directly — use `use()` pattern).

```tsx
// Server Component
async function ProductPage({ productId }: { productId: string }) {
  const product = await fetchProduct(productId);

  return (
    <div>
      <h1>{product.name}</h1>
      {/* Serializable props only */}
      <AddToCartButton
        productId={product.id}
        price={product.price}
        inStock={product.stock > 0}
      />
    </div>
  );
}
```

### The interleaving pattern (Client receives Server children)

Client Components cannot import Server Components, but they can accept Server Components as `children` props. This is the "interleaving" pattern — it lets you nest Server-rendered content inside Client context providers.

```tsx
// ClientProvider.tsx — Client Component that accepts RSC children
"use client";

import { createContext, useContext, useState } from 'react';

const ThemeContext = createContext<'light' | 'dark'>('light');

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  return (
    <ThemeContext value={theme}>
      {/* children rendered on server, passed as prop to client provider */}
      {children}
    </ThemeContext>
  );
}

// layout.tsx — Server Component assembles the tree
async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      {children} {/* Server-rendered pages passed as RSC children */}
    </ThemeProvider>
  );
}
```

### Passing Server Components to slots

```tsx
// Server Component
async function Sidebar() {
  const nav = await fetchNavigation();
  return <nav>{nav.map(item => <a key={item.id} href={item.href}>{item.label}</a>)}</nav>;
}

// Layout.tsx — Server Component
async function Layout({ children }: { children: React.ReactNode }) {
  return (
    <TwoColumnLayout
      sidebar={<Sidebar />}  {/* Server Component in a slot */}
      main={children}
    />
  );
}
```

---

## Suspense Streaming with Server Components

Wrap async Server Components in `<Suspense>` to stream content progressively. The shell renders immediately; Suspense boundaries fill in as data resolves.

```tsx
// page.tsx — Server Component
async function ProductsPage() {
  return (
    <main>
      {/* Header renders immediately */}
      <PageHeader title="Products" />

      {/* Products stream in when data is ready */}
      <Suspense fallback={<ProductGridSkeleton />}>
        <ProductGrid />   {/* async Server Component */}
      </Suspense>

      {/* Sidebar streams independently */}
      <Suspense fallback={<SidebarSkeleton />}>
        <FilterSidebar />  {/* async Server Component */}
      </Suspense>
    </main>
  );
}
```

### Nested Suspense for independent sections

```tsx
async function BlogPage() {
  return (
    <article>
      <BlogHeader />          {/* sync — renders immediately */}
      <Suspense fallback={<BodySkeleton />}>
        <BlogBody />          {/* streams — post content */}
        <Suspense fallback={<CommentsSkeleton />}>
          <Comments />        {/* streams separately — slower API */}
        </Suspense>
      </Suspense>
    </article>
  );
}
```

---

## Server Component Caveats

### No hooks (except use() for server context)

```tsx
// Bad — hooks not allowed in Server Components
async function BadComponent() {
  const [count, setCount] = useState(0); // Error: hooks not allowed
  return <div>{count}</div>;
}

// Good — use state in a Client Component
"use client";
function CounterClient() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

### No browser APIs

```tsx
// Bad
async function BadComponent() {
  const theme = localStorage.getItem('theme'); // ReferenceError on server
}

// Good — read from server-side source (cookies, DB)
async function GoodComponent() {
  const theme = await getUserThemeFromDB(); // server-safe
}
```

### Props must be serializable

```tsx
// Bad — function as prop across server/client boundary
<ClientButton onClick={() => console.log('click')} /> // Error

// Good — handler defined inside the Client Component
// or use Server Actions (framework-specific)
```

### Client Components can't import Server Components

```tsx
// Bad — ClientComponent.tsx
"use client";
import { ServerComponent } from './ServerComponent'; // Wrong

// Good — receive as children
"use client";
function ClientWrapper({ children }: { children: React.ReactNode }) {
  return <div className="wrapper">{children}</div>;
}
// Then in a Server Component:
// <ClientWrapper><ServerComponent /></ClientWrapper>
```

---

## When RSC Is Not the Right Tool

RSC is a good fit for data-heavy, mostly-static content. Avoid RSC when:

- The entire page is highly interactive (dashboard with real-time updates, rich text editor)
- You're building a purely client-side SPA with no server (static hosting only)
- The component requires browser APIs at the top level
- You're not using a framework that supports RSC (plain Vite + React doesn't without additional setup)

For Vite + React without Next.js or Remix: use `use()` + Suspense + TanStack Query for data fetching instead of RSC. RSC requires a server rendering environment.
