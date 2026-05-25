# Recursive Tree Schema with z.lazy and Branded IDs

## Scenario

A category tree where each node can have children of the same type. Nodes have a branded ID, metadata, and optional parent reference.

## Step 1: define the TypeScript type first

TypeScript needs the type annotation to break the circular inference. Define it before the Zod schema:

```ts
import { z } from "zod";

// 1. TypeScript type (declares the recursive shape)
type Category = {
  id: CategoryId;
  slug: string;
  name: string;
  description?: string | undefined;
  depth: number;
  children: Category[];
};
```

## Step 2: branded ID schema

```ts
// 2. Branded ID prevents mixing CategoryId and ProductId
const CategoryIdSchema = z.string().uuid().brand<"CategoryId">();
type CategoryId = z.infer<typeof CategoryIdSchema>;

// Helper to create trusted CategoryIds (e.g., from DB)
export function toCategoryId(raw: string): CategoryId {
  return CategoryIdSchema.parse(raw);
}
```

## Step 3: recursive schema with z.lazy

```ts
// 3. Annotate with z.ZodType<Category> — REQUIRED for TypeScript not to error
const CategorySchema: z.ZodType<Category> = z.object({
  id: CategoryIdSchema,
  slug: z.string().regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  depth: z.number().int().min(0).max(10),
  children: z.lazy(() => z.array(CategorySchema)),
});

export type { Category, CategoryId };
export { CategorySchema, CategoryIdSchema };
```

## Step 4: API response parsing

```ts
// Parse a tree returned from an API or DB
function parseCategoryTree(raw: unknown): Category {
  const result = CategorySchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Invalid category tree: ${JSON.stringify(result.error.flatten().fieldErrors)}`
    );
  }
  return result.data;
}

// Example raw input (from API/DB):
const raw = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  slug: "electronics",
  name: "Electronics",
  depth: 0,
  children: [
    {
      id: "550e8400-e29b-41d4-a716-446655440001",
      slug: "computers",
      name: "Computers",
      depth: 1,
      children: [
        {
          id: "550e8400-e29b-41d4-a716-446655440002",
          slug: "laptops",
          name: "Laptops",
          depth: 2,
          children: [],
        },
      ],
    },
  ],
};

const tree = parseCategoryTree(raw);
// tree.id is CategoryId (branded)
// tree.children[0].children[0].name === "Laptops"
```

## Step 5: flatten tree utility

Recursive schemas are great for parsing, but flat arrays are often more practical:

```ts
function flattenTree(node: Category): Category[] {
  return [node, ...node.children.flatMap(flattenTree)];
}

const allCategories = flattenTree(tree);
// allCategories: Category[] — all nodes in depth-first order
```

## Step 6: depth guard refinement

Prevent infinitely deep trees:

```ts
const SafeCategorySchema: z.ZodType<Category> = z.object({
  id: CategoryIdSchema,
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  depth: z.number().int().min(0).max(10, "Max tree depth is 10"),
  children: z.lazy(() => z.array(SafeCategorySchema)),
}).refine(
  (cat) => cat.depth <= 10,
  { message: "Tree depth exceeds maximum of 10" }
);
```

## Step 7: discriminated variant (leaf vs. branch)

If leaves and branches have different fields, use discriminated union with lazy:

```ts
type LeafNode = {
  kind: "leaf";
  id: CategoryId;
  name: string;
  productCount: number;
};

type BranchNode = {
  kind: "branch";
  id: CategoryId;
  name: string;
  children: TreeNode[];
};

type TreeNode = LeafNode | BranchNode;

const LeafNodeSchema: z.ZodType<LeafNode> = z.object({
  kind: z.literal("leaf"),
  id: CategoryIdSchema,
  name: z.string(),
  productCount: z.number().int().nonnegative(),
});

const BranchNodeSchema: z.ZodType<BranchNode> = z.object({
  kind: z.literal("branch"),
  id: CategoryIdSchema,
  name: z.string(),
  children: z.lazy(() => z.array(TreeNodeSchema)),
});

// discriminatedUnion cannot be directly recursive in Zod 4 because
// both branches need to be defined before the union.
// Use z.union for the recursive variant:
const TreeNodeSchema: z.ZodType<TreeNode> = z.lazy(() =>
  z.discriminatedUnion("kind", [LeafNodeSchema, BranchNodeSchema])
);
```

## Common pitfalls

**Forgetting `z.ZodType<T>` annotation:**
```ts
// WRONG — TypeScript infers an infinitely nested type and may error
const BadSchema = z.object({
  children: z.lazy(() => z.array(BadSchema)),  // TS inference error
});

// CORRECT — annotate explicitly
const GoodSchema: z.ZodType<MyType> = z.object({
  children: z.lazy(() => z.array(GoodSchema)),
});
```

**Circular reference in data (not schema):**
`z.lazy()` handles self-referential schemas but not actual circular JS objects (where `node.children[0] === node`). Use `structuredClone()` or ensure your data is a DAG before parsing.

**Performance with very deep trees:**
Zod validates every node recursively. A tree with 10,000 nodes will parse all 10,000. For very large trees, consider parsing only the first N levels and lazy-loading the rest.
