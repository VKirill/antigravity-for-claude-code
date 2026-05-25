---
name: refactoring
description: "Architecture analysis + refactoring planning. Read-only methodology: scan current structure via serena + gitnexus, identify boundaries violations, design target architecture, set per-file line budgets, allocate symbols to files. Produces a YAML refactoring plan that worker-coder tasks execute step-by-step. Use when: рефакторинг, разделить файл, split file, decompose, extract module, target architecture, restructure, файл слишком большой, плохая архитектура, technical debt."
allowed-tools: Read, Grep, Glob, Bash, mcp__serena__find_symbol, mcp__serena__find_referencing_symbols, mcp__serena__get_symbols_overview, mcp__serena__find_declaration, mcp__serena__find_implementations, mcp__gitnexus__impact, mcp__gitnexus__context, mcp__gitnexus__query, mcp__gitnexus__tool_map, mcp__gitnexus__api_impact, mcp__gitnexus__shape_check, mcp__gitnexus__route_map
---

# Refactoring — Architecture Analysis + Plan

You analyze code architecture and produce a **refactoring plan**, not the refactoring itself. Your output is a structured YAML document the orchestrator splits into worker-coder tasks for execution.

You are **read-only**. You don't `Edit`, you don't `Write` source files, you don't run mutating commands. The plan you produce is a contract worker-coder will execute later.

## When to invoke this skill

✅ "Refactor file X" / "split this file" / "decompose this module"
✅ "Файл слишком большой / трудно читать"
✅ "Технический долг в области Y"
✅ "Разделить класс/сервис на N частей"
✅ "Что не так с архитектурой здесь?"
✅ Pre-planning before a worker-coder gets a refactoring task

❌ Bug fix that touches one function — that's worker-coder direct, no plan needed
❌ Rename one symbol — use `mcp__serena__rename_symbol` directly
❌ Adding a new feature (different skill: `writing-plans` / orchestrator Phase 2)
❌ Production fire — refactor afterwards, not now

## The protocol

### Step 1 — Scan current architecture

Pick the scope (file / directory / "the auth module"). Then collect facts:

**Inventory (use `Glob` + `wc -l`):**
```bash
find <scope> -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.py" -o -name "*.vue" \) -exec wc -l {} +
```

Build a table: `file | lines | top-level symbols | responsibility (1 line)`.

**Symbol map (use serena):**
For each large file (>200 lines or you suspect it):
- `mcp__serena__get_symbols_overview(relative_path: "<file>")` → top-level structure
- For each top-level symbol that looks load-bearing:
  - `mcp__serena__find_referencing_symbols(name_path: "<symbol>", relative_path: "<file>")` → who depends on it
  - `mcp__gitnexus__impact(target: "<symbol>", direction: "upstream")` → blast radius

**Architecture map (use gitnexus):**
- `mcp__gitnexus__tool_map` — overall feature inventory (which surfaces exist)
- `mcp__gitnexus__route_map` — for HTTP request flows
- `mcp__gitnexus__query` — for concept-based search ("where do we calculate price", "who reads the wallet balance")

**Test coverage signal:**
```bash
find <scope> -name "*.test.*" -o -name "*.spec.*" | xargs wc -l
```
Compare to source lines. **No tests = refactor blocked until tests added (separate plan).**

### Step 2 — Identify boundary violations

Hunt for these signals in the inventory:

| Signal | What it means | Fix direction |
|---|---|---|
| File > 500 lines (TS/JS) or > 700 lines (Python/Vue) | Too much in one place | Split by responsibility |
| File has > 8 top-level symbols | God file | Group symbols, extract |
| Single function > 80 lines | God function | Extract sub-functions |
| Single class > 12 methods | God class | Decompose into 2-3 classes by cohesion |
| Multiple unrelated concerns in one file (e.g. validation + persistence + transport) | Mixed layers | Split by layer |
| Circular import (file A imports B, B imports A) | Coupling cycle | Extract shared piece to C |
| Same magic number/string in ≥3 places | Hidden constant | Extract to constants module |
| Repetitive copy-paste blocks ≥3× | Duplication | Extract function/helper |
| `index.ts` re-exports >50 things | Barrel anti-pattern | Direct imports |
| Test file > source file in lines | Tests are testing implementation, not behavior | Re-think what to test |

**Line-count thresholds are heuristic, not law.** A 600-line file with one cohesive responsibility may be fine. A 200-line file with three concerns is not. Cohesion > size.

### Step 3 — Design target architecture

For the scope, decide:

**Layers (if applicable):** what's the project's existing layering? Don't invent a new layer — respect what's there.

**Modules:** group the symbols you found by cohesion (what changes together stays together). Aim for:
- Each module: 1-2 sentences of responsibility, no "and"
- Each module: 100-400 lines (heuristic, adjust to stack)
- No circular dependencies between modules
- Public API of each module ≤ 5 exports (rule of thumb)

**File boundaries (the answer to user's "границы файлов"):**

For each target file, specify:
```yaml
file: src/payments/refund/processor.ts
budget_lines: 180          # target ±20% — soft cap
hard_cap_lines: 250        # if exceeded after this refactor → split again
responsibility: |          # one sentence, no "and"
  Process refund requests: validate, call gateway, update wallet, emit event.
contains:
  - "processRefund(req): Promise<RefundResult>     # public entry"
  - "validateRefundRequest(req): ValidationResult  # internal"
  - "callRefundGateway(req): GatewayResponse       # internal, may throw"
  - "applyRefundToWallet(req, gw): WalletDelta     # internal"
exports:
  - processRefund            # only this is public
imports_from:
  - ../gateway/yookassa       # external boundary
  - ../wallet/balance         # adjacent module
  - ../events/bus             # cross-cutting
```

**What does NOT go in this file** (state explicitly to prevent drift):
- Refund-list endpoints (those are in `routes/refunds.ts`)
- Refund DB schema (that's in `db/refunds.sql`)
- UI display logic (that's frontend)

### Step 4 — Plan the migration sequence

Refactoring is a graph of small steps, each one keeping tests green. **Each step is a separate task** for worker-coder. Order matters — pick the order that:

1. **Strangler-fig pattern**: introduce new structure alongside old, redirect callers one at a time, delete old last
2. **Bottom-up**: refactor leaves (no callers) first, work upward
3. **Test-first**: if tests are missing for the affected area — first task is "add characterization tests", THEN refactor

Each migration step:
```yaml
- step: 1
  action: "Add characterization tests for processRefund happy path"
  files_touched: [src/payments/refund.test.ts]
  expected_lines_delta: +60
  verifies: ["npm test -- refund"]
  rollback_safe: true        # can be reverted without breaking anything

- step: 2
  action: "Extract validateRefundRequest into refund/validate.ts"
  files_touched:
    - src/payments/refund/validate.ts   # NEW
    - src/payments/refund.ts            # MODIFIED — remove inlined logic, import from validate
  expected_lines_delta: "+45 / -50"
  verifies: ["npm test -- refund", "tsc --noEmit"]
  rollback_safe: true
```

### Step 5 — Output the refactoring plan

Your final reply is a YAML block (in fenced code) with this structure:

````yaml
refactoring_plan:
  scope: "src/payments/refund/"
  estimated_contracts: 5-8       # количество worker-задач, не часы
  risk_class: medium             # low|medium|high
  blocks_other_work: false       # true if needs DB migration / API contract change

current_architecture:
  files:
    - path: src/payments/refund.ts
      lines: 612
      top_level_symbols: 11
      concerns: [validation, gateway-call, wallet-update, http-routing, error-mapping]
      problems:
        - "God file: 5 unrelated concerns in one place"
        - "processRefund function is 180 lines"
        - "No tests for error paths"
    - path: src/payments/refund.test.ts
      lines: 80
      coverage: "happy path only — 3 of ~12 scenarios"
  callers_from:                   # blast radius from gitnexus
    - src/routes/payments.ts
    - src/jobs/refund-retry.ts
  graph_findings:
    - "refund.ts:processRefund called from 7 sites"
    - "Circular: refund.ts ↔ wallet/balance.ts (via re-export)"

target_architecture:
  files:
    - path: src/payments/refund/index.ts            # NEW — public facade
      budget_lines: 30
      hard_cap_lines: 50
      responsibility: "Public API for refund operations"
      contains: ["processRefund (re-export)", "RefundResult (re-export)"]
      exports: [processRefund, RefundResult]
      imports_from: [./processor, ./types]
    - path: src/payments/refund/processor.ts        # NEW
      budget_lines: 180
      hard_cap_lines: 250
      responsibility: "Orchestrate a refund: validate → gateway → wallet"
      contains:
        - "processRefund(req): Promise<RefundResult>"
        - "internal helpers"
      exports: [processRefund]
      imports_from: [./validate, ./gateway-client, ./wallet-update, ./types]
    - path: src/payments/refund/validate.ts         # NEW
      budget_lines: 90
      hard_cap_lines: 130
      responsibility: "Validate refund request structure and business rules"
      exports: [validateRefundRequest, ValidationError]
      imports_from: [./types, ../../lib/zod-schemas]
    # ... etc — list every target file
  dependency_graph: |
    index.ts → processor.ts → {validate.ts, gateway-client.ts, wallet-update.ts}
    All → types.ts (leaf)
    NO cycles after refactor.
  layer_assignments:                # if project has layers
    domain: [validate.ts, types.ts]
    application: [processor.ts]
    infrastructure: [gateway-client.ts]

migration_sequence:
  - step: 1
    action: "Add characterization tests for current behavior"
    files_touched: [src/payments/refund.test.ts]
    assignee_agent: worker-tester
    verifies: ["npm test -- refund"]
    rollback_safe: true
  - step: 2
    action: "Extract validate to src/payments/refund/validate.ts"
    files_touched: [src/payments/refund/validate.ts (new), src/payments/refund.ts]
    assignee_agent: worker-coder
    verifies: ["npm test -- refund", "tsc --noEmit"]
    rollback_safe: true
    skill_hints: [refactoring]
  # ... continue

success_criteria:
  - "All existing tests still pass without modification"
  - "No file > hard_cap_lines after refactor"
  - "tsc --noEmit clean"
  - "No new circular imports (verify with gitnexus impact)"
  - "Public API of src/payments/refund/* unchanged (gitnexus api_impact = empty diff)"

risks:
  - risk: "Circular ref between processor.ts and wallet-update.ts may reappear"
    mitigation: "Extract shared types to types.ts; both import from there"
  - risk: "Coverage thin — refactor may pass tests but break edge case"
    mitigation: "Step 1 adds characterization tests covering current behavior, including edge cases"

out_of_scope:
  - "Refund UI changes"
  - "Refund DB schema"
  - "Gateway provider switch (separate task)"
````

## Discipline rules (non-negotiable)

- **Behavior preservation is the contract.** A refactor that changes externally observable behavior is NOT a refactor — it's a feature change in disguise. Reject the contract or split it.
- **Tests-first for under-tested areas.** Before refactoring, characterization tests must lock the current behavior. Plan them as step 1.
- **Small commits, green at every step.** Each migration step is a separate worker-coder task that ends with tests green. No "wait, it'll be green at the end of step 4".
- **Use LSP tools, not text replace.** When worker-coder executes: `mcp__serena__rename_symbol` for renames, `mcp__serena__find_referencing_symbols` to know what to update. Manual find-and-replace misses string-typed references.
- **Graph-first, grep-fallback.** Always run `mcp__gitnexus__impact` before deciding what callers to touch. Grep misses dynamic dispatch, re-exports, conditional imports.
- **Don't refactor what doesn't change soon.** If the area hasn't been edited in 6 months and no one's complained — it's "stable", not "needs work". Refactor near work-in-progress.

## Catalog of refactorings (when to pick each)

| Refactoring | When | Tools |
|---|---|---|
| Extract function | Repeated block 3+ times, OR function > 80 lines | `mcp__serena__find_symbol`, plain Edit |
| Extract module/file | File too large, mixed concerns | `mcp__serena__find_referencing_symbols` to track callers |
| Inline function | One-line wrapper that adds no clarity | LSP rename + delete |
| Rename | Name misleads, drift after change | `mcp__serena__rename_symbol` |
| Move (file/symbol) | Wrong layer/module | Plan: serena finds refs; worker-coder updates imports |
| Split file | One file → N files | Full pipeline of this skill |
| Merge files | Over-fragmented (3 files, 30 lines each, always edited together) | Plan: consolidate + remove indirection |
| Replace conditional with polymorphism | `if (type === 'A') ... else if (type === 'B') ...` repeating | Strategy pattern; high-risk refactor |
| Extract interface | Concrete class used as boundary; need to swap impls | Plan: add interface, refactor callers to depend on it |
| Pull up / push down (class hierarchy) | Misplaced members in inheritance tree | Manual + serena rename |

## File boundary rules — fast version

Use these defaults; tune to the project's actual style.

| Stack | Typical file budget | Hard cap |
|---|---|---|
| TypeScript / JavaScript (logic) | 150-300 lines | 500 |
| TypeScript (React component file) | 100-200 lines | 350 |
| Python (module) | 200-400 lines | 700 |
| Python (class) | 150-300 lines | 500 |
| Vue SFC | 200-400 lines total (template+script+style) | 600 |
| Astro component | 150-250 lines | 400 |
| SQL migration | 50-200 lines | no hard cap, but split atomic changes |
| Test files | 1.5-2× source file | match source ratio |

**Override these when project conventions differ.** Look at existing well-organized files in the codebase to calibrate.

## What goes in which file — content allocation rules

1. **One responsibility per file.** Test by stating it in one sentence, no "and". If you can't — split.
2. **Public API at the top, internals below.** Reader scans top, finds entry points; goes deeper as needed.
3. **Types co-located by default** (next to the function that owns them). Only split into `types.ts` if 3+ files share them.
4. **Constants:** if used in one file → inline at top. If used 2+ → extract to `constants.ts` of that module. Project-wide → top-level `constants/`.
5. **Helpers:** start co-located. Promote to `utils.ts` of the module only when 3+ files import them. Promote to project-wide `lib/utils/` only when used across modules.
6. **`index.ts` barrel files:** small (≤ 50 lines), only re-exports, no logic.
7. **Tests:** parallel structure to source. `src/foo/bar.ts` ↔ `src/foo/bar.test.ts`. Don't put tests in a far-away `tests/` directory unless project uses that pattern.

## Hand-off to worker-coder

After producing the refactoring_plan YAML, **stop**. Don't execute. The orchestrator reads your plan, splits `migration_sequence` into worker-coder contracts, dispatches them one at a time. You can be invoked again later to update the plan based on actual results from step 1, but don't go beyond planning in one call.
