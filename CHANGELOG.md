# Changelog

All notable changes to this MCP server are documented here.
Все значимые изменения этого MCP-сервера документируются здесь.

## v1.4.0 — Security & robustness hardening + worker-prompt audit (2026-05-25)

### English

Post-verification hardening of the usage feature plus a full worker-prompt audit (done together with Antigravity).

**Security**
- All `tmux` calls now use `execFileSync(file, argv)` instead of a shell command string — `jobId` / `projectCwd` / session names can no longer inject shell metacharacters (closes a pre-existing command-injection vector). Dropped the redundant `cd` (cwd set via `tmux -c`).
- `async_status` / `async_result` reject any `jobId` that isn't `^[A-Za-z0-9._-]+$` before it reaches the filesystem (path-traversal guard).
- `worker-coder` / `worker-frontend` now explicitly forbid hardcoding secrets.

**Robustness**
- stdin close is now a shutdown trigger — a stdio client that disconnects without a signal no longer leaves a zombie process (the crash-monitor interval used to keep it alive).
- On startup the server records usage for jobs that finished while it was down, then sweeps their orphan tmux sessions.
- The sync `discuss_with_antigravity` tool now records usage too (`get_usage_stats` was async-only).
- Crash monitor skips finished-but-unpolled jobs (no false-kill when legitimate output contains a marker string).

**Worker-prompt audit (with Antigravity)**
- Replaced phantom skill references (`software-architecture`, `postgresql-optimization`, …) with real bundled skills.
- `worker-reviewer`: explicit Phase-7 exception so the final-review gate can review the full diff vs `origin/main`.
- `index.ts`: dropped a stale "role preset" mention (role presets were removed earlier).

`bun test`: **109 passing**.

### Русский

Укрепление фичи учёта после диагностики + полный аудит воркер-промтов (вместе с Antigravity).

**Безопасность**
- Все вызовы `tmux` теперь через `execFileSync(file, argv)`, а не строкой шелла — `jobId` / `projectCwd` / имена сессий больше не могут инжектить метасимволы (закрыт пред-существующий вектор command-injection). Убран лишний `cd` (cwd задаётся через `tmux -c`).
- `async_status` / `async_result` отвергают `jobId`, не подходящий под `^[A-Za-z0-9._-]+$`, до обращения к ФС (защита от traversal).
- `worker-coder` / `worker-frontend` явно запрещают хардкод секретов.

**Надёжность**
- Закрытие stdin теперь триггерит shutdown — stdio-клиент, отвалившийся без сигнала, больше не оставляет zombie-процесс (его держал интервал кран-монитора).
- При старте сервер учитывает usage джоб, завершившихся пока он был выключен, затем подчищает их осиротевшие tmux-сессии.
- Sync-инструмент `discuss_with_antigravity` теперь тоже пишет usage (`get_usage_stats` считал только async).
- Кран-монитор пропускает завершённые-но-неопрошенные джобы (нет ложного kill при строке-маркере в легитимном выводе).

**Аудит воркер-промтов (с Antigravity)**
- Фантомные ссылки на скиллы (`software-architecture`, `postgresql-optimization`, …) заменены реальными из набора.
- `worker-reviewer`: явное исключение для Phase 7, чтобы финальный гейт мог ревьюить полный дифф против `origin/main`.
- `index.ts`: убрано устаревшее упоминание "role preset".

`bun test`: **109 проходят**.

## v1.3.0 — agy usage accounting, tmux hygiene, bundled skill pack (2026-05-25)

### English

Built end-to-end by the parallel `dev-orchestrator-agy` team (fan-out workers + lead integration), then hardened.

**New feature — agy usage accounting + tmux session hygiene**
- `get_usage_stats` MCP tool: all-time counters (jobs started/succeeded/failed, prompt/output chars, agy seconds, estimated tokens) persisted to `.claude/agy-usage.json`.
- New utils: `token-estimate`, `usage-store`, `usage-format`, `session-gc`.
- Startup sweep of completed/orphan tmux job sessions; `SIGTERM`/`SIGINT` cleanup. Session names are allowlisted before any `tmux` shell call.

**Bundled programming skill pack (94 skills)** under `/skills` + `scripts/install-skills.sh` (installs into `~/.agents/skills`, the agy skills dir). Craft, languages, frontend, backend/data, integrations, testing. Marketing / SEO / design-creative / third-party skills excluded.

**Post-verification hardening**
- Crash monitor no longer false-kills a finished-but-unpolled job whose output happens to contain a marker string (skips jobs that already wrote `exit_code.txt`).
- Usage is now recorded on the exit-code-read failure path too; the best-effort telemetry catch blocks are documented (no silent swallow).
- Dropped the phantom `clean-code` skill reference from `worker-coder` defaults + catalog.

`bun test`: **109 passing**.

### Русский

Построено end-to-end параллельной командой `dev-orchestrator-agy` (воркеры веером + интеграция lead-агентом), затем укреплено.

**Новая фича — учёт использования agy + гигиена tmux-сессий**
- MCP-инструмент `get_usage_stats`: счётчики за всё время (джобы запущены/успешно/упало, объём промптов/ответов, секунды agy, оценка токенов) в `.claude/agy-usage.json`.
- Новые утилиты: `token-estimate`, `usage-store`, `usage-format`, `session-gc`.
- Уборка завершённых/осиротевших tmux-сессий при старте; очистка по `SIGTERM`/`SIGINT`. Имена сессий проходят whitelist перед любым shell-вызовом `tmux`.

**Набор программистских скиллов (94)** в `/skills` + `scripts/install-skills.sh` (ставит в `~/.agents/skills` — папку скиллов agy). Дисциплина кода, языки, фронтенд, бэкенд/данные, интеграции, тесты. Маркетинг / SEO / дизайн-креатив / сторонние — исключены.

**Укрепление после диагностики**
- Кран-монитор больше не убивает по ошибке завершённую-но-неопрошенную джобу, в выводе которой случайно есть строка-маркер (пропускает джобы с уже записанным `exit_code.txt`).
- Учёт теперь пишется и на пути сбоя чтения exit-code; best-effort telemetry-catch'и снабжены пояснениями (без молчаливого глотания).
- Убрана фантомная ссылка на скилл `clean-code` из дефолтов `worker-coder` и каталога.

`bun test`: **109 проходят**.

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
