# Example: adding a new book to the Knowledge Base

This walks through what to do when you read a book (or paper, or post) you want to encode as KB content for use in agent system prompts.

Worked example: encoding *The Pragmatic Programmer* (Hunt & Thomas).

---

## Step 1 — Decide if this belongs in KB at all

Not every book deserves a KB entry. Ask:

1. **Are there 5-10 distillable principles** that an agent could apply in code-design decisions? Books with one big idea (e.g., a memoir) don't fit. Books with many small ideas (Pragmatic Programmer, Code Complete) do.

2. **Are the principles still relevant?** Books pre-dating the late-2010s often have era-bound assumptions (Java-EJB era, pre-cloud, pre-container). Note the dated parts honestly.

3. **Do the principles apply to the kinds of agents you build?** Pragmatic Programmer applies to general code agents. *Designing Data-Intensive Applications* applies to backend/data agents but not to frontend-only ones. Match scope to your usage.

For Pragmatic Programmer: yes on all three.

## Step 2 — Read the source (or trusted summary)

Either:
- Read the book yourself (best)
- Read a high-quality summary you trust (decent, but note the indirection)
- Skim and pattern-match against what you already know (worst — high hallucination risk)

For our example: assume you've read the book.

## Step 3 — Distill to 5-10 principles

The KB template (in [INDEX.md](../knowledge-base/INDEX.md)) calls for "key principles" with names and short explanations.

For Pragmatic Programmer, candidates might be:
1. **DRY (Don't Repeat Yourself)** — every piece of knowledge should have a single, unambiguous representation. (Note: not "don't write similar code"; that's a misreading. It's about knowledge duplication, not text duplication.)
2. **Orthogonality** — components should have minimal interdependence. Change one, others don't care.
3. **Reversibility** — design for changing your mind. Tightly coupled decisions = future pain.
4. **Tracer bullets vs prototyping** — tracer bullets are minimal working implementations across the whole stack. Prototypes are throwaway. Different tools, different purposes.
5. **Programming by coincidence** — code that "works" but the author can't explain why. Trace why; don't trust accidents.
6. **The broken windows theory** — small visible neglect (one TODO, one ignored warning) signals OK-ness of further neglect. Fix the small things.
7. **Knowledge portfolio** — invest in learning regularly. Diversify (new languages, new domains).

That's 7 — within the 5-10 target.

## Step 4 — Mark epistemic status honestly

Some principles in the book are now widely accepted as foundational (DRY, orthogonality). Some are more debated (tracer bullets — is it still a useful frame, or has CI/CD evolved past it?). Some have aged poorly (the Knowledge Portfolio chapter advises learning a new language every year — fine advice, but the book's specific 2000s-era list is dated).

When writing the KB entry, mark each principle as:
- **Widely accepted** (cite without hedging)
- **Author's framing** (a useful mental model the author popularized)
- **Possibly dated** (the principle still holds, but examples / specific advice has aged)

## Step 5 — Write the KB file using the template

Create `knowledge-base/hunt-thomas-pragmatic-programmer.md` following the template structure in [INDEX.md](../knowledge-base/INDEX.md):

```markdown
# Hunt & Thomas, *The Pragmatic Programmer*

**Source type:** book
**Date / edition:** 1st ed. 1999, 2nd ed. 2019
**Epistemic status:** distilled principles, not direct quotes

## Core thesis
Software is built by craftspeople, not factory workers. Habits of attention, care, and continuous improvement compound over a career. The book is a catalog of those habits, not a methodology.

## Key principles

1. **DRY (Don't Repeat Yourself)** — every piece of *knowledge* has a single, unambiguous representation. Often misread as "don't write similar code" — actually about knowledge duplication. If two pieces of code change for the same reason, that's a DRY violation, even if they look different.

2. **Orthogonality** — components have minimal interdependence. Changing one doesn't ripple. Tests of orthogonality: can you describe a change to one component without mentioning others? Can you test it in isolation?

3. **Reversibility** — design for changing your mind. Decisions that lock you in (chosen database, chosen framework, chosen API contract with external customers) are expensive to revisit. Defer them; build escape hatches.

4. **Tracer bullets vs prototyping** — tracer bullets are minimal-but-real implementations across the entire stack. Prototypes are throwaway exploration. Don't conflate them — they have different lifespans and different code quality bars.

5. **Programming by coincidence** — code that "works" but the author can't articulate why. The fix isn't more code, it's *understanding*. Trace the actual behavior; verify your model matches reality.

6. **Broken windows** — small visible neglect (one TODO, one ignored warning) signals further neglect is OK. Cumulative effect: a codebase rotting from inattention. The fix: never leave broken windows in.

7. **Knowledge portfolio** — invest in regular learning, diversify across languages and domains. Possibly dated specifics (the book's "learn one language per year" advice), but the meta-principle holds.

## How to apply in code-design decisions

- **When you're tempted to copy-paste code:** ask if the two copies will change for the same reasons. If yes — DRY them. If no — duplication is fine.
- **When designing a module:** can you describe a change to it without mentioning other modules? If not, you're not orthogonal.
- **When making a decision that's hard to reverse:** flag it explicitly. Document the alternatives considered.
- **When code is "working but I'm not sure why":** stop. Don't ship coincidence. Trace until you understand.
- **When you see a TODO older than 30 days:** fix it or delete it. Don't let it sit.

## When this source is WRONG / dated

- **The "programmer as craftsperson" framing has been critiqued** as elitist by some, romanticizing individual effort over team / system effects. The principles still apply; the framing is era-bound.
- **Specific tool recommendations** (in the original 1999 edition; the 2019 revision updates these) date quickly.
- **The book pre-dates modern type systems and effect tracking.** Some principles (orthogonality, programming-by-coincidence) are partially addressed by better type systems in 2026.

## Cross-references

- **Pairs with:** Ousterhout (DRY at a deeper level; orthogonality maps to "deep modules")
- **Pairs with:** Feathers (broken windows = the legacy code phenomenon)
- **Conflicts with:** none — the principles are mostly foundational

## Use in agent system prompts

Standing rules to embed (compressed):

```
- DRY is about knowledge duplication, not text similarity. Two copies that change for the same reason violate it.
- Orthogonality: changing one module shouldn't require mentioning others.
- Don't ship code you can't explain. Programming by coincidence is technical debt with interest.
- Fix broken windows. A small visible problem signals further neglect is OK.
- Hard-to-reverse decisions deserve explicit flagging.
```

These belong in generalist code-design agents (planner, reviewer, architect).
```

## Step 6 — Update the INDEX

Add a row to `knowledge-base/INDEX.md`:

```markdown
| Hunt & Thomas, *The Pragmatic Programmer* | [hunt-thomas-pragmatic-programmer.md](hunt-thomas-pragmatic-programmer.md) | DRY, orthogonality, reversibility. Habits of attention, applied to code. |
```

Categorize it under "Software design — first principles" alongside Ousterhout and Martin.

## Step 7 — Optionally update templates

If you want the new principles available to your planner / architect agents, add to the `skills:` preload list in the relevant template:

```yaml
skills:
  - ousterhout-philosophy-of-software-design
  - martin-clean-architecture
  - hunt-thomas-pragmatic-programmer   # new
```

**Watch the cap.** Per [../references/memory-and-skills-preload.md](../references/memory-and-skills-preload.md), preload no more than ~4 skills — auto-compaction gives them a shared 25K-token budget. If adding Pragmatic Programmer pushes you over 4, decide which to drop. Pragmatic + Ousterhout overlap; Ousterhout is deeper. Pragmatic + Martin overlap on orthogonality; Martin is more system-level. Pragmatic's unique contribution (broken windows, reversibility) might justify the slot — your call.

## Step 8 — Test the change

If you updated a template's `skills:`, regenerate any agent files that use the template, then test:

1. Invoke the agent with a question that should pull on the new principles
2. Check whether the agent references the new content
3. Compare quality before/after the addition

If the agent doesn't seem to use the new content, the issue is usually:
- Compaction dropped it (too many preloaded skills)
- The skill body is too verbose (loads but isn't referenced)
- The agent's body needs a hint ("apply pragmatic-programmer principles where relevant")

## Common mistakes when adding new knowledge

1. **Treating all books as equal weight.** Some books deserve 200 lines of distillation; others deserve a 50-line note that they exist and what they cover.
2. **Writing summaries that mirror the source's structure too closely.** The KB entry should be your distillation, not chapter-by-chapter notes.
3. **Skipping "When this source is WRONG / dated".** Every source has limits. Honest assessment is what makes the KB useful in 5 years.
4. **Over-quoting.** This skill's KB style is "in your own words, with epistemic-status notes". Direct quotes belong in `**quotes**` only when phrasing is non-negotiable (e.g., "You MUST run the complete test suite" from Anthropic).
5. **Not testing the change.** A new KB entry that no agent ever pulls from is dead weight. Verify it gets used.

## Pruning the KB

Periodically (every few months):

1. **Note which KB entries you've never seen an agent reference.** Either the entries are wrong or unused — both signal pruning candidates.
2. **Note which agents most heavily preload skills.** If a planner preloads 6 skills, half are probably under-used.
3. **Note where principles conflict.** If Ousterhout says X and Pragmatic Programmer says Y, the KB should flag the conflict, not paper over it.

A lean KB of 4-6 well-used sources beats a sprawling KB of 20 sources nobody references.
