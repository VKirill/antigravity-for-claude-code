# Node.js 24 — TypeScript Native Type Stripping

> Node.js 24.x · TypeScript 6.0.x · Verified 2026-05-16 against `nodejs.org/docs/latest-v24.x/api/typescript.html`
>
> TS 6.0 default-shifts (`module: esnext`, `target: es2025`, `types: []`) are **fully compatible** with Node 24 native type stripping — TS still emits no runtime code, Node still strips annotations to whitespace.

## Status in Node 24

Type stripping is **on by default** in Node 24 — no flag needed. Node executes `.ts` files by replacing type annotations with whitespace at load time (no type check, no code emit).

```sh
node server.ts                    # just works
node --watch server.ts            # hot reload
node --no-strip-types server.ts   # DISABLE (if you pre-compile)
```

Two related flags:
- `--no-strip-types` — disables the default behaviour (useful when your build already emits `.js`)
- `--experimental-transform-types` — Release Candidate; transforms non-erasable syntax (enums, parameter properties, `namespace` with runtime code). Implies `--enable-source-maps`.

For piped TS via stdin: `--input-type=module-typescript`.

## tsconfig.json for type stripping

```json
{
  "compilerOptions": {
    "target": "ES2024",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2024"],
    "strict": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "skipLibCheck": false,
    "types": ["node"]
  },
  "include": ["src/**/*.ts"]
}
```

Key flags:
- `verbatimModuleSyntax` — enforces `import type` for type-only imports (matches Node's strip semantics)
- `isolatedModules` — each file treated independently
- `noEmit: true` — `tsc` only type-checks; Node strips at runtime

## What strip mode supports

**Erasable syntax (works out of the box):**
- Type annotations on parameters, variables, return types
- `interface` / `type` aliases
- `import type` / `export type`
- Generic type parameters
- Type assertions (`as`, `satisfies`)
- `namespace` blocks WITHOUT runtime code (pure types)

**Non-erasable (requires `--experimental-transform-types` or pre-compile):**
- `enum` declarations
- Parameter properties (`constructor(private x: string)`)
- `namespace` with runtime exports
- Decorators (legacy or Stage 3)
- `import =` / `export =` aliases

```ts
// ❌ Not supported by default strip mode
enum Direction { Up, Down }

// ✅ Replace with const object
const Direction = { Up: 0, Down: 1 } as const;
type Direction = (typeof Direction)[keyof typeof Direction];
```

If you must keep enums/decorators: either run with `--experimental-transform-types` (accept RC stability) or pre-compile with `tsc` / `esbuild` and ship `.js`.

## Import extensions

Node's module resolver requires explicit extensions in import specifiers:

```ts
// ✅ Correct — .ts extension when running directly
import { getEnv } from './config/env.ts';
import type { User } from './types/user.ts';

// ❌ Wrong — no extension causes ERR_MODULE_NOT_FOUND
import { getEnv } from './config/env';
```

Path aliases (`@shared/*`) require a loader or build step — not native. Stick to relative imports or bare specifiers (npm packages) in strip-mode projects.

## package.json setup

```json
{
  "type": "module",
  "scripts": {
    "start": "node src/index.ts",
    "dev": "node --watch src/index.ts",
    "typecheck": "tsc --noEmit",
    "test": "node --test 'src/**/*.test.ts'"
  }
}
```

## Source maps

When you also set `--enable-source-maps` (recommended in production via `NODE_OPTIONS`), stack traces resolve to `.ts` source lines:

```
Error: Connection refused
    at connectDB (src/db/client.ts:42:5)
    at bootstrap (src/index.ts:15:3)
```

`--experimental-transform-types` implies source maps; default strip mode does not — set the flag explicitly.

## Programmatic API

```ts
import { stripTypeScriptTypes } from 'node:module';
const stripped = stripTypeScriptTypes('const a: number = 1;');
// 'const a         = 1;'
```

Useful for tooling that needs to pre-process TS source before passing to V8.

## TypeScript 6.0 — relevant features

- Subpath imports via `#/` prefix work without intermediate dir names — pairs cleanly with Node's own `imports` field in package.json
- Default shifts (`module: esnext`, `target: es2025`, `types: []`) match what Node 24 type-stripping expects — no extra config needed for fresh projects
- Built-in types for Temporal API, `RegExp.escape()`, Map/WeakMap upsert — usable directly under `lib: ["ES2025"]`
- Carryover from 5.9: `import defer * as ns from './m.ts'` (Stage 3 TC39 lazy module evaluation), improved `--isolatedDeclarations` perf

## Cross-references

- Limitations and "node 24 не понимает .ts с enum" troubleshooting → [troubleshooting.md](troubleshooting.md)
- Runtime flags (`NODE_OPTIONS`, source maps) → [recommended-defaults.md](recommended-defaults.md)
