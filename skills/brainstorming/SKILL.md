---
name: brainstorming
description: "Requirements gathering before any creative work. Use BEFORE starting a feature/component/fix — explores user intent, scope, success criteria via 1-3 targeted questions, NOT free-form discussion. Replaces superpowers:brainstorming. Use when: новая фича, новая идея, brainstorm, поговорим про X, давай придумаем."
---

# Brainstorming — Requirements Gathering

Surface what the user actually wants before writing anything. The goal is a 5-line shared understanding, NOT a free-form conversation.

## When to invoke

- User says "сделай X" where X is non-trivial (≥4 on the score heuristic)
- User says "давай придумаем", "хочу X", "что если..."
- Before invoking `writing-plans` / `feature-planner`
- Before any file creation that's not a direct user-dictated edit

**Skip for:** trivial single-file edits, bug fixes with clear repro, explicit "just do X" where X is unambiguous.

## The 3-question protocol

Ask **at most 3 questions**, all required to be answerable in one sentence:

1. **What's the success criterion?** ("How will we know it works?")
   - Concrete observable outcome, not a feeling
   - "Tests pass" is NOT a criterion — what behavior do the tests prove?

2. **What's NOT in scope?** ("What should I explicitly not change?")
   - Forces the user to think about blast radius
   - Catches "while you're at it" requests early

3. **What are the constraints?** ("Anything I should know about the existing code/data/users?")
   - Surfaces hidden invariants: "we have prod users", "this runs in a Lambda", "no breaking API changes"
   - Only ask if the answer would change the approach

**If the user's initial request answers any of these, skip that question.** Don't ask what you already know.

## Output of brainstorming

After 0-3 questions, produce a 5-line digest the user confirms:

```
Цель: <one sentence — what success looks like>
Не в скоупе: <what's intentionally untouched>
Ограничения: <hidden invariants surfaced>
Подход: <1 sentence on how I'll approach it>
Следующий шаг: <writing-plans | direct edit | further clarification>
```

Get user 👍 (or correction). Then proceed.

## Anti-patterns

- ❌ **Asking >3 questions.** Over-clarification is worse than a slightly-wrong assumption. After 3, just propose your interpretation and let the user correct.
- ❌ **Asking yes/no questions.** "Should I use X?" gives no info. Ask "Why use X vs Y?" or "What's the tradeoff you care about?"
- ❌ **Asking about implementation details.** "Should this be a hook or a service?" is for `writing-plans`, not brainstorming.
- ❌ **Generating multiple options when the user hasn't asked.** "I see 3 ways to do this..." — only present options if the user is explicitly choosing.
- ❌ **Brainstorming a 30-line edit.** Scope-match. Trivial work doesn't need scope gathering.

## When user gives vague signals

- «Сделай хорошо» — ask "Что для тебя 'хорошо' значит в этой задаче? — скорость? простота? фичи?"
- «Как-нибудь» — propose your default, name it explicitly, ask for veto
- «Не знаю» — name 2 concrete options with one-sentence tradeoffs, let user pick

## Hand-off

After confirmation, hand off cleanly:

- Score ≥7 → `feature-planner` subagent (orchestrator-workflow Phase 2)
- Score 4-6 → write your own 5-line brief, skip planner
- Score 0-3 → direct edit, no plan
