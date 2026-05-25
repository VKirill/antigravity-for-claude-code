# agent-evaluation skill — CHANGELOG

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and SemVer.

## [1.1.0] — 2026-05-16

### Added
- `references/eval-cases.md` — first routing eval suite for this skill: 10 positive (LLM agent eval suite, DeepEval/Promptfoo, reliability, LangSmith, red-teaming), 10 negative (classification ML, agent building, generic pytest, vendor dashboards), 5 edge (coding agent E2E, skill-evaluation overlap, monitoring lib choice, guardrails, capability benchmarks). User-voice phrasing (RU/EN mixed) with `Expected behavior` column citing target sub-files. `How to verify` section included.
- Wired the new file into SKILL.md API Reference table.

### Verified frameworks (Context7 cross-check during prior wave)
- DeepEval, Promptfoo, LangSmith, LangFuse, Arize Phoenix — all real, current as of May 2026
- Benchmarks: SWE-bench, AgentBench, HumanEval — all real

## [1.0.0] — 2026-05-15

### Added (initial generation)
- `SKILL.md` with Pattern 2 layout — behavioral testing, capability benchmarks, reliability metrics, LLM-as-judge, production monitoring, red-teaming, statistical design
- 8 reference files covering each capability area
- Source: `vibeship-spawner-skills` (Apache 2.0); refit to vechkasov skill format
- Frontmatter `risk: low-stakes` (testing/eval domain, no production blast radius)
