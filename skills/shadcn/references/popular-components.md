# shadcn/ui — Popular Components

## Button

```bash
npx shadcn add button
```

```tsx
import { Button } from "@/components/ui/button"

// Variants: default, destructive, outline, secondary, ghost, link
// Sizes: default, sm, lg, icon
<Button variant="default" size="default">Click me</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline" size="sm">Cancel</Button>
<Button variant="ghost" size="icon" aria-label="Menu">
  <Menu className="h-4 w-4" />
</Button>

// Link button (asChild)
<Button asChild>
  <Link href="/dashboard">Dashboard</Link>
</Button>

// Loading state
<Button disabled={isLoading}>
  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  Save
</Button>
```

Extend variants by editing `buttonVariants` in `components/ui/button.tsx`:
```ts
const buttonVariants = cva("...", {
  variants: {
    variant: {
      default: "...",
      // Add your custom variant:
      brand: "bg-brand-500 text-white hover:bg-brand-600",
    },
  },
})
```

## Dialog

```bash
npx shadcn add dialog
```

```tsx
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

// Basic dialog
<Dialog>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent className="sm:max-w-[425px]">
    <DialogHeader>
      <DialogTitle>Edit profile</DialogTitle>
      <DialogDescription>Make changes to your profile here.</DialogDescription>
    </DialogHeader>
    {/* content */}
    <DialogFooter>
      <Button type="submit">Save changes</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

// Controlled dialog
const [open, setOpen] = React.useState(false)
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <Button onClick={() => setOpen(false)}>Close</Button>
  </DialogContent>
</Dialog>
```

## Select

```bash
npx shadcn add select
```

```tsx
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"

<Select onValueChange={setValue} defaultValue={value}>
  <SelectTrigger className="w-[180px]">
    <SelectValue placeholder="Select a fruit" />
  </SelectTrigger>
  <SelectContent>
    <SelectGroup>
      <SelectLabel>Fruits</SelectLabel>
      <SelectItem value="apple">Apple</SelectItem>
      <SelectItem value="banana">Banana</SelectItem>
      <SelectItem value="blueberry" disabled>Blueberry (unavailable)</SelectItem>
    </SelectGroup>
  </SelectContent>
</Select>
```

For form integration, always use with `<FormField>` and `onValueChange={field.onChange}`.

## Sheet (Drawer/Sidebar)

```bash
npx shadcn add sheet
```

```tsx
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

// Side: "top" | "bottom" | "left" | "right" (default: right)
<Sheet>
  <SheetTrigger asChild>
    <Button variant="outline">Open sidebar</Button>
  </SheetTrigger>
  <SheetContent side="right">
    <SheetHeader>
      <SheetTitle>Navigation</SheetTitle>
      <SheetDescription>App navigation</SheetDescription>
    </SheetHeader>
    <nav>...</nav>
  </SheetContent>
</Sheet>
```

## Tabs

```bash
npx shadcn add tabs
```

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

<Tabs defaultValue="account" className="w-[400px]">
  <TabsList>
    <TabsTrigger value="account">Account</TabsTrigger>
    <TabsTrigger value="password">Password</TabsTrigger>
    <TabsTrigger value="billing" disabled>Billing</TabsTrigger>
  </TabsList>
  <TabsContent value="account">Account settings here</TabsContent>
  <TabsContent value="password">Password settings here</TabsContent>
</Tabs>
```

## Toast (Sonner)

```bash
npx shadcn add sonner
```

```tsx
// 1. Add Toaster to root layout (once)
import { Toaster } from "@/components/ui/sonner"
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  )
}

// 2. Import toast function from "sonner" (NOT from @/components/ui/sonner)
import { toast } from "sonner"

// Usage
toast("Event has been created")
toast.success("Profile updated!")
toast.error("Something went wrong", { description: "Check the error log." })
toast.loading("Uploading...")
toast.promise(myAsyncFn(), {
  loading: "Saving...",
  success: "Saved!",
  error: "Failed to save",
})
```

## DropdownMenu

```bash
npx shadcn add dropdown-menu
```

```tsx
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon">
      <MoreHorizontal className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuLabel>Actions</DropdownMenuLabel>
    <DropdownMenuItem onClick={handleEdit}>Edit</DropdownMenuItem>
    <DropdownMenuItem onClick={handleDuplicate}>Duplicate</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={handleDelete} className="text-destructive">
      Delete
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

## Command (Combobox)

```bash
npx shadcn add command
```

Used as a combobox / search-and-select pattern:

```tsx
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const [open, setOpen] = React.useState(false)
const [value, setValue] = React.useState("")

<Popover open={open} onOpenChange={setOpen}>
  <PopoverTrigger asChild>
    <Button variant="outline" role="combobox" aria-expanded={open}>
      {value ? frameworks.find(f => f.value === value)?.label : "Select framework..."}
      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-[200px] p-0">
    <Command>
      <CommandInput placeholder="Search framework..." />
      <CommandList>
        <CommandEmpty>No framework found.</CommandEmpty>
        <CommandGroup>
          {frameworks.map(framework => (
            <CommandItem
              key={framework.value}
              value={framework.value}
              onSelect={(current) => {
                setValue(current === value ? "" : current)
                setOpen(false)
              }}
            >
              <Check className={cn("mr-2 h-4 w-4", value === framework.value ? "opacity-100" : "opacity-0")} />
              {framework.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  </PopoverContent>
</Popover>
```

## Table + TanStack Table (DataTable)

```bash
npx shadcn add table
npm install @tanstack/react-table
```

See [examples/build-data-table.md](../examples/build-data-table.md) for the complete implementation with sorting, filtering, and pagination.

Basic table (static data):

```tsx
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

<Table>
  <TableCaption>Recent invoices</TableCaption>
  <TableHeader>
    <TableRow>
      <TableHead>Invoice</TableHead>
      <TableHead>Status</TableHead>
      <TableHead className="text-right">Amount</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {invoices.map(invoice => (
      <TableRow key={invoice.id}>
        <TableCell className="font-medium">{invoice.id}</TableCell>
        <TableCell>{invoice.status}</TableCell>
        <TableCell className="text-right">{invoice.amount}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

## Card

```bash
npx shadcn add card
```

```tsx
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

<Card className="w-[350px]">
  <CardHeader>
    <CardTitle>Create project</CardTitle>
    <CardDescription>Deploy your new project in one-click.</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Card content</p>
  </CardContent>
  <CardFooter className="flex justify-between">
    <Button variant="outline">Cancel</Button>
    <Button>Deploy</Button>
  </CardFooter>
</Card>
```

## Badge

```bash
npx shadcn add badge
```

```tsx
import { Badge } from "@/components/ui/badge"

// Variants: default, secondary, destructive, outline
<Badge>New</Badge>
<Badge variant="secondary">Beta</Badge>
<Badge variant="destructive">Deprecated</Badge>
<Badge variant="outline">Draft</Badge>
```

## Skeleton (loading state)

```bash
npx shadcn add skeleton
```

```tsx
import { Skeleton } from "@/components/ui/skeleton"

// Card loading skeleton
<div className="flex flex-col space-y-3">
  <Skeleton className="h-[125px] w-[250px] rounded-xl" />
  <div className="space-y-2">
    <Skeleton className="h-4 w-[250px]" />
    <Skeleton className="h-4 w-[200px]" />
  </div>
</div>
```
