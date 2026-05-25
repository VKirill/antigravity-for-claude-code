# Compound Component Example: Tabs / Accordion

End-to-end walkthrough of the compound component pattern with Context-shared state, TypeScript generics, and ARIA attributes.

---

## Scenario

Build a `<Tabs>` component where the parent owns the active state and sub-components consume it implicitly. The caller controls layout; the parent controls which tab is active.

**Goal**: callers write `<Tabs>`, `<Tabs.List>`, `<Tabs.Trigger>`, `<Tabs.Content>` without passing state through every level.

---

## Step 1: Context + types

```tsx
// components/Tabs/types.ts
export interface TabsContextValue {
  activeTab: string;
  setActiveTab: (id: string) => void;
}
```

```tsx
// components/Tabs/TabsContext.ts
import { createContext, useContext } from 'react';
import type { TabsContextValue } from './types';

export const TabsContext = createContext<TabsContextValue | null>(null);

export function useTabs(): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) {
    throw new Error(
      'useTabs must be used within a <Tabs> component. ' +
      'Wrap your Tabs.List and Tabs.Content inside <Tabs>.'
    );
  }
  return ctx;
}
```

---

## Step 2: Root component

```tsx
// components/Tabs/Tabs.tsx
import { useState, type ReactNode } from 'react';
import { TabsContext } from './TabsContext';

export interface TabsProps {
  /** ID of the initially active tab */
  defaultTab: string;
  /** Controlled: override active tab from parent */
  activeTab?: string;
  /** Controlled: called when active tab changes */
  onTabChange?: (id: string) => void;
  children: ReactNode;
  className?: string;
}

export function Tabs({
  defaultTab,
  activeTab: controlledTab,
  onTabChange,
  children,
  className,
}: TabsProps) {
  const [internalTab, setInternalTab] = useState(defaultTab);
  const isControlled = controlledTab !== undefined;

  const activeTab = isControlled ? controlledTab : internalTab;

  function setActiveTab(id: string) {
    if (!isControlled) setInternalTab(id);
    onTabChange?.(id);
  }

  return (
    <TabsContext value={{ activeTab, setActiveTab }}>
      <div className={className}>{children}</div>
    </TabsContext>
  );
}
```

---

## Step 3: Sub-components

```tsx
// components/Tabs/TabsList.tsx
import type { ReactNode } from 'react';

export function TabsList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label="Tabs" className={className}>
      {children}
    </div>
  );
}
```

```tsx
// components/Tabs/TabsTrigger.tsx
import type { ReactNode } from 'react';
import { useTabs } from './TabsContext';

export interface TabsTriggerProps {
  id: string;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function TabsTrigger({ id, children, disabled, className }: TabsTriggerProps) {
  const { activeTab, setActiveTab } = useTabs();
  const isActive = activeTab === id;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      aria-controls={`panel-${id}`}
      id={`tab-${id}`}
      tabIndex={isActive ? 0 : -1}
      disabled={disabled}
      className={className}
      onClick={() => !disabled && setActiveTab(id)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (!disabled) setActiveTab(id);
        }
      }}
    >
      {children}
    </button>
  );
}
```

```tsx
// components/Tabs/TabsContent.tsx
import type { ReactNode } from 'react';
import { useTabs } from './TabsContext';

export interface TabsContentProps {
  id: string;
  children: ReactNode;
  className?: string;
}

export function TabsContent({ id, children, className }: TabsContentProps) {
  const { activeTab } = useTabs();

  if (activeTab !== id) return null;

  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      tabIndex={0}
      className={className}
    >
      {children}
    </div>
  );
}
```

---

## Step 4: Assembly + export

```tsx
// components/Tabs/index.ts
import { Tabs as TabsRoot } from './Tabs';
import { TabsList } from './TabsList';
import { TabsTrigger } from './TabsTrigger';
import { TabsContent } from './TabsContent';

const Tabs = Object.assign(TabsRoot, {
  List: TabsList,
  Trigger: TabsTrigger,
  Content: TabsContent,
});

export { Tabs };
export type { TabsProps } from './Tabs';
export type { TabsTriggerProps } from './TabsTrigger';
export type { TabsContentProps } from './TabsContent';
```

---

## Step 5: Usage

```tsx
// pages/ProductPage.tsx
import { Tabs } from '@/components/Tabs';

function ProductPage({ product }: { product: Product }) {
  return (
    <Tabs defaultTab="overview">
      <Tabs.List className="flex gap-2 border-b">
        <Tabs.Trigger id="overview" className="tab-btn">Overview</Tabs.Trigger>
        <Tabs.Trigger id="specs" className="tab-btn">Specifications</Tabs.Trigger>
        <Tabs.Trigger id="reviews" className="tab-btn">Reviews</Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content id="overview" className="py-4">
        <p>{product.description}</p>
      </Tabs.Content>

      <Tabs.Content id="specs" className="py-4">
        <SpecTable specs={product.specs} />
      </Tabs.Content>

      <Tabs.Content id="reviews" className="py-4">
        <ReviewList productId={product.id} />
      </Tabs.Content>
    </Tabs>
  );
}
```

### Controlled usage (parent drives active tab)

```tsx
function ControlledExample() {
  const [tab, setTab] = useState('overview');
  const router = useRouter();

  function handleTabChange(id: string) {
    setTab(id);
    router.push(`?tab=${id}`, { scroll: false });
  }

  return (
    <Tabs activeTab={tab} onTabChange={handleTabChange} defaultTab="overview">
      {/* ... */}
    </Tabs>
  );
}
```

---

## Accordion variant

The same pattern applies to an Accordion that supports multiple open panels:

```tsx
// Replace TabsContext with:
interface AccordionContextValue {
  openPanels: Set<string>;
  toggle: (id: string) => void;
  multiple?: boolean;
}

// Root manages a Set<string> instead of a string
const [openPanels, setOpenPanels] = useState<Set<string>>(new Set());

function toggle(id: string) {
  setOpenPanels(prev => {
    const next = new Set(prev);
    if (next.has(id)) {
      next.delete(id);
    } else {
      if (!multiple) next.clear(); // single-open mode
      next.add(id);
    }
    return next;
  });
}
```

---

## Verification checklist

- [ ] `<Tabs>` without `<Tabs.List>/<Tabs.Trigger>/<Tabs.Content>` throws a clear error
- [ ] Using `<Tabs.Trigger>` outside `<Tabs>` throws "must be inside Tabs"
- [ ] Tab switching works with keyboard (Enter/Space + arrow keys for full ARIA compliance)
- [ ] `aria-selected`, `aria-controls`, `role="tab"`, `role="tabpanel"` present in DOM
- [ ] Controlled mode: `onTabChange` fires and parent controls which tab is active
- [ ] TypeScript: passing unknown props to `Tabs.Trigger` or `Tabs.Content` is a type error
