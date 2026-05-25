# Node.js 24 — Modules, ESM, CJS Interop & Built-ins

> Node.js 24.14.1 · TypeScript 6.0.x · Updated: 2026-05-16

## ESM-first in Node 24

Node 24 treats ESM as the primary module system. All new code should use ESM.

```json
// package.json
{
  "type": "module"
}
```

```ts
// ✅ ESM imports — always use node: prefix for built-ins
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';

// ✅ Explicit extensions in import specifiers
import { getUser } from './users/user.service.ts';   // strip-types mode
import { getUser } from './users/user.service.js';   // compiled output
```

## CJS interop

```ts
// ESM can import CJS modules — default import gets module.exports
import _ from 'lodash';               // ✅ works
import { cloneDeep } from 'lodash';  // ✅ works (named imports from CJS)

// CJS cannot require() ESM — use dynamic import instead
// In a CJS file:
const { getUser } = await import('./user.service.js');

// Top-level await available in ESM modules (Node 14.8+)
const config = await loadConfig();
export { config };
```

## Dynamic import

```ts
// Lazy-load heavy modules
async function getSharp() {
  const { default: sharp } = await import('sharp');
  return sharp;
}

// Conditional import by platform
const { platform } = process;
const { nativeBinding } = await import(
  platform === 'linux' ? './bindings/linux.js' : './bindings/other.js'
);

// Import JSON (Node 22+ with assert or with)
import data from './config.json' with { type: 'json' };
// or dynamically:
const { default: pkg } = await import('./package.json', { with: { type: 'json' } });
```

## node:sqlite — built-in SQLite (Node 22.5+, stable in 24)

No need for `better-sqlite3` or `sqlite3` packages for lightweight embedded data.

```ts
import { DatabaseSync } from 'node:sqlite';

// Synchronous API — suitable for scripts, CLI tools, tests
const db = new DatabaseSync(':memory:');

db.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE
  )
`);

const insert = db.prepare('INSERT INTO users (name, email) VALUES (?, ?)');
insert.run('Alice', 'alice@example.com');

const select = db.prepare('SELECT * FROM users WHERE id = ?');
const user = select.get(1) as { id: number; name: string; email: string };
console.log(user.name); // 'Alice'

// Transaction
const insertMany = db.prepare('INSERT INTO users (name, email) VALUES (?, ?)');
const transaction = db.transaction((users: Array<{ name: string; email: string }>) => {
  for (const u of users) insertMany.run(u.name, u.email);
});
transaction([{ name: 'Bob', email: 'bob@example.com' }]);

db.close();
```

Use cases: feature flags storage, local caching, CLI config, test fixtures, embedded analytics.

## Permission Model (Node 20+, stable in 22+)

Run with restricted permissions — principle of least privilege:

```sh
# Only allow reading from src/ and writing to dist/
node --permission \
  --allow-fs-read=./src \
  --allow-fs-write=./dist \
  src/build.ts

# Allow network access to specific hosts
node --permission \
  --allow-net=api.example.com:443 \
  --allow-fs-read=./src \
  server.ts

# Allow worker threads
node --permission --allow-worker server.ts

# Allow child processes
node --permission --allow-child-process server.ts
```

```ts
// Check permissions at runtime
import { permission } from 'node:process';

if (permission.has('fs.read', './config.json')) {
  const config = await readFile('./config.json', 'utf8');
}

// Throws if permission denied:
// Error [ERR_ACCESS_DENIED]: Access to FileSystemRead was blocked
```

## Module hooks (custom loaders)

```ts
// hooks/typescript.js — custom loader for tsconfig path aliases
export async function resolve(specifier, context, nextResolve) {
  // Map @shared/* → ./src/shared/*
  if (specifier.startsWith('@shared/')) {
    specifier = specifier.replace('@shared/', new URL('../src/shared/', import.meta.url).href);
  }
  return nextResolve(specifier, context);
}

// Run with:
// node --import ./hooks/typescript.js src/index.ts
```

## __dirname / __filename in ESM

```ts
// ESM has no __dirname / __filename globals — use import.meta
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const configPath = join(__dirname, '../config/default.json');

// Or use import.meta.resolve() (Node 20.6+, stable in 24)
const configUrl = import.meta.resolve('../config/default.json');
```

## require() in ESM (Node 22+)

```ts
// Node 22+ allows require() in ESM via createRequire
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

// Load CJS-only packages
const legacy = require('some-cjs-only-package');

// Load JSON synchronously
const pkg = require('./package.json') as { version: string };
```
