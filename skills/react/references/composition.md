# React 19 — Composition Patterns

Covers: compound components, render props, polymorphic components, ref as prop, forwardRef migration, TypeScript generics for composition.

---

## Compound Components

Compound components share implicit state through a Context, exposing sub-components as properties of the parent.

### Pattern

```tsx
// tabs/index.tsx
import { createContext, useContext, useState, ReactNode } from 'react';

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (id: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('useTabs must be used inside <Tabs>');
  return ctx;
}

interface TabsProps {
  defaultTab: string;
  children: ReactNode;
}

function Tabs({ defaultTab, children }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  return (
    <TabsContext value={{ activeTab, setActiveTab }}>
      <div className="tabs">{children}</div>
    </TabsContext>
  );
}

function TabsList({ children }: { children: ReactNode }) {
  return <div role="tablist" className="tabs-list">{children}</div>;
}

interface TabsTriggerProps {
  id: string;
  children: ReactNode;
}

function TabsTrigger({ id, children }: TabsTriggerProps) {
  const { activeTab, setActiveTab } = useTabs();
  return (
    <button
      role="tab"
      aria-selected={activeTab === id}
      onClick={() => setActiveTab(id)}
    >
      {children}
    </button>
  );
}

interface TabsContentProps {
  id: string;
  children: ReactNode;
}

function TabsContent({ id, children }: TabsContentProps) {
  const { activeTab } = useTabs();
  if (activeTab !== id) return null;
  return <div role="tabpanel">{children}</div>;
}

// Attach as namespace
Tabs.List = TabsList;
Tabs.Trigger = TabsTrigger;
Tabs.Content = TabsContent;

export { Tabs };
```

### Usage

```tsx
<Tabs defaultTab="overview">
  <Tabs.List>
    <Tabs.Trigger id="overview">Overview</Tabs.Trigger>
    <Tabs.Trigger id="details">Details</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Content id="overview">Overview content</Tabs.Content>
  <Tabs.Content id="details">Details content</Tabs.Content>
</Tabs>
```

### When to use

Use compound components when:
- Multiple sub-components share state that shouldn't be visible to callers
- The component's API needs to be self-documenting (namespaced props)
- You want callers to control the layout of sub-components

Avoid for components with only 1–2 optional children — simpler props suffice.

---

## Render Props / Children as Function

Delegates rendering to the caller. The parent owns data or behavior; the caller controls rendering.

```tsx
interface DataFetcherProps<T> {
  url: string;
  children: (data: T | null, loading: boolean, error: Error | null) => ReactNode;
}

function DataFetcher<T>({ url, children }: DataFetcherProps<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetch(url)
      .then(r => r.json() as Promise<T>)
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [url]);

  return <>{children(data, loading, error)}</>;
}

// Usage
<DataFetcher<User[]> url="/api/users">
  {(users, loading) =>
    loading ? <Spinner /> : <UserList users={users ?? []} />
  }
</DataFetcher>
```

In React 19: prefer `use(promise)` inside a Suspense boundary over this pattern for data fetching. Render props remain useful for virtualized lists and drag-and-drop where the parent controls DOM behavior.

---

## Polymorphic Components

The `as` prop changes the underlying DOM element while maintaining type-safe props.

### TypeScript-safe polymorphic

```tsx
type AsProp<C extends React.ElementType> = { as?: C };

type PropsToOmit<C extends React.ElementType, P> = keyof (AsProp<C> & P);

type PolymorphicComponentProps<
  C extends React.ElementType,
  Props = object,
> = React.PropsWithChildren<Props & AsProp<C>> &
  Omit<React.ComponentPropsWithoutRef<C>, PropsToOmit<C, Props>>;

interface ButtonBaseProps {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
}

type ButtonProps<C extends React.ElementType = 'button'> =
  PolymorphicComponentProps<C, ButtonBaseProps>;

function Button<C extends React.ElementType = 'button'>({
  as,
  variant = 'primary',
  size = 'md',
  children,
  ...rest
}: ButtonProps<C>) {
  const Tag = as ?? 'button';
  return (
    <Tag
      className={`btn btn-${variant} btn-${size}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}
```

### Usage

```tsx
// Renders <button>
<Button variant="primary">Click</Button>

// Renders <a> — href is type-safe, onClick still available
<Button as="a" href="/dashboard">Dashboard</Button>

// Renders custom component
<Button as={Link} to="/home">Home</Button>
```

### Simpler variant without full TypeScript generics

When you only need 2–3 known element types, `React.ElementType` generics add boilerplate. Use a discriminated union instead:

```tsx
type ButtonOrAnchor =
  | ({ href?: never } & React.ButtonHTMLAttributes<HTMLButtonElement>)
  | ({ href: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>);

function Button({ href, children, ...props }: ButtonOrAnchor) {
  if (href) return <a href={href} {...props as React.AnchorHTMLAttributes<HTMLAnchorElement>}>{children}</a>;
  return <button {...props as React.ButtonHTMLAttributes<HTMLButtonElement>}>{children}</button>;
}
```

---

## ref as prop (React 19)

`forwardRef` is **deprecated** in React 19 (not removed — still ships and works through v19.x, but the React team recommends migrating). Pass `ref` as a regular prop instead.

### React 19 pattern

```tsx
import { useRef, type Ref } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  ref?: Ref<HTMLInputElement>;
  label: string;
}

function Input({ ref, label, ...props }: InputProps) {
  return (
    <label>
      {label}
      <input ref={ref} {...props} />
    </label>
  );
}

// Usage
function Form() {
  const inputRef = useRef<HTMLInputElement>(null);
  return <Input ref={inputRef} label="Email" type="email" name="email" />;
}
```

### Migrating from forwardRef

```tsx
// React 18 (deprecated)
const Input = forwardRef<HTMLInputElement, InputProps>((props, ref) => (
  <input ref={ref} {...props} />
));
Input.displayName = 'Input';

// React 19
function Input({ ref, ...props }: InputProps & { ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} {...props} />;
}
```

### useImperativeHandle — expose API via ref

Use when the parent needs to call methods on a child, not just access the DOM node.

```tsx
interface DrawerHandle {
  open: () => void;
  close: () => void;
}

interface DrawerProps {
  ref?: Ref<DrawerHandle>;
  children: ReactNode;
}

function Drawer({ ref, children }: DrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  useImperativeHandle(ref, () => ({
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  }));

  return isOpen ? <div className="drawer">{children}</div> : null;
}

// Usage
function Page() {
  const drawerRef = useRef<DrawerHandle>(null);
  return (
    <>
      <button onClick={() => drawerRef.current?.open()}>Open</button>
      <Drawer ref={drawerRef}>Content</Drawer>
    </>
  );
}
```

### Callback refs

Use when you need to respond to ref attachment/detachment, or build a ref from a list index.

```tsx
function MeasuredList({ items }: { items: string[] }) {
  const [heights, setHeights] = useState<Record<number, number>>({});

  const setRef = useCallback((el: HTMLLIElement | null, index: number) => {
    if (el) {
      setHeights(prev => ({ ...prev, [index]: el.getBoundingClientRect().height }));
    }
  }, []);

  return (
    <ul>
      {items.map((item, i) => (
        <li key={i} ref={el => setRef(el, i)}>{item}</li>
      ))}
    </ul>
  );
}
```

---

## Component Composition Anti-patterns

**Prop drilling past 2 levels** — use Context or composition instead.

**God components** — components that accept 15+ props are a sign of missing composition boundaries. Extract sub-components.

**Rendering children in useEffect** — never trigger rendering from effects. Use `key` prop to reset a subtree, or conditional rendering.

**Index-based key in dynamic lists** — `key={index}` breaks React's reconciliation when list items can be reordered or deleted. Use stable IDs.

```tsx
// Bad
{items.map((item, i) => <Item key={i} {...item} />)}

// Good
{items.map(item => <Item key={item.id} {...item} />)}
```
