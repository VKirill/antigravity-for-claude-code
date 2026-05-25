---
name: refactor-hotspots-craft
description: "Behavioral code analysis from Tornhill (Software Design X-Rays). Use when: worker-refactor-architect prioritizes technical debt, identifies hotspots from git history, detects temporal coupling between files. Trigger terms: hotspot, change frequency, temporal coupling, knowledge map, splinter pattern, fractal value, behavioral code analysis. SKIP: greenfield projects with no git history."
stacks:
  - stack-agnostic
tags:
  - refactoring
  - technical-debt
  - behavioral-code-analysis
  - hotspots
  - temporal-coupling
  - git-history
source: "Tornhill — Software Design X-Rays (2018)"
---

## Use this skill when

- worker-refactor-architect needs to prioritize refactoring effort in a large legacy codebase.
- Identifying which files actually deserve refactoring (high complexity × high change frequency).
- Detecting hidden dependencies — files that change together despite no static dependency.
- Assessing the impact of a key contributor leaving the project.
- Evaluating if an architecture (microservices) actually reduces team coordination.
- Onboarding to an unfamiliar codebase with millions of lines.

## Do not use this skill when

- Greenfield project with no commit history.
- Small codebase a single person can fully model mentally.
- Goal is individual performance evaluation (Tornhill: never use these metrics for that).
- Version-control history has been squashed or lost.

## Purpose

Translate Tornhill's *Behavioral Code Analysis* into a decision-making discipline for worker-refactor-architect. Replaces "refactor everything that smells" with "refactor what the git history proves is costing us money". Three primary signals: change frequency, temporal coupling, knowledge distribution. Each rule cites the source so the agent has both the *what* and the *why*.

## Capabilities

### Hotspot identification (frequency × complexity)

Technical debt only "costs interest" if you touch the code (Tornhill, Ch. 1, p. 5). A 5000-line file changed twice in 3 years is cheaper to leave alone than a 500-line file changed weekly. Hotspot = intersection of high change frequency (from git log) × high complexity (LOC, indentation depth, cyclomatic complexity).

CLI workflow:
```bash
# Per-file change frequency since cutoff date
git log --since="6 months ago" --name-only --pretty=format: \
  | grep -v '^$' | sort | uniq -c | sort -rn | head -50

# Per-file LOC (complexity proxy)
find . -name '*.ts' -o -name '*.py' | xargs wc -l | sort -rn | head -50

# Cross-reference: files appearing in both top-N lists are hotspots
```

Apply when:
- Asked "what should we refactor" — never answer by intuition; pull git data first.
- Static analyzer reports "4000 years of tech debt" — Tornhill: most of it is in dead code; sort by change frequency, ignore the long tail.
- A massive file exists but never changes → leave it; focus on the 800-LOC file edited daily.

### Temporal coupling analysis

Two files that change together in the same commit are *temporally coupled*, even if no static dependency exists between them (Tornhill, Ch. 3, p. 38). High temporal coupling between unrelated modules = missing abstraction, copy-paste clone, or "shotgun surgery" pattern. When this pattern crosses service / repo boundaries you've built a **Distributed Monolith** — defined canonically in `architecture-craft` anti-patterns; behavioral analysis here gives the empirical evidence for the structural diagnosis there.

CLI workflow:
```bash
# Find files that change together in last 6 months
git log --since="6 months ago" --name-only --pretty=format:"COMMIT" \
  | awk '/^COMMIT/{commit=NR} {print commit, $0}' \
  | sort | uniq | awk '{print $1}' | sort | uniq -c \
  # ... (Tornhill's code-maat tool automates this — recommend installing)
```

The most actionable signal is **surprising coupling**: a backend service and a frontend file change together every commit. That's a missing abstraction (probably a shared DTO not yet extracted).

Apply when:
- Designing a refactor — first ask "which other files always change with this one?" — they're part of the actual unit.
- Microservice split candidate — check if proposed services have high temporal coupling; if yes, the split is wrong (distributed monolith).
- Two modules in different repos co-change → bridge them with a shared package, OR collapse the boundary.

### Social code analysis + knowledge maps

Map git-author distribution to code (Tornhill, Ch. 7, p. 122). Two metrics:

- **Main Contributor** — person with most commits in a file → domain expert for that module.
- **Fractal Value** (0.0-1.0) — measure of contributor fragmentation. Low = one author owns it (knowledge silo + bus factor risk). High = many minor contributors (defect risk, "diffusion of responsibility").

Tornhill: "Organizational factors are better predictors of defects than any property of the code itself" (Ch. 7, p. 119).

Apply when:
- Bus-factor assessment — list main contributors for each top-50 hotspot; if one person owns 5+ hotspots, plan knowledge transfer.
- A hotspot has high fractal value (10+ minor contributors, no main owner) — flag as "no one fully understands this" → defect-prone.
- Verifying Conway's Law alignment — team boundaries should match architectural boundaries; if 3 teams all commit to the same module weekly, the boundary is wrong.

### Splinter pattern for breaking up massive hotspots

Refactoring a 10k+ LOC file under heavy parallel development without freezing feature work (Tornhill, Ch. 4, p. 59):

1. Run X-Ray analysis to identify distinct *behaviors* within the hotspot (methods that change together via temporal coupling, ignoring static structure).
2. Build a safety net of temporary end-to-end characterization tests around the hotspot.
3. Extract one behavior into a new class/module — original keeps a delegating facade.
4. Repeat. Each step is independently reviewable + mergeable, minimizing conflict surface.
5. Once the original is a thin facade — remove the middleman, point callers at the new modules.

Apply when:
- A god-class / god-file appears in hotspot scan — Splinter, not "stop the world to rewrite".
- Multiple teams need to keep shipping features while refactor proceeds — Splinter's incremental nature is the point.

### Aggregated complexity trends (whistleblower)

Track complexity over time, not just the snapshot. A file that gained 2k LOC in 6 months is "rising hotspot" — catch it before it becomes a god-class (Tornhill, Ch. 5).

CLI workflow:
```bash
# Sample LOC at 4 historic dates
for date in '6 months ago' '3 months ago' '1 month ago' 'now'; do
  git checkout $(git rev-list -1 --before="$date" main)
  wc -l src/**/*.ts | sort -rn | head -20
done
```

Apply when:
- Quarterly review — "which files grew fastest" → preemptive refactor targets.
- Tempted to add another 200 lines to an already-1500-line file → check trend; if it's been rising 6 months, splinter first.

## Behavioral Traits

- Always prioritize refactoring based on git change frequency, not static "code smells" alone.
- Use "surprise" as the primary heuristic when investigating temporal coupling.
- Treat test code with the same quality standards as application code (it shows up in hotspots too).
- Look for "rising hotspots" early — catch decay before it's chronic.
- Distinguish operational boundaries (who writes code) from knowledge boundaries (who understands it).
- Use behavioral data to challenge gut feelings about "what's bad" — often the data disagrees.

## Important Constraints

- NEVER use social metrics or knowledge maps for individual performance evaluations (Tornhill, hard rule).
- ALWAYS exclude autogenerated code and non-code artifacts (lock files, snapshots, build outputs) from analysis.
- NEVER refactor a file with low change frequency regardless of its complexity — wasted effort.
- ALWAYS pick a significant "start date" for social analysis — old contributor history biases current ownership picture.
- NEVER assume "many contributors" means "collective ownership" — it usually means "high defect risk + no owner".
- ALWAYS use the Splinter pattern (incremental + safety net) for hotspot decomposition, not a stop-the-world rewrite.

## Anti-patterns

### ❌ The Technical Debt Trap

**Source:** Tornhill Ch. 1. **Why wrong:** Trying to fix all 4000 years of static-analyzer-reported debt without checking if any of that code is actually touched.

**Fix:** Sort by change frequency; ignore the long tail; pay debt where it accrues real interest.

### ❌ Normalization of Deviance

**Source:** Tornhill Ch. 5. **Why wrong:** Accepting a 20k-line file as "the new normal" because it grew slowly over years — boiling-frog problem.

**Fix:** Track aggregated complexity trends; alert when a subsystem hits a tipping point (e.g., gained 3000 LOC in 6 months).

### ❌ Hero Worship (knowledge silo)

**Source:** Tornhill Ch. 7. **Why wrong:** One person owns 80% of a critical module — they go on vacation, releases freeze; they quit, the company freezes.

**Fix:** Schedule pair-programming or knowledge-transfer commits; track fractal value as a leading indicator.

### ❌ Static-Smell-Driven Refactoring

**Source:** Tornhill Ch. 2. **Why wrong:** Refactoring code that "looks ugly" but is touched once a year — you spent the budget on cosmetic improvement to a stable file while the actually-painful hotspot rotted.

**Fix:** Drive refactor priority from git frequency × complexity, not from linter output alone.

## Related Skills

### Sibling refactoring skills
- `refactoring` — read-only architecture analysis via serena + gitnexus; this skill adds the *prioritization* layer
- `architecture-craft` — designs target architecture; this skill identifies *which* areas to redesign first
- `coder-craft` — the implementation discipline; Splinter pattern leans on its named refactorings (Extract Function, Sprout Method)

### Adjacent
- `git` — the underlying data source; need clean commit history for behavioral analysis
- `gitnexus-impact-analysis` — static blast radius (complement to dynamic git-frequency analysis)
- `gitnexus-refactoring` — graph-based safe rename / extract / move

## Citations from source

> Technical debt is code that's more expensive to maintain than it should be. That is, we pay an interest rate on it.
> — *Tornhill, Ch. 1, p. 4*

> Interest rate is a function of time... It's not technical debt unless we have to pay interest on it.
> — *Tornhill, Ch. 1, p. 5*

> Organizational factors are better predictors of defects than any property of the code itself, be it code complexity or code coverage.
> — *Tornhill, Ch. 7, p. 119*

> The more red a circle is, the more coordination there is between different teams.
> — *Tornhill, Ch. 1, p. 12*

> A building tears itself apart because of the different rates of change of its components.
> — *Tornhill, Ch. 5, p. 73*

## Sources

- Adam Tornhill — *Software Design X-Rays: Fix Technical Debt with Behavioral Code Analysis* (Pragmatic Programmers, 2018)
