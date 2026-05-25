# shadcn/ui — Reference Index

Quick decision map and cheat-sheet. Open a specific reference file for depth.

## When to open which file

| You need to… | Open |
|---|---|
| Set up shadcn from scratch or configure `components.json` | [setup-and-cli.md](setup-and-cli.md) |
| Change colors, dark mode, or CSS variable theme | [theming.md](theming.md) |
| Build a form with validation | [form-integration.md](form-integration.md) |
| Use Button, Dialog, Select, Sheet, Tabs, Sonner, DataTable | [popular-components.md](popular-components.md) |
| Publish or consume a custom component registry | [custom-registry.md](custom-registry.md) |
| Debug accessibility, keyboard nav, ARIA issues | [accessibility.md](accessibility.md) |
| Test skill routing or add eval prompts | [eval-cases.md](eval-cases.md) |

## Component → import path cheat-sheet

```ts
import { Button }         from "@/components/ui/button"
import { Input }          from "@/components/ui/input"
import { Label }          from "@/components/ui/label"
import { Textarea }       from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge }          from "@/components/ui/badge"
import { Separator }      from "@/components/ui/separator"
import { Skeleton }       from "@/components/ui/skeleton"
import { Toaster }        from "@/components/ui/sonner"   // not "toaster"
import { toast }          from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn }             from "@/lib/utils"
```

## Key packages installed with `npx shadcn init`

| Package | Role |
|---|---|
| `class-variance-authority` | `cva()` for component variants |
| `tailwind-merge` | deduplicate conflicting Tailwind classes |
| `clsx` | conditional class composition |
| `lucide-react` | icon set (default with shadcn) |
| `@radix-ui/react-*` | per-component Radix primitives |

## Quick patterns

### cn() usage
```ts
import { cn } from "@/lib/utils"

// Conditional classes + prop override
<div className={cn("base-classes", isActive && "active-class", className)} />
```

### cva() variant extension
```ts
import { cva, type VariantProps } from "class-variance-authority"

const buttonVariants = cva("base", {
  variants: {
    variant: { default: "bg-primary", outline: "border border-input" },
    size: { default: "h-9 px-4", sm: "h-8 px-3" },
  },
  defaultVariants: { variant: "default", size: "default" },
})
```

### asChild pattern (Button as Link)
```tsx
import { Button } from "@/components/ui/button"
import Link from "next/link"

<Button asChild>
  <Link href="/dashboard">Go to Dashboard</Link>
</Button>
```

### Dialog open state control
```tsx
const [open, setOpen] = React.useState(false)
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>...</DialogContent>
</Dialog>
```

## CLI command reference

| Command | Description |
|---|---|
| `npx shadcn@latest init` | Initialize — generates `components.json`, updates `globals.css` |
| `npx shadcn add button` | Add a single component |
| `npx shadcn add button dialog form` | Add multiple components |
| `npx shadcn add --all` | Add every available component |
| `npx shadcn diff` | Show upstream changes since last add |
| `npx shadcn diff button` | Show upstream changes for specific component |
| `npx shadcn add <url>/button` | Add from custom registry |

## Common mistakes

| Mistake | Fix |
|---|---|
| `npm install @shadcn/ui` | No package exists — use `npx shadcn add` |
| `import { Button } from "shadcn/ui"` | Import from `@/components/ui/button` |
| `import { toast } from "@/components/ui/sonner"` | Toast function comes from `"sonner"` package; only `<Toaster>` from ui |
| Missing `<FormControl>` in `<FormField>` | Breaks ARIA wiring — always include it |
| Adding `role` to Dialog | Radix handles ARIA — don't override |
| Hardcoding hex in component | Use CSS variables: `bg-primary` not `bg-[#3b82f6]` |
