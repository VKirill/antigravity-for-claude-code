# shadcn/ui — Accessibility

## What Radix gives you for free

Every shadcn component is built on a Radix UI primitive. Radix implements WAI-ARIA design patterns so you don't have to. This is the core accessibility guarantee:

| Radix primitive | WAI-ARIA pattern | What it handles |
|---|---|---|
| Dialog | Modal Dialog | Focus trap, `aria-modal`, `aria-labelledby`, Escape to close, scroll lock |
| Select | Listbox | `role="listbox"`, `aria-expanded`, keyboard navigation (arrows, Home, End, typing to search) |
| Tabs | Tablist | `role="tablist"`, roving tabindex, arrow key navigation, `aria-selected` |
| DropdownMenu | Menu | `role="menu"`, keyboard navigation, `aria-haspopup`, `aria-expanded` |
| Combobox (Command) | Combobox | `aria-expanded`, `aria-controls`, `aria-activedescendant`, keyboard navigation |
| Popover | Dialog (popup) | Focus management, Escape to close, `aria-expanded` |
| Sheet | Dialog | Same as Dialog — Sheet is a positioned dialog variant |
| Toast (Sonner) | Alert (live region) | `role="status"` or `role="alert"` for announcements |
| Slider | Slider | `role="slider"`, `aria-valuemin/max/now`, arrow key steps |
| Switch | Switch | `role="switch"`, `aria-checked`, keyboard toggle |
| Checkbox | Checkbox | `aria-checked` with indeterminate state, keyboard toggle |
| Accordion | None (custom) | `aria-expanded`, `aria-controls`, header button semantics |
| HoverCard | None (tooltip-like) | `role="presentation"`, pointer and keyboard show/hide |

## What you still need to add

Radix handles structure; you provide meaning:

### 1. Labels for icon-only buttons

```tsx
// Without text, screen readers only hear "button"
<Button size="icon" onClick={handleDelete}>
  <Trash2 className="h-4 w-4" />
</Button>

// With aria-label — screen readers hear "Delete item"
<Button size="icon" aria-label="Delete item" onClick={handleDelete}>
  <Trash2 className="h-4 w-4" />
</Button>
```

### 2. Dialog accessible names

```tsx
// Good — DialogTitle provides the accessible name
<Dialog>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Delete account</DialogTitle>
      <DialogDescription>This action cannot be undone.</DialogDescription>
    </DialogHeader>
    {/* ... */}
  </DialogContent>
</Dialog>

// Bad — no DialogTitle means no accessible name for the dialog
<Dialog>
  <DialogContent>
    <p>Are you sure?</p>
  </DialogContent>
</Dialog>
```

### 3. Custom content inside form fields

shadcn `<FormLabel>` auto-associates with `<FormControl>` via id. But custom content inside controls needs explicit labeling:

```tsx
// Textarea with character count — count is for visual users only
<FormItem>
  <FormLabel>Bio</FormLabel>
  <FormControl>
    <Textarea {...field} maxLength={500} />
  </FormControl>
  <p className="text-sm text-muted-foreground" aria-hidden="true">
    {field.value?.length ?? 0}/500 characters
  </p>
  <FormMessage />
</FormItem>
```

### 4. Loading states

```tsx
<Button disabled={isLoading} aria-busy={isLoading}>
  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
  {isLoading ? "Saving..." : "Save"}
</Button>
```

### 5. Live regions for async updates

```tsx
// For toast notifications, Sonner already handles announcements
toast.success("Profile saved")  // announced by screen readers

// For inline status messages
<div role="status" aria-live="polite" className="sr-only">
  {statusMessage}
</div>
```

## What NOT to do

### Do not add redundant ARIA to Radix components

```tsx
// Wrong — Radix Dialog already sets aria-modal, role="dialog", focus trap
<DialogContent role="dialog" aria-modal="true">...</DialogContent>

// Wrong — Radix Select already manages aria-expanded
<SelectTrigger aria-expanded={open} aria-haspopup="listbox">...</SelectTrigger>

// Wrong — Radix Tabs already handles roving tabindex
<TabsTrigger tabIndex={0}>Tab 1</TabsTrigger>
```

Redundant ARIA causes double-announcement or incorrect state to screen readers.

### Do not use `tabIndex` to reorder focus

```tsx
// Wrong — changes natural tab order, breaks keyboard navigation
<Button tabIndex={2}>First visually but second in DOM</Button>
<Button tabIndex={1}>Second visually but first in DOM</Button>

// Right — reorder in DOM or use CSS order
```

### Do not remove focus outlines

```css
/* Wrong */
*:focus { outline: none; }
button:focus { outline: 0; }
```

Tailwind's `focus-visible:ring-2 ring-ring` pattern is the correct approach — shows ring only for keyboard focus, not mouse click.

## Keyboard navigation reference

| Component | Keys |
|---|---|
| Dialog / Sheet | `Escape` close; `Tab` / `Shift+Tab` cycle within; restores focus on close |
| Select | `Space`/`Enter` open; arrow keys navigate; `Home`/`End` first/last; typing searches; `Escape` close |
| DropdownMenu | `Space`/`Enter` open; arrow keys navigate; `Escape` close; `Tab` closes |
| Tabs | arrow keys switch tabs (roving tabindex); `Tab` moves focus out |
| Accordion | `Enter`/`Space` toggle; |
| Combobox | `Down` opens list; arrow keys navigate; `Enter` selects; `Escape` close |
| Slider | Arrow keys increment/decrement by step; `Page Up/Down` larger steps; `Home`/`End` min/max |

## Color and contrast

CSS variables use semantic names (`--primary`, `--muted-foreground`) so the contrast is determined by your HSL values, not the component. Verify:

- Text on `--background`: `--foreground` must be ≥4.5:1 (WCAG AA)
- Text on `--primary`: `--primary-foreground` must be ≥4.5:1
- Disabled text: `--muted-foreground` on `--muted` should be ≥3:1 for large text

Use a contrast checker with your actual HSL values. The default zinc theme meets WCAG AA.

## Testing accessibility

```bash
# Install axe-core for automated checks
npm install --save-dev axe-core @axe-core/playwright

# Check in Playwright
await checkA11y(page)
```

Or use the browser's built-in accessibility tree (Chrome DevTools → Elements → Accessibility panel) to verify roles and labels on Radix components.

## Screen reader testing notes

- VoiceOver (macOS) + Safari: best for testing ARIA live regions and modal behavior
- NVDA + Chrome (Windows): tests the most common screen reader + browser combo
- Radix has been tested against both — you get that coverage automatically
