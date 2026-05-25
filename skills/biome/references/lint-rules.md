# Biome — Lint Rules Reference

## Rule naming convention

`biome lint/<category>/<ruleName>`

Categories: `correctness`, `suspicious`, `style`, `performance`, `a11y`, `security`, `complexity`, `nursery`.

`nursery` = rules still being stabilized — may have false positives. Graduate to a stable category in a future release.

## Recommended ruleset

`"recommended": true` activates ~150 rules. All are in the `correctness`, `suspicious`, `style`, `performance`, `a11y` and `complexity` categories. The full list is at https://biomejs.dev/linter/rules/.

Rules NOT in recommended: most `nursery` rules, some `style` rules considered opinionated.

## Enabling/disabling rules

```json
"linter": {
  "rules": {
    "recommended": true,
    "correctness": {
      "noUnusedVariables": "error",   // promote from warn to error
      "noUnusedImports": "error"
    },
    "suspicious": {
      "noExplicitAny": "off"          // disable a recommended rule
    },
    "style": {
      "useConst": "error",
      "noVar": "error",
      "useTemplate": "warn"           // string concatenation → template literals
    }
  }
}
```

## High-signal rules by category

### `correctness` — bugs and logic errors

| Rule | What it catches | Default |
|---|---|---|
| `noUnusedVariables` | Variables declared but never used | warn |
| `noUnusedImports` | Imports that are never referenced | warn |
| `noUndeclaredVariables` | References to names not in scope | error |
| `useExhaustiveDependencies` | Missing deps in `useEffect`/`useCallback`/`useMemo` | error (with React) |
| `useHookAtTopLevel` | React hooks called conditionally | error |
| `noInvalidConstructorSuper` | `super()` missing in class constructor | error |
| `noPrecisionLoss` | Number literals with unreachable precision | error |
| `noSwitchDeclarations` | `let`/`const` inside `switch` case without block | error |
| `noVoidTypeReturn` | Returning a value from a void function | error |

### `suspicious` — likely bugs, code smell

| Rule | What it catches | Default |
|---|---|---|
| `noExplicitAny` | `any` type annotation | warn |
| `noDoubleEquals` | `==` instead of `===` | error |
| `noShadowRestrictedNames` | Shadowing globals like `undefined`, `NaN` | error |
| `noAsyncPromiseExecutor` | `async` function in `new Promise()` executor | error |
| `noFallthroughSwitchClause` | Missing `break` in switch | error |
| `noGlobalIsNan` | `isNaN()` vs `Number.isNaN()` | error |
| `noPrototypeBuiltins` | `obj.hasOwnProperty()` vs `Object.hasOwn()` | error |
| `noRedeclare` | Variable declared twice in same scope | error |
| `noSelfCompare` | `x === x` (always true) | error |
| `useIsNan` | Enforce `Number.isNaN()` | error |
| `noConsole` | `console.log/warn/error` in source | off (enable for prod code) |

### `style` — consistency and idioms

| Rule | What it catches | Default |
|---|---|---|
| `useConst` | `let` that could be `const` | warn |
| `noVar` | `var` declarations | error |
| `useTemplate` | String `+` concatenation → template literals | warn |
| `useDefaultParameterLast` | Default params not last | error |
| `useEnumInitializers` | Enum members without explicit values | error |
| `useSelfClosingElements` | `<div></div>` → `<div />` when empty | warn |
| `useShorthandAssign` | `x = x + 1` → `x += 1` | warn |
| `useLiteralEnumMembers` | Enum members must be string/number literals | error |
| `noNonNullAssertion` | `!` non-null assertion operator | warn |
| `noParameterAssign` | Reassigning function parameter | warn |
| `useNamingConvention` | Naming conventions for variables/functions/types | off (opt-in) |

### `performance` — runtime efficiency

| Rule | What it catches | Default |
|---|---|---|
| `noAccumulatingSpread` | Array `spread` inside a loop (O(n²)) | warn |
| `noDelete` | `delete` operator on object properties | warn |
| `noReExportAll` | `export * from '...'` (prevents tree-shaking) | off |
| `useTopLevelRegex` | RegExp literals inside functions (re-created per call) | warn |

### `a11y` — accessibility

| Rule | What it catches | Default |
|---|---|---|
| `useAltText` | `<img>` without `alt` | error |
| `useKeyWithClickEvents` | `onClick` without `onKeyUp`/`onKeyDown` | error |
| `noAriaHiddenOnFocusable` | `aria-hidden` on focusable elements | error |
| `useAriaPropsForRole` | Role missing required ARIA properties | error |
| `noSvgWithoutTitle` | SVG without `<title>` for screen readers | warn |
| `useButtonType` | `<button>` without `type` attribute | error |
| `useFocusableInteractive` | Interactive elements that can't receive focus | error |

### `complexity` — overly complex code

| Rule | What it catches | Default |
|---|---|---|
| `noExcessiveCognitiveComplexity` | Functions with cognitive complexity > threshold | warn |
| `noForEach` | `.forEach()` → `for...of` (better break/continue support) | warn |
| `noStaticOnlyClass` | Classes with only static members | error |
| `noThisInStatic` | `this` inside static methods | error |
| `useFlatMap` | `.map().flat()` → `.flatMap()` | warn |

### `security` — potential vulnerabilities

| Rule | What it catches | Default |
|---|---|---|
| `noDangerouslySetInnerHtml` | React `dangerouslySetInnerHTML` | warn |
| `noDangerouslySetInnerHtmlWithChildren` | Both `dangerouslySetInnerHTML` and children | error |
| `noGlobalEval` | `eval()` call | error |

### `nursery` — rules in stabilization

Notable nursery rules (opt-in):

| Rule | What it catches |
|---|---|
| `noSecrets` | Hardcoded secrets (API keys, tokens) in source |
| `noProcessEnv` | Direct `process.env` access (use config layer instead) |
| `useConsistentCurlyBraces` | JSX expression consistency |
| `noCommonJs` | `require()` in ESM projects |
| `useImportExtensions` | Missing file extensions in ESM imports |

Enable nursery rules explicitly:
```json
"nursery": {
  "noSecrets": "warn",
  "noProcessEnv": "warn"
}
```

## Rule options (where applicable)

Some rules accept an `options` object:

```json
"style": {
  "useNamingConvention": {
    "level": "warn",
    "options": {
      "strictCase": false,
      "requireAscii": true,
      "conventions": [
        { "selector": { "kind": "const" }, "formats": ["camelCase", "CONSTANT_CASE"] },
        { "selector": { "kind": "interface" }, "formats": ["PascalCase"], "prefix": "I" }
      ]
    }
  }
}
```

```json
"complexity": {
  "noExcessiveCognitiveComplexity": {
    "level": "warn",
    "options": { "maxAllowedComplexity": 20 }
  }
}
```

## Suppression for a single violation

```ts
// biome-ignore lint/suspicious/noExplicitAny: third-party API returns unknown shape
function deserialize(data: any): unknown { ... }
```

The rule name must exactly match `<category>/<ruleName>`. A typo or wrong category creates an unused suppression error.

## Suppression for a whole file

```ts
// biome-ignore lint: legacy file, refactor pending
```

Suppresses all lint rules for the file. Prefer per-rule suppression — whole-file suppression hides new violations.

## Rule discovery

```bash
# List all rules and their status
npx @biomejs/biome explain --category=suspicious

# Get help for a specific rule
npx @biomejs/biome explain noExplicitAny
```

## Common configurations for specific stacks

### React project

```json
"linter": {
  "rules": {
    "recommended": true,
    "correctness": {
      "useExhaustiveDependencies": "error",
      "useHookAtTopLevel": "error"
    },
    "a11y": {
      "useAltText": "error",
      "useButtonType": "error"
    },
    "security": {
      "noDangerouslySetInnerHtml": "warn"
    }
  }
}
```

### Node.js backend (no browser globals)

```json
"linter": {
  "rules": {
    "recommended": true,
    "suspicious": {
      "noConsole": "off"
    },
    "correctness": {
      "noUnusedVariables": "error",
      "noUnusedImports": "error"
    },
    "nursery": {
      "noProcessEnv": "warn"
    }
  }
}
```

### Library (strict, no console, no any)

```json
"linter": {
  "rules": {
    "recommended": true,
    "suspicious": {
      "noExplicitAny": "error",
      "noConsole": "error"
    },
    "performance": {
      "noReExportAll": "warn"
    }
  }
}
```
