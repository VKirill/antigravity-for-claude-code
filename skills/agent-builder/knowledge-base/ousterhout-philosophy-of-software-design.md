# A Philosophy of Software Design — John Ousterhout

Compact reference for preload into planner / architect agents. Covers the principles relevant to feature planning and module design.

Source: Ousterhout, *A Philosophy of Software Design*, 2nd ed. (2021).

## Central thesis

**The biggest problem in software is complexity, and complexity comes from dependencies and obscurity.**

- **Dependencies** — when changes to one piece of code require coordinated changes elsewhere
- **Obscurity** — when important information is not obvious from the code

Most of the book is tactics for reducing both.

## Working code isn't enough — strategic vs tactical

> "Tactical programming gets things working. Strategic programming invests in design quality so the next change is easier."

- **Tactical**: just make this work, move on
- **Strategic**: spend 10-20% more time on design so future changes don't fight you

Most codebases are mostly tactical. Symptom: bug rate trends up as the codebase grows.

In planning: "Architecture decisions" section of SPEC should capture the strategic choice — what you're investing in beyond making it work.

## Modules should be deep

**Deep module**: simple interface, significant hidden complexity. Powerful.

**Shallow module**: simple interface, simple implementation. Negligible value — caller could have written it inline.

Examples:
- ✅ Deep: Unix file I/O (`open`, `read`, `write`, `close`) — five calls hide page caches, journaling, permission checks, network filesystems
- ❌ Shallow: `getInt(map, key)` that just calls `map.get(key)` cast to int — caller could write it themselves

In planning: when proposing a new module, ask "Is its interface meaningfully simpler than its implementation?" If no → inline.

## Pull complexity downward

When you must choose where complexity lives, **put it in the implementation, not the interface**. The implementation is written once; the interface is used many times.

> "It's more important for a module to have a simple interface than a simple implementation."

Concrete:
- Default parameter values handle the 80% case so callers don't pass them
- Error recovery happens inside the module, not via try/catch by every caller
- Configuration is loaded inside, not passed as an argument tree

## Define errors out of existence

The best way to handle an error is to design the API so the error can't occur.

Examples:
- File close that fails: design as "close + flush" so callers don't have to handle close errors
- Lookups that fail: return a sentinel ("not found" object) instead of null + check
- String functions that handle empty / null naturally instead of crashing

In SPECs: when proposing an interface, list the error cases. For each, ask "Can I redesign so this error doesn't exist?"

## Information hiding (and leakage)

**Information hiding**: each module hides design decisions that aren't relevant to its users.

**Information leakage**: a design decision is reflected in multiple modules, creating coupling.

Common leakage patterns:
- Multiple modules know the format of a file
- Multiple modules construct the same complex object
- Multiple modules check the same conditional ("if user.role == admin")

In planning: when two new modules need the same piece of information, that's a sign you need a third module to own it.

## Comments should describe things that aren't obvious from the code

Bad comment: `i++; // increment i`

Good comments:
- **Why** the code is this way (rationale)
- **Preconditions** the caller must satisfy
- **Postconditions** the function guarantees
- **Invariants** maintained by the module
- **Cross-references** to related code in other files

> "Comments augment the code by providing information at a different level of detail."

In SPECs: the SPEC.md *is* the high-level comment for the whole feature.

## Don't bundle general and special purpose

A method should be either:
- General-purpose — usable by many callers in many situations
- Or special-purpose — usable by exactly one caller for one purpose

Methods that try to be both end up complicated and confusing.

Sign of trouble: parameters that are "if X mode then do A else do B". Often that's two methods masquerading as one.

## Comments first

Write the comment / interface description **before** writing the code.

Forces you to think about the interface, not the implementation. If you can't explain the interface clearly, the design is wrong.

This is what a SPEC is: forcing comments before code at feature scale.

## When to refactor

Apply the strategic principle: **invest now so the next change is easier**.

Signals to refactor:
- Same change needed in multiple places (information leakage)
- A simple change required reading many files (obscurity)
- A new feature is "almost" possible but the abstraction doesn't quite fit
- Two modules with circular knowledge of each other (dependency)

## Red flags Ousterhout names

- **Shallow module**
- **Information leakage**
- **Temporal decomposition** — modules organized by "when things happen" rather than "what knowledge they own". (Common with planner / executor / cleanup split.)
- **Pass-through method** — method that just forwards to another method, adding nothing
- **Repetition** — same logic in multiple places
- **Special-general mixture** — bundling
- **Conjoined methods** — two methods that must be called together, with shared state between them
- **Implementation documentation contaminating interface** — interface doc mentions internal details
- **Vague names** — `data`, `value`, `process`, `handle` — don't constrain meaning

## Applying in planner agents

When `feature-planner` produces a SPEC, the "Architecture decisions" section should:
- Note where complexity is being pulled (interface vs implementation)
- Note which errors are being designed out
- Note which information is staying hidden in which module
- Flag any temporal decomposition or shallow modules and justify them

For verifiers, Ousterhout is less directly applicable — verifiers don't design, they check.

## Citation rule

Other files reference this with:
> "Apply deep-modules and pull-complexity-downward principles from Ousterhout (see [knowledge-base/ousterhout-philosophy-of-software-design.md](../knowledge-base/ousterhout-philosophy-of-software-design.md))."

Not by re-explaining inline.
