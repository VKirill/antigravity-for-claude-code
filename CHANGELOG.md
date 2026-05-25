# Changelog

All notable changes to this MCP server are documented here.
Все значимые изменения этого MCP-сервера документируются здесь.

## v1.2.0 — Parallel-safe dispatch & parallel orchestrator (2026-05-25)

### English

Makes the async job engine safe to run **many `agy` jobs in parallel**, and ships an
updated orchestrator agent that actually uses that parallelism.

**MCP server — concurrency fixes (`src/utils/jobs.ts`)**

- **Per-job crash detection.** The crash monitor now scans each job's own `output.txt`
  (new pure `scanFatalMarker()`) instead of the shared newest `~/.gemini/.../cli-*.log`.
  Previously, when several jobs ran at once, one crashed job could trigger the kill of a
  *healthy* sibling (the monitor fired on whichever job the loop was iterating).
  Detection is now fully isolated per job.
- **Per-job conversation identity.** Removed the global `sessionState.activeConversationId`
  write on job success (it was derived from the newest `.pb` by mtime, so near-simultaneous
  completions could attribute one job's conversation to another and leak context). The
  per-job `meta.conversationId` is now the single source of truth.
- Internal: `catch (e: any)` → `unknown` with narrowing; added `src/jobs.test.ts`.
  Full suite: **90 tests passing**.

**Bundled orchestrator agent**

- `agents/dev-orchestrator-agy.md` — Phase 4 rewritten from sequential to
  **parallel fan-out / fan-in** over the async MCP (`async_start` → `async_status` → `async_result`).
- Guardrails: `MAX_PARALLEL=3`, **disjoint `files_to_touch`** per batch, `risk_class: high`
  runs solo, the orchestrator **serializes all commits** (workers never commit — avoids
  `.git/index.lock` races), plus a live progress board.
- `skills/orchestrator-workflow/SKILL.md` — notes that the agy agent owns its parallel loop
  (the sequential pseudocode is the native-orchestrator reference only).

**Verified:** deterministic process-level smoke (a crashed job no longer kills siblings) and
a live 3-job parallel run (jobs concurrent, conversations isolated, no false kills).

### Русский

Делает асинхронный движок джоб безопасным для запуска **многих `agy`-джоб параллельно**
и обновляет агент-оркестратор, который этот параллелизм использует.

**MCP-сервер — фиксы конкурентности (`src/utils/jobs.ts`)**

- **Детекция падений — по каждой джобе отдельно.** Кран-монитор теперь сканирует
  собственный `output.txt` каждой джобы (новая чистая функция `scanFatalMarker()`), а не
  общий свежий `~/.gemini/.../cli-*.log`. Раньше при параллельной работе одна упавшая
  джоба могла спровоцировать убийство *здоровой* соседней (монитор срабатывал на той
  джобе, по которой шёл цикл). Теперь детекция полностью изолирована.
- **Идентичность беседы — по каждой джобе.** Убрана глобальная запись
  `sessionState.activeConversationId` при успехе джобы (бралась как самый свежий `.pb`
  по mtime — при почти одновременном завершении могла приписать одной джобе беседу
  другой и утечь контекст). Источник истины — `meta.conversationId` на джобу.
- Внутреннее: `catch (e: any)` → `unknown` с нарроингом; добавлен `src/jobs.test.ts`.
  Весь набор: **90 тестов проходят**.

**Встроенный агент-оркестратор**

- `agents/dev-orchestrator-agy.md` — Phase 4 переписана с последовательной на
  **параллельную fan-out / fan-in** поверх async MCP (`async_start` → `async_status` → `async_result`).
- Guardrails: `MAX_PARALLEL=3`, **непересекающиеся `files_to_touch`** в батче,
  `risk_class: high` идёт solo, оркестратор **сериализует все коммиты** (воркеры не
  коммитят — нет гонки за `.git/index.lock`), плюс живая доска прогресса.
- `skills/orchestrator-workflow/SKILL.md` — помечено, что agy-агент владеет своим
  параллельным циклом (последовательный псевдокод — только для нативного оркестратора).

**Проверено:** детерминированный process-level smoke (упавшая джоба больше не убивает
соседей) и живой прогон 3 джоб параллельно (одновременность, изоляция бесед, без ложных
убийств).
