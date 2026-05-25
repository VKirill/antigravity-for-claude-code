# Clean Architecture — Robert C. Martin

Compact reference for preload into planner / architect agents. Covers dependency rules and layer boundaries for feature planning.

Source: Martin, *Clean Architecture: A Craftsman's Guide to Software Structure and Design* (2017).

## Central thesis

**Good architecture maximizes the number of decisions deferred.**

Decisions about the framework, database, web layer, and IO devices should be deferable — made late, changed cheaply. Decisions about domain (what the system *does*) should be central and stable.

The goal: code that's easy to develop, deploy, operate, and maintain — and where most "external" decisions can be reversed.

## SOLID — the five principles

1. **SRP** (Single Responsibility) — A module should have one reason to change. Different stakeholders = different modules.
2. **OCP** (Open-Closed) — Open for extension, closed for modification. Achieve via interfaces and polymorphism.
3. **LSP** (Liskov Substitution) — Subtypes must be substitutable for their base types without breaking callers.
4. **ISP** (Interface Segregation) — Clients shouldn't depend on methods they don't use. Many small interfaces > one big interface.
5. **DIP** (Dependency Inversion) — Depend on abstractions, not concretions. High-level policy doesn't depend on low-level detail.

**DIP is the most important for architecture.** The other four are local quality.

## Component principles

For grouping classes/modules into deployable units:

- **REP** (Reuse-Release Equivalence) — The unit of reuse is the unit of release. Version components.
- **CCP** (Common Closure) — Classes that change together belong in the same component.
- **CRP** (Common Reuse) — Classes used together belong in the same component. Don't force users to depend on things they don't use.

**Tension**: REP + CCP push to gather more into a component; CRP pushes to split.

## Dependency direction

> "Source code dependencies must point only inward, toward higher-level policies."

The diagram (concentric circles, inside-out):

1. **Entities** — Enterprise-wide business rules. Pure domain objects.
2. **Use cases** — Application-specific business rules. Orchestrate entities.
3. **Interface adapters** — Convert data between use-case format and external format (controllers, presenters, gateways).
4. **Frameworks & drivers** — Web, DB, UI, devices. The outer "details".

**Inner layers know nothing about outer layers.** Use cases don't import from the web framework. Entities don't import from anywhere.

How: dependency inversion. Use cases define interfaces; outer layers implement them.

## The Dependency Rule

**Source code dependencies can only point inward.** Names of outer-layer things never appear in inner-layer source.

In TypeScript / Python practice:
- `src/domain/` imports nothing from `src/infra/`
- `src/usecases/` imports from `src/domain/`, never from `src/web/` or `src/db/`
- `src/web/` and `src/db/` import from `src/domain/` and `src/usecases/` (via interfaces)

## Boundaries — where to draw them

Hard architectural lines exist where:
- **Volatility differs** — a frequently-changing thing should not be a dependency of a stable thing
- **Deployment differs** — components deployed separately need a clean boundary
- **Team / responsibility differs** — Conway's Law applies

Don't draw a boundary because "it might be useful later". Cost is real, benefit speculative.

## Frameworks are details

Don't marry the framework. The framework should be a tool you call into your application code — not the structure your code lives inside.

Practical:
- Domain logic in a directory with zero framework imports
- Routes / controllers thin: parse input, call use case, format output
- ORMs touch only the infrastructure layer; domain doesn't know SQL exists

## Database is a detail

The DB engine should be replaceable. In practice this rarely happens, but the discipline keeps the schema and queries from leaking into business logic.

The unit of business logic is *the use case*, not the table.

## Tests as a layer

Tests are part of the system. They live closest to what they test:
- Unit tests next to domain
- Integration tests at the boundaries
- End-to-end at the outer edge

Tests should be the most stable part of the codebase. If tests break for every code change, the tests are poorly placed.

## Screaming architecture

Your project's top-level directory should *scream* what the system does, not what framework it uses.

- ✅ `src/orders/`, `src/payments/`, `src/users/`
- ❌ `src/controllers/`, `src/models/`, `src/views/` (top-level)

The MVC-ish layout describes implementation, not purpose.

## Applying in planner agents

When the planner produces a SPEC, the file plan should reflect Clean Architecture:

- **Domain logic** in a clearly-named directory, free of framework imports
- **Use case files** orchestrate domain — small, no DB or HTTP code
- **Adapter files** at boundaries — controllers, repositories, gateways
- **Framework code** thin and in its own directory

For a feature spec: ask which layer each new file lives in. If everything is "in `src/lib/`", layering is unclear.

## Common violations in real codebases

- ORM models used as domain entities (couples DB schema to business logic)
- HTTP request/response objects passed deep into use cases
- Domain calls a service that returns a `Response` object — that's the adapter layer leaking
- Use cases that import the database driver directly
- "Service" classes that do everything (no SRP)

## Pragmatism

Martin is opinionated. The rules are pedagogical extremes. In practice:

- Tiny projects don't need 4 layers — 2 is fine (domain + adapter)
- Following the rules cargo-cult style produces bloated abstractions
- The point is **deferring decisions**, not **maximizing indirection**
- Indirection adds complexity; only use it where it buys flexibility you'll actually exercise

## Red flags

- Mixed concerns in a single file (HTTP parsing + DB query + business rule)
- Domain importing infrastructure (`from sqlalchemy import ...` in entity file)
- Tests that need real DB / real HTTP — boundaries are wrong
- Frameworks dictating directory structure (Rails-style)
- "Manager" / "Service" classes with no specific responsibility
- A change in one feature requires edits across many directories — layers wrong

## Applying in verifier agents

- `security-verifier` cares about boundary correctness — does user input pass through validation before reaching domain?
- `test-verifier` doesn't apply Martin directly but flags tests that touch too many layers (sign of bad boundaries)
- `payments-verifier` cares deeply: payment domain logic must not leak into HTTP / DB layers, idempotency lives in domain not framework

## Citation rule

Other files reference this with:
> "Apply Dependency Rule and layer separation from Martin (see [knowledge-base/martin-clean-architecture.md](../knowledge-base/martin-clean-architecture.md))."

Not by re-explaining inline.
