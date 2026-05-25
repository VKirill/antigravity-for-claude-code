# React 19 — New Features

Covers: Actions, Document Metadata, Asset Loading, ref as prop, use() for Context, error recovery hooks, React 19 migration notes.

---

## Actions

An "Action" is any async function used within a transition or passed to a form. React 19 allows `startTransition` to accept async functions.

### Async transitions

```tsx
import { useTransition } from 'react';

function SaveButton({ data }: { data: FormData }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await saveToServer(data);
      // After resolution, React handles state cleanup
    });
  }

  return (
    <button onClick={handleClick} disabled={isPending}>
      {isPending ? 'Saving...' : 'Save'}
    </button>
  );
}
```

### Form Actions

Pass an async function directly to `<form action>`. React handles the FormData automatically.

```tsx
async function createPost(formData: FormData) {
  const title = formData.get('title') as string;
  const content = formData.get('content') as string;
  await api.createPost({ title, content });
}

function NewPostForm() {
  return (
    <form action={createPost}>
      <input name="title" placeholder="Title" required />
      <textarea name="content" placeholder="Content" required />
      <button type="submit">Create Post</button>
    </form>
  );
}
```

### useFormStatus — form state in child components

`useFormStatus` lets child components read the pending state of their parent form. Useful for submit buttons deep in a form tree.

```tsx
import { useFormStatus } from 'react-dom';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Submitting...' : 'Submit'}
    </button>
  );
}

// Used inside a form with action
function ContactForm() {
  return (
    <form action={submitContact}>
      <input name="email" type="email" />
      <SubmitButton />   {/* reads parent form's pending state */}
    </form>
  );
}
```

---

## Document Metadata

React 19 hoists `<title>`, `<meta>`, and `<link>` to `<head>` when rendered anywhere in the component tree. No `react-helmet` or framework metadata API needed for client apps.

```tsx
function ProductPage({ product }: { product: Product }) {
  return (
    <>
      {/* These hoist to <head> automatically */}
      <title>{product.name} | My Store</title>
      <meta name="description" content={product.description} />
      <meta property="og:title" content={product.name} />
      <meta property="og:image" content={product.imageUrl} />
      <link rel="canonical" href={`/products/${product.slug}`} />

      {/* Regular component content */}
      <main>
        <h1>{product.name}</h1>
      </main>
    </>
  );
}
```

### Priority and deduplication

- Multiple `<title>` renders: the one closest to the root wins (de-duplicated by type)
- Multiple `<meta name="...">`: deduplicated by `name` attribute
- `<link rel="canonical">`: deduplicated by `rel`

> Next.js App Router has its own `generateMetadata` API that takes precedence and handles SSR metadata — use the `nextjs` skill for framework-specific metadata. Document Metadata in React 19 works for client-only apps or where framework metadata isn't needed.

---

## Asset Loading

React 19 allows `<link rel="preload">`, `<link rel="stylesheet">`, and `<script>` tags in components to load with correct priority and be deduplicated.

### Stylesheets with loading order

```tsx
function Component() {
  return (
    <>
      {/* Stylesheet loaded with specified precedence; React ensures order */}
      <link rel="stylesheet" href="/styles/theme.css" precedence="default" />
      <div className="component">Content</div>
    </>
  );
}
```

### Preloading assets

```tsx
import { preload, prefetchDNS } from 'react-dom';

function HeroSection() {
  // Trigger preload imperatively
  preload('/hero-image.webp', { as: 'image' });
  prefetchDNS('https://cdn.example.com');

  return <img src="/hero-image.webp" alt="Hero" />;
}
```

### Script injection

```tsx
function AnalyticsScript() {
  return (
    <script
      async
      src="https://analytics.example.com/script.js"
      // React deduplicates based on src
    />
  );
}
```

---

## ref as prop

`forwardRef()` is deprecated in React 19. Pass `ref` directly as a named prop.

### Declaring ref prop

```tsx
import { type Ref } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  ref?: Ref<HTMLInputElement>;
  label?: string;
}

function Input({ ref, label, ...props }: InputProps) {
  return (
    <label>
      {label && <span>{label}</span>}
      <input ref={ref} {...props} />
    </label>
  );
}
```

### Migration from forwardRef

```tsx
// React 18 (deprecated — still works but logs warning)
const Input = React.forwardRef<HTMLInputElement, InputProps>((props, ref) => (
  <input ref={ref} {...props} />
));

// React 19 — direct ref prop
function Input({ ref, ...props }: InputProps & { ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} {...props} />;
}
```

Codemod for migration:

```bash
npx codemod@latest react/19/replace-use-form-state
```

---

## use() for Context

`use(Context)` replaces `useContext(Context)` in most new code. It works inside conditionals and loops, which `useContext` cannot.

```tsx
import { use } from 'react';

const ThemeContext = createContext<'light' | 'dark'>('light');

function ThemedButton({ children }: { children: React.ReactNode }) {
  const theme = use(ThemeContext); // works in any position
  return <button data-theme={theme}>{children}</button>;
}

// Works inside conditional — impossible with useContext
function ConditionalTheme({ applyTheme }: { applyTheme: boolean }) {
  if (!applyTheme) return <div>No theme</div>;

  const theme = use(ThemeContext); // valid here
  return <div data-theme={theme}>Themed content</div>;
}
```

### use() vs useContext

| | `use(Context)` | `useContext(Context)` |
|---|---|---|
| Works in conditionals | Yes | No |
| Works in loops | Yes | No |
| React 19 | Preferred | Still valid |
| React 18 | Not available | Required |

---

## Error Recovery Hooks

React 19 adds granular error callbacks to `createRoot` and `hydrateRoot`.

```tsx
import { createRoot } from 'react-dom/client';

const root = createRoot(document.getElementById('root')!, {
  // Called when an error is caught by a boundary
  onCaughtError(error, errorInfo) {
    console.error('Caught by boundary:', error, errorInfo.componentStack);
    reportError(error, { type: 'caught' });
  },

  // Called when an error escapes all boundaries
  onUncaughtError(error, errorInfo) {
    console.error('Uncaught React error:', error, errorInfo.componentStack);
    reportError(error, { type: 'uncaught' });
    // You may want to show a full-page error UI here
  },

  // Called when React recovers from an error (hydration mismatch, etc.)
  onRecoverableError(error, errorInfo) {
    console.warn('Recovered from error:', error);
  },
});

root.render(<App />);
```

---

## React 19 Migration Guide

### Breaking changes

| Old pattern | React 19 replacement |
|---|---|
| `React.forwardRef()` | `ref` as prop directly |
| `React.createContext()` + `.Provider` | `createContext()` + `<MyContext value={...}>` |
| `useContext(Ctx)` everywhere | `use(Ctx)` — especially in conditionals |
| `useState + handleSubmit + loading` | `useActionState` |
| Ad-hoc optimistic updates | `useOptimistic` |
| `react-helmet` for `<title>/<meta>` | React 19 Document Metadata |
| `ReactDOM.render()` | `createRoot().render()` (was React 18 already) |

### Context.Provider removal

```tsx
// React 18
const ThemeContext = React.createContext('light');
<ThemeContext.Provider value="dark">
  {children}
</ThemeContext.Provider>

// React 19 (also works in React 18.3+)
<ThemeContext value="dark">
  {children}
</ThemeContext>
```

### Cleanup functions from refs

```tsx
// React 19 — ref callbacks can return cleanup
<div
  ref={(node) => {
    if (node) {
      const listener = () => console.log('clicked');
      node.addEventListener('click', listener);
      return () => node.removeEventListener('click', listener); // cleanup
    }
  }}
/>
```

### Removed APIs

- `propTypes` — removed from React. Use TypeScript instead.
- `defaultProps` for function components — removed. Use default parameter values.
- Legacy Context API (`contextTypes`, `childContextTypes`) — removed.
- `act()` from `react-dom/test-utils` — use `act()` from `react` directly.

### Codemod

```bash
# Run React 19 codemods
npx codemod@latest react/19/replace-use-form-state
npx codemod@latest react/19/replace-string-ref
npx codemod@latest react/19/replace-act-import
```
