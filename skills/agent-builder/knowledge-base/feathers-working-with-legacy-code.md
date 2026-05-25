# Feathers, *Working Effectively with Legacy Code*

**Source type:** book
**Date / edition:** 2004
**Epistemic status:** distilled principles, not direct quotes

## Core thesis

**Legacy code is code without tests.** That definition is provocative on purpose — it shifts focus from "old code" to "code I can't safely change". The book is a toolbox for getting unsafe code into a state where you can change it confidently.

## Key principles

1. **Legacy code = code without tests.** Age doesn't matter. A 6-month-old codebase with no tests is legacy. A 20-year-old codebase with good tests is not.

2. **The Legacy Code Dilemma.** To safely change code, you need tests. To write tests, you often need to change the code (introduce seams, break dependencies). The book is about resolving this cycle without breaking things on the way.

3. **Seams.** A seam is a place where you can alter behavior without editing in that place. Examples: dependency injection, polymorphism, preprocessor macros, link-time substitution. Finding seams is how you get testability into untestable code.

4. **Characterization tests.** Before changing legacy code, write tests that *pin down its current behavior* — even if that behavior is wrong. The goal is not "this code is correct" but "this code does X, and I'll notice if X changes". Then you change with confidence.

5. **Sprout method / Sprout class.** When adding new functionality to legacy code, don't modify the legacy methods — *sprout* new methods alongside them, then call into them from minimal changes to the legacy. This isolates new logic in testable units.

6. **Wrap method / Wrap class.** When you need to add behavior around an existing method, rename the original and create a new method with the original's name that wraps it. The callers don't change; the new behavior gets a clean unit.

7. **Effect sketches.** Before changing code, sketch what depends on it. What writes to this variable? What reads it? Which methods call this method? Following the effect graph reveals the blast radius of a change.

8. **Don't refactor what you don't have tests for.** Two non-negotiable rules: tests before refactoring; small refactorings, not big ones. A "clean it all up" refactor of untested code is the most dangerous operation in software.

9. **The 7 minutes.** A test suite that takes 7 minutes to run effectively gets run "sometimes". A test suite that takes 1 second gets run constantly. Test feedback loops shape behavior.

## How to apply in code-design decisions

- **When asked to "refactor this old code":** ask first — does it have tests? If not, characterization tests come first.
- **When asked to "fix this bug in untested code":** characterization tests around the buggy area, then fix, then verify the characterization tests show the change you intended.
- **When proposing to change a method signature:** sketch the effect graph. How many call sites? How many subclasses override?
- **When tempted to add a new branch to an existing method:** consider sprout instead. New code in a new method is testable; new branches in old methods inherit the old untestability.
- **When the test suite is slow:** treat test speed as a first-class concern. Slow tests are tests that don't get run.

## When this source is WRONG / dated

- **Java-heavy examples.** Some techniques (subclass-and-override, "extract interface") are easier in OO languages with virtual methods. The principles port, but the recipes need translation for functional / dynamic codebases.
- **Pre-DI-frameworks era.** Modern DI containers and mocking libraries make some of Feathers' manual techniques less necessary. The mental model (seams, effects) still applies.
- **Pre-cloud / pre-microservices.** Doesn't address the "legacy code is in a service we can't restart" problem that distributed systems create.
- **The book assumes you can read the code.** For codebases where most code is in compiled vendor libraries, generated code, or third-party services, you need different tools (contract testing, consumer-driven contracts).

## Cross-references

- **Pairs well with:** Ousterhout (Ousterhout: how good code should look; Feathers: how to get from bad to good safely)
- **Pairs well with:** any property-testing / characterization approach (Hypothesis, fast-check) — these are characterization tests on steroids
- **Pairs well with:** Kleppmann's chapter on data migrations — same "characterize current behavior, change safely" mindset at the data layer

## Use in agent system prompts

Standing rules to embed (compressed):

```
- Untested code is legacy code, regardless of age. Don't refactor it without tests.
- Before changing existing behavior, pin it down with a characterization test (even if the current behavior is wrong).
- Add new logic as a new method (sprout), not as a new branch in an existing method.
- Before changing a method signature, sketch the effect graph: callers, overriders, writers/readers.
- Test feedback speed shapes whether tests get run. Slow suites are unused suites.
```

These 5 lines belong in any **modify-existing-code** subagent (refactorer, bug-fixer, migration-helper). Less relevant for pure greenfield agents.
