# Antigravity Prompt Templates

This folder contains all persona, role, tool, and debate round system prompts extracted from the codebase to allow easy customization and byte-for-byte fidelity testing.

## Placeholder Convention

Dynamic variables in the prompts are enclosed in double curly braces, such as `{{topic}}` for the debate topic, `{{comment}}` for user/judge comments, and `{{debateId}}` for the active conversation or debate session identifier.

## Round Prompt Mapping

Autonomous flows use the base filename, whereas interactive flows use the `.interactive.md` suffix if their prompt template differs:

- **Optimist**: `rounds/ru/optimist.md` / `rounds/en/optimist.md` (shared between autonomous and interactive flows)
- **Skeptic**: `rounds/ru/skeptic.md` / `rounds/en/skeptic.md` (shared between autonomous and interactive flows)
- **Agreer**:
  - Autonomous: `rounds/ru/agreer.md` / `rounds/en/agreer.md`
  - Interactive: `rounds/ru/agreer.interactive.md` / `rounds/en/agreer.interactive.md`
- **Hater**:
  - Autonomous: `rounds/ru/hater.md` / `rounds/en/hater.md`
  - Interactive: `rounds/ru/hater.interactive.md` / `rounds/en/hater.interactive.md`
- **Optimist Defend**: `rounds/ru/optimist_defend.md` / `rounds/en/optimist_defend.md` (autonomous only)
- **Skeptic Review**: `rounds/ru/skeptic_review.md` / `rounds/en/skeptic_review.md` (autonomous only)
- **Hater Persist**: `rounds/ru/hater_persist.md` / `rounds/en/hater_persist.md` (autonomous only)
- **Synthesizer**:
  - Autonomous: `rounds/ru/synthesizer.md` / `rounds/en/synthesizer.md`
  - Interactive: `rounds/ru/synthesizer.interactive.md` / `rounds/en/synthesizer.interactive.md`
