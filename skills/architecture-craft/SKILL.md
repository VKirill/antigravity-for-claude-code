---
name: architecture-craft
description: "System architecture discipline from Newman + Khononov + Richards/Ford. Use when: project-architect designs a new system, decomposes a monolith, chooses architecture style, writes ADRs, defines service boundaries. Trigger terms: bounded context, subdomain, architecture quantum, ADR, fitness function, saga, strangler fig. SKIP: single-file refactor, tactical UI design."
stacks:
  - stack-agnostic
tags:
  - architecture
  - ddd
  - bounded-context
  - microservices
  - architecture-quantum
  - adr
  - sagas
source: "3 books — see ## Sources at the end"
---

## Use this skill when

- project-architect starts designing a greenfield system or major rewrite.
- Decomposing a monolith into modular pieces or services.
- Choosing between monolith / modular monolith / microservices / event-driven.
- Defining service boundaries and ownership.
- Documenting a significant architectural decision (ADR).
- Evaluating whether existing architecture matches business needs.

## Do not use this skill when

- Single-file refactor or local cleanup — use coder-craft.
- Tactical UI design — use ui-craft.
- Choosing a specific library or framework version — use stack skills.
- The system is a simple CRUD prototype with no complex business rules.

## Purpose

Translate three canonical architecture books into one decision-making discipline for project-architect. Three lenses applied to every design question: business-domain decomposition (Khononov), distributed-system mechanics (Newman), trade-off analysis + documentation (Richards/Ford). Each rule cites the source so the agent has both the *what* and the *why*.

## Capabilities

### Subdomain categorization → strategic effort allocation

Every business has three subdomain types (Khononov, Ch. 1, p. 14):

- **Core** — competitive advantage; complex; build in-house with best engineers; protect with Anticorruption Layer.
- **Supporting** — necessary but no edge; build simple; can train new hires here.
- **Generic** — solved problem (auth, payments, search); buy / adopt off-the-shelf, never reinvent.

Apply when:
- Estimating effort — Core gets 5× the rigor of Supporting.
- Tempted to write auth from scratch — that's Generic, use Auth0/Clerk/better-auth instead.
- Choosing Event Sourcing — only justified for Core where audit/time-travel pays the complexity (Khononov, Ch. 10).

### Bounded contexts + ubiquitous language

A Bounded Context is the consistency boundary of a Ubiquitous Language (Khononov, Ch. 3, p. 42-43). Same term in different contexts can mean different things — `Lead` for Sales ≠ `Lead` for Marketing. Each context is owned by exactly one team, exposes a stable interface, hides internals. This is the foundation under both Newman's microservices ("modeled around a business domain", Ch. 1, p. 3) and Richards/Ford's architecture quanta.

Apply when:
- Designing a new service — first ask: what's its bounded context? Which subdomain?
- Two teams stepping on the same code → likely two bounded contexts squashed into one.
- New entity needed — first check `glossary.md` (project's Ubiquitous Language artifact); if name conflicts with existing context, separate.

### Architecture quantum + style selection

An **architecture quantum** is the smallest part of the system that runs independently with high functional cohesion and synchronous internal coupling (Richards/Ford, Ch. 7, p. 116). Number of quanta drives style:

- **1 quantum** → monolith / modular monolith (default, simplest).
- **N quanta with different characteristics** → microservices, event-driven, space-based.
- Each quantum must own its own data — never share a database across quanta (Newman, hard rule).

Style decision flowchart:
- Same team, same scaling needs, same availability target → modular monolith.
- Different teams + different scaling/availability per part → distributed.
- Async/long workflows dominate → event-driven.
- Need to scale a specific bottleneck independently → service-based or microservices.
- Massive concurrent users with shared state → space-based.

Apply when:
- Tempted by microservices for a 3-person team — that's distributed monolith risk; modular monolith first (Newman, Ch. 1).
- Splitting service — does each side actually need different deployment cadence / scale? If no, you're inventing problems.

### Trade-off analysis + ADRs

Everything in architecture is a trade-off (Richards/Ford, Ch. 1, p. 14). There is no "best" — only "least worst given constraints". Document every significant decision as an **Architecture Decision Record** (ADR) with: Title, Status, Context, Decision (commanding voice "We will use..."), Consequences, Compliance. ADRs prevent the "Groundhog Day" antipattern where the same decision gets re-litigated quarterly (Richards/Ford, Ch. 21).

Apply when:
- Choosing PostgreSQL vs MongoDB / monolith vs services / REST vs gRPC — write ADR before deciding, not after.
- Asked "why did we choose X" 3 months later — point to the ADR; if there isn't one, that's a process bug.
- An ADR has no clear trade-off → look harder; if truly no trade-off, the question wasn't architectural.

### Incremental decomposition: Strangler Fig + Sagas

Avoid big-bang rewrites — "the only thing you're guaranteed of is a big bang" (Newman, Ch. 3, p. 72). Decompose incrementally:

- **Strangler Fig**: intercept calls to the monolith, redirect to new service one capability at a time. Old code lives until the last route migrates (Newman, Ch. 3, p. 79).
- **Code-first vs data-first split**: pick based on which is the bottleneck; splitting data breaks ACID transactions — plan for Sagas.
- **Sagas** for distributed workflows: break long transaction into local transactions with compensating actions per step (Newman, Ch. 6, p. 182).
  - **Orchestration** = central coordinator (clear, but coupling); use for complex cross-team flows.
  - **Choreography** = event-driven, services react autonomously; use for decoupled autonomous services.

Apply when:
- Planning monolith → services migration — Strangler Fig, never big-bang.
- A workflow spans 3+ services with possible failures — Saga (orchestration or choreography), never 2PC.

### Inter-service communication + tolerant evolution

Prefer async non-blocking to reduce temporal coupling (Newman, Ch. 4). When sync is needed:
- Stable protocol (REST or gRPC, not RPC-over-DB).
- **Tolerant Reader**: consumers bind only to fields they need — producer can add fields without breaking them.
- **Consumer-Driven Contracts** (CDC): catch breaking changes in CI before deployment.
- **Correlation IDs** on every request that crosses a service boundary.

Apply when:
- Designing event payload — include enough data for consumer to act, avoid "callback to fetch more" coupling.
- Changing API — never breaking, use additive evolution; deprecate-then-remove over 2 release cycles.

### Fitness functions for automated governance

An architectural fitness function is an automated test that verifies a structural rule (Richards/Ford, Ch. 6). Examples: no cyclic deps between modules, no presentation→database direct calls, no service larger than N LOC, response time p99 under X ms. Moves governance from manual reviews to CI gates.

Apply when:
- Establishing a new constraint ("auth module must not import from billing module") — make it a fitness function, not a code-review checkbox.
- Onboarding new team — fitness functions teach the rules better than wiki docs.

## Behavioral Traits

- Always classify the subdomain (Core / Supporting / Generic) before estimating effort.
- Always start with the simplest architecture style that meets requirements; promote later.
- Always write an ADR before making a significant decision, not after.
- Always express every architectural choice as a trade-off; if you can't, you haven't analyzed enough.
- Never break a monolith for the sake of microservices — wait for a real bounded context to demand it.
- Always use business terminology (Ubiquitous Language) in service/module names, never tech jargon.
- Wait until the "last responsible moment" to make significant decisions — buys maximum information.

## Important Constraints

- NEVER share a database across services / bounded contexts (Newman, Khononov agree).
- NEVER use 2PC distributed transactions when a Saga is possible.
- NEVER outsource implementation of a Core subdomain — that's your competitive moat.
- NEVER allow business logic in API gateway / ESB / message middleware ("smart endpoints, dumb pipes").
- NEVER skip the ADR for decisions affecting scale, security, or deployability.
- NEVER use Event Sourcing for a Supporting / Generic subdomain — overkill, paid forever.
- ALWAYS define the architecture quantum's data ownership boundary first, then logic.
- ALWAYS reference other Aggregates by ID, never by direct object reference (Khononov).
- ALWAYS make architectural rules into fitness functions; manual review is leaky.

## Anti-patterns

### ❌ Big-Bang Rewrite

**Source:** Newman Ch. 3. **Why wrong:** "The only thing you're guaranteed of is a big bang." Years of investment, frozen feature delivery, market shift mid-rewrite.

**Fix:** Strangler Fig — incremental, one route at a time, old + new running side-by-side until migration completes.

### ❌ Distributed Monolith

**Source:** Newman Ch. 1 + Tornhill confirms via temporal coupling. **Why wrong:** Services that must deploy in lockstep — you have distributed-system pain without distributed-system benefits.

**Fix:** Restore independent deployability via stable interfaces, async communication, tolerant readers.

### ❌ Anemic Domain Model

**Source:** Khononov Ch. 6. **Why wrong:** Logic separated from data ("Manager" classes) leads to business logic leaking into application layer and duplication.

**Fix:** Encapsulate logic within Aggregates and Value Objects in Core subdomains.

### ❌ Database as Integration

**Source:** Newman Ch. 4. **Why wrong:** Multiple services read/write the same schema → tight coupling, can't change either side independently.

**Fix:** Encapsulate data per service, expose only via APIs.

### ❌ Generic Subdomain Invention

**Source:** Khononov Ch. 1. **Why wrong:** Building auth / payments / search / email from scratch wastes resources on a solved problem with zero competitive advantage.

**Fix:** Adopt off-the-shelf (Auth0 / better-auth / Stripe / Algolia / Resend). Use the freed time on Core.

### ❌ Entity Trap

**Source:** Richards/Ford Ch. 8. **Why wrong:** Modeling services 1:1 with database entities → "Manager" classes with too many responsibilities.

**Fix:** Identify components by workflows / actor actions, not by table.

### ❌ Architecture Sinkhole

**Source:** Richards/Ford. **Why wrong:** Requests traverse multiple layers performing no business logic — pure pass-through cost.

**Fix:** If >80% sinkhole, open layers or change style.

### ❌ Grains of Sand (Over-decomposition)

**Source:** Richards/Ford. **Why wrong:** Microservices too fine-grained → inter-service chatter overwhelms compute, latency explodes.

**Fix:** Consolidate by transaction boundary or high-choreography needs.

## Related Skills

### Sibling architecture skills
- `data-systems-craft` — data layer decisions (replication, partitioning, consistency) for chosen architecture
- `refactor-hotspots-craft` — when existing architecture needs targeted refactoring via behavioral analysis
- `refactoring` — read-only architecture analysis tooling (serena + gitnexus)
- `project-architecting` — workflow for greenfield project DAG (this skill provides the *what*, that one provides the *how*)

### Adjacent execution skills
- `coder-craft` — the implementation discipline applied within bounded contexts
- `cybersecurity-audit` — security review for architectural attack surfaces

## Citations from source

> Everything in software architecture is a trade-off.
> — *Richards & Ford, Ch. 1, p. 14*

> Never strive for the best architecture; aim for the least worst architecture.
> — *Richards & Ford, Ch. 4, p. 87*

> An architecture quantum is the smallest part of the system that runs independently.
> — *Richards & Ford, Ch. 7, p. 116*

> Microservices are independently releasable services that are modeled around a business domain.
> — *Newman, Ch. 1, p. 3*

> If you do a big-bang rewrite, the only thing you're guaranteed of is a big bang.
> — *Newman, Ch. 3, p. 72*

> A saga does not give us atomicity in ACID terms... What a saga gives us is enough information to reason about which state it's in.
> — *Newman, Ch. 6, p. 183*

> Bounded contexts are the consistency boundaries of ubiquitous languages.
> — *Khononov, Ch. 3, p. 43*

> A core subdomain is what a company does differently from its competitors.
> — *Khononov, Ch. 1, p. 8*

> It's developers' (mis)understanding, not domain experts' knowledge, that gets released in production.
> — *Khononov, Ch. 2, p. 25*

## Sources

- Sam Newman — *Building Microservices: Designing Fine-Grained Systems* (2nd ed., 2021)
- Vlad Khononov — *Learning Domain-Driven Design: Aligning Software Architecture and Business Strategy* (2021)
- Mark Richards & Neal Ford — *Fundamentals of Software Architecture* (2nd ed., 2025)
