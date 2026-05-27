import { sessionState } from "../state.ts";
import { loadPrompt } from "../utils/prompts.ts";
import { startTmuxJob, getJobStatus, getJobDir, scanFatalMarker, loadJobMeta, tailLogLines } from "../utils/jobs.ts";
import { buildFooter } from "../utils/observability.ts";
import { formatWorkerResult, parseEnvelopeStrict } from "../utils/result-envelope.ts";
import { readTaskRow, buildDispatchPreamble } from "../utils/orchestrator-db.ts";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const TASK_ID_RE = /^[A-Za-z0-9._-]+$/;

export async function handleDiscussWithAntigravityAsyncStart(args: any) { // guardian: allow — dynamic MCP tool args, validated at use
  // BY-REFERENCE PATH: caller passed task_id → MCP reads contract from
  // <cwd>/.claude/orchestrator.db itself, synthesizes a minimal dispatch
  // preamble, and the worker self-fetches the full contract via `task export`.
  // Conversation history of the orchestrator shrinks from ~5-7k tokens per
  // dispatch (inline contract) to ~30 tokens (just the task_id reference).
  const taskIdArg = args?.task_id ? String(args.task_id) : null;
  const cwdArg = args?.cwd ? String(args.cwd) : null;

  let prompt = String(args?.prompt || "");

  if (taskIdArg) {
    if (!TASK_ID_RE.test(taskIdArg)) {
      return { content: [{ type: "text", text: `Error: invalid task_id (allowed: [A-Za-z0-9._-]): ${taskIdArg}` }], isError: true };
    }
    if (!cwdArg) {
      return { content: [{ type: "text", text: "Error: cwd is required when task_id is passed (must point at the project containing .claude/orchestrator.db)" }], isError: true };
    }
    // Resolve the contract: presence check + capture title/assignee/risk for the preamble.
    let row;
    try {
      row = readTaskRow(cwdArg, taskIdArg);
    } catch (e) {
      return { content: [{ type: "text", text: `Error reading task ${taskIdArg}: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
    }
    if (!row) {
      return { content: [{ type: "text", text: `Error: task ${taskIdArg} not found in ${cwdArg}/.claude/orchestrator.db — did the orchestrator `+"`task insert`"+` it yet?` }], isError: true };
    }
    // Synthesize the minimal preamble. The full role manual is still prepended
    // below by the existing `worker:` parameter path. The full contract stays
    // in the DB; the worker fetches it via `task export $TASK_ID`.
    const skillsCsvForPreamble = Array.isArray(args?.skills) ? args.skills.map(String).join(", ") : "";
    prompt = buildDispatchPreamble({
      taskId: row.id,
      cwd: cwdArg,
      skillsCsv: skillsCsvForPreamble,
      assigneeAgent: row.assignee_agent,
      title: row.title,
    });
    // Caller's `prompt:` (if any) is IGNORED when task_id is set — that's the
    // whole point of by-reference. A passed prompt would re-introduce the
    // bloat we're optimising away.
  }

  if (!prompt) {
    return { content: [{ type: "text", text: "Error: either task_id (preferred) or prompt is required" }], isError: true };
  }

  // Auto-detect task ID from the prompt content if conversationId is not explicitly specified
  let conversationIdToUse = args?.conversationId ? String(args.conversationId) : null;

  if (!conversationIdToUse && taskIdArg) {
    // Direct task_id wins — use it as the conversation key for resumability.
    conversationIdToUse = taskIdArg;
  }
  if (!conversationIdToUse) {
    const taskMatch = prompt.match(/(?:^|\n)(?:id|task|task_id):\s*(TASK-\d+)/i) || prompt.match(/(?:id|task|task_id):\s*(TASK-\d+)/i);
    if (taskMatch) {
      conversationIdToUse = taskMatch[1];
    }
  }

  // Fallback to activeConversationId from memory if still not resolved
  if (!conversationIdToUse) {
    conversationIdToUse = sessionState.activeConversationId;
  }

  const worker = args?.worker ? String(args.worker) : null;
  const skills = Array.isArray(args?.skills) ? args.skills.map(String) : [];
  const skillsStr = skills.join(", ");

  let promptToSend = prompt;

  if (worker) {
    try {
      const wtext = loadPrompt(`workers/${worker}.md`, { skills: skillsStr });
      promptToSend = `${wtext}\n\n---\n\n${prompt}`;
    } catch (e) {
      return { content: [{ type: "text", text: `Error: worker prompt not found: ${worker}` }], isError: true };
    }
  } else {
    let systemPromptText = String(args?.systemPrompt || sessionState.pendingSystemPrompt || "");
    if (skills.length > 0) {
      systemPromptText = systemPromptText
        ? systemPromptText + "\n\nЗагрузи эти скиллы перед работой (прочти SKILL.md каждого): " + skillsStr
        : "Загрузи эти скиллы перед работой (прочти SKILL.md каждого): " + skillsStr;
    }
    if (!conversationIdToUse) {
      if (systemPromptText) {
        promptToSend = `[СИСТЕМНЫЙ ПРОМПТ: ${systemPromptText}]\n\n${prompt}`;
      }
      // Clear pending configurations as they are now consumed
      sessionState.pendingSystemPrompt = null;
    }
  }

  // Generate unique jobId with readable task prefix if available
  let taskPrefix = "";
  if (conversationIdToUse && conversationIdToUse.match(/^TASK-\d+$/i)) {
    taskPrefix = `${conversationIdToUse.toLowerCase()}-`;
  } else {
    const taskMatch = prompt.match(/(?:^|\n)(?:id|task|task_id):\s*(TASK-\d+)/i) || prompt.match(/(?:id|task|task_id):\s*(TASK-\d+)/i);
    if (taskMatch) {
      taskPrefix = `${taskMatch[1].toLowerCase()}-`;
    }
  }
  const jobId = `${taskPrefix}job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // SIDECAR contract (worker dispatches only): tell the worker to write its result envelope to a
  // dedicated result.yaml beside the transcript. _result reads that file directly (strict — no
  // regex mining of the noisy stream). The ABSOLUTE path is injected so the worker's cwd doesn't
  // matter, and the orchestrator reads from the same server-side job dir.
  if (worker) {
    const resultPath = join(getJobDir(jobId), "result.yaml");
    promptToSend += `\n\n---\n[RESULT SIDECAR — REQUIRED] As your VERY LAST action, write your single \`result:\` YAML envelope to this EXACT file (use your file-write tool), in addition to printing it in your reply:\n${resultPath}\nWrite ONLY the YAML whose top-level key is \`result:\` — nothing else. The orchestrator reads this file to get your result; if it is missing, your run is treated as failed.`;
  }

  // Start job in tmux
  const meta = startTmuxJob(jobId, promptToSend, conversationIdToUse, args?.cwd ? String(args.cwd) : undefined);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ jobId, status: meta.status, error: meta.error || null }),
      }
    ],
    isError: meta.status === "failed",
  };
}

export async function handleDiscussWithAntigravityAsyncStatus(args: any) { // guardian: allow — dynamic MCP tool args, validated at use
  const jobId = String(args?.jobId || "");
  if (!jobId) {
    return { content: [{ type: "text", text: "Error: jobId is required" }], isError: true };
  }
  if (!/^[A-Za-z0-9._-]+$/.test(jobId)) {
    return { content: [{ type: "text", text: "Error: invalid jobId" }], isError: true };
  }

  let meta;
  try {
    meta = getJobStatus(jobId);
  } catch (e) {
    return { content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
  }

  // Default: a TINY payload. Repeated polling must NOT drag the raw transcript into the
  // orchestrator context — it accumulates permanently AND invalidates the prompt cache on
  // every poll (you re-pay the whole conversation each time). Keep a 1-line progressSummary
  // for the terminal board; the full 25-line tail is opt-in via includeLogTail. The blocking
  // `_wait` tool is the preferred way to await jobs — see handleDiscussWithAntigravityAsyncWait.
  const includeLogTail = args?.includeLogTail === true;
  let progressSummary: string | null = null;
  let logTail: string | null = null;
  if (meta.status === "running") {
    try {
      const outputFile = join(getJobDir(jobId), "output.txt");
      if (existsSync(outputFile)) {
        const content = readFileSync(outputFile, "utf-8");
        const lines = content.split(/\n/).filter((l) => l.trim().length > 0);
        const last = lines[lines.length - 1] || "";
        progressSummary = last ? last.slice(0, 80) : null;
        if (includeLogTail) logTail = lines.slice(-25).join("\n");
      }
    } catch (e) {
      // ignore soft-fail — status must still return
    }
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          jobId: meta.jobId,
          status: meta.status,
          durationSec: Math.round((Date.now() - meta.startTime) / 1000),
          progressSummary,
          ...(includeLogTail ? { logTail } : {}),
          error: meta.error || null,
        }),
      }
    ],
    isError: false,
  };
}

export async function handleDiscussWithAntigravityAsyncResult(args: any) { // guardian: allow — dynamic MCP tool args, validated at use
  const jobId = String(args?.jobId || "");
  if (!jobId) {
    return { content: [{ type: "text", text: "Error: jobId is required" }], isError: true };
  }
  if (!/^[A-Za-z0-9._-]+$/.test(jobId)) {
    return { content: [{ type: "text", text: "Error: invalid jobId" }], isError: true };
  }

  let meta;
  try {
    meta = getJobStatus(jobId);
  } catch (e) {
    return { content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
  }

  if (meta.status === "running") {
    return {
      content: [{ type: "text", text: `Error: Job ${jobId} is still running. Poll its status first.` }],
      isError: true,
    };
  }

  let responseText = "";
  const outputFile = join(getJobDir(jobId), "output.txt");
  try {
    if (existsSync(outputFile)) {
      responseText = readFileSync(outputFile, "utf-8");
    }
  } catch (e) {
    return { content: [{ type: "text", text: `Error reading output file: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
  }

  // Return ONLY the deterministic `result:` envelope, never the raw transcript. The orchestrator
  // (Opus) must not ingest the full agy output (it drains the weekly Claude limit and the
  // orchestrator never needs the file). full:true (or AGY_RESULT_FULL=1) returns the complete
  // transcript — for human debugging / orchestrator recovery escalation only.
  const full = args?.full === true || process.env.AGY_RESULT_FULL === "1";
  let payload: string;
  if (full) {
    payload = responseText;
  } else {
    // STRICT path first: read the worker's result.yaml sidecar and YAML.parse it (a clean file,
    // not the noisy transcript). Parses → use it. Present-but-invalid → keep the parser's error
    // as a diagnostic. Absent → quietly fall back to transcript extraction (older worker / crash).
    let sidecar: string | null = null;
    let sidecarError: string | null = null;
    try {
      const sidecarPath = join(getJobDir(jobId), "result.yaml");
      if (existsSync(sidecarPath)) {
        const raw = readFileSync(sidecarPath, "utf-8");
        if (raw.trim()) {
          const p = parseEnvelopeStrict(raw);
          if (p.ok) sidecar = p.envelope;
          else sidecarError = p.error;
        }
      }
    } catch (e) {
      sidecarError = e instanceof Error ? e.message : String(e);
    }
    if (sidecar) {
      payload = sidecar;
    } else {
      let crashMarker: string | null = null;
      try { crashMarker = scanFatalMarker(outputFile); } catch { crashMarker = null; }
      // A present-but-malformed sidecar is a clear (non-silent) failure signal — surface it.
      if (sidecarError && !crashMarker) crashMarker = `result.yaml rejected — ${sidecarError}`;
      payload = formatWorkerResult({ output: responseText, crashMarker });
    }
  }

  const durationMs = meta.durationMs || (Date.now() - meta.startTime);
  const footer = buildFooter(meta.filesBefore || [], meta.filesAfter || [], durationMs);
  const activeId = sessionState.activeConversationId || "new";

  const returnText = footer
    ? `${payload}\n\n<!-- active_session_id: ${activeId} -->\n${footer}`
    : `${payload}\n\n<!-- active_session_id: ${activeId} -->`;

  return {
    content: [
      {
        type: "text",
        text: returnText,
      }
    ],
    // Not an MCP error even when the job failed/was killed: payload is always a structured
    // result envelope (real or synthesized status: failed). The orchestrator gates retry/doctor
    // on result.status — surfacing isError:true here makes some clients halt the whole run.
    // Genuine infra faults (fs read failure) already returned isError:true above.
    isError: false,
  };
}

// Blocking, batch-aware wait. Collapses the orchestrator's O(N) poll loop into O(1) calls:
// the server holds the JSON-RPC response (checking job state every 1.5s) until the wait
// condition is met or a bounded timeout elapses, so the model stays idle instead of waking
// to poll dozens of times (each poll accumulates context AND invalidates the prompt cache).
// Batch + waitMode:"any" avoids head-of-line blocking when a fan-out batch is in flight.
export async function handleDiscussWithAntigravityAsyncWait(args: any) { // guardian: allow — dynamic MCP tool args, validated at use
  const jobIds: string[] = Array.isArray(args?.jobIds)
    ? args.jobIds.map((x: unknown) => String(x)).filter((s: string) => s.length > 0)
    : [];
  if (jobIds.length === 0) {
    return { content: [{ type: "text", text: "Error: jobIds (non-empty array) is required" }], isError: true };
  }
  for (const id of jobIds) {
    if (!/^[A-Za-z0-9._-]+$/.test(id)) {
      return { content: [{ type: "text", text: `Error: invalid jobId: ${id}` }], isError: true };
    }
  }
  const waitMode: "any" | "all" = args?.waitMode === "all" ? "all" : "any";
  // Bound the block so one call can never hang the client; the orchestrator just re-calls
  // _wait on the still-running jobs. A few calls replace dozens of polls.
  const timeoutMs = Math.min(Math.max(Number(args?.timeoutMs) || 180000, 1000), 300000);

  type JobState = { status: string; durationSec: number; error?: string };
  const collect = (): Record<string, JobState> => {
    const jobs: Record<string, JobState> = {};
    for (const id of jobIds) {
      try {
        const meta = getJobStatus(id);
        jobs[id] = {
          status: meta.status,
          durationSec: Math.round((Date.now() - meta.startTime) / 1000),
          ...(meta.error ? { error: meta.error } : {}),
        };
      } catch (e) {
        jobs[id] = { status: "unknown", durationSec: 0, error: e instanceof Error ? e.message : String(e) };
      }
    }
    return jobs;
  };
  const settled = (j: JobState): boolean => j.status !== "running";
  const reached = (jobs: Record<string, JobState>): boolean => {
    const list = Object.values(jobs);
    return waitMode === "any" ? list.some(settled) : list.every(settled);
  };

  const start = Date.now();
  let jobs = collect();
  while (!reached(jobs) && Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 1500));
    jobs = collect();
  }

  const finished = Object.keys(jobs).filter((id) => settled(jobs[id]));
  const running = Object.keys(jobs).filter((id) => !settled(jobs[id]));
  return {
    content: [
      {
        type: "text",
        // Compact: statuses only, NO logs/transcript. Harvest each `finished` job via _result;
        // re-call _wait on `running` if any remain. timedOut=true → call again to keep waiting.
        text: JSON.stringify({ jobs, finished, running, timedOut: !reached(jobs) }),
      },
    ],
    isError: false,
  };
}

export async function handleDiscussWithAntigravityAsyncLog(args: any) { // guardian: allow — dynamic MCP tool args, validated at use
  const jobId = String(args?.jobId || "");
  if (!jobId) {
    return { content: [{ type: "text", text: "Error: jobId is required" }], isError: true };
  }
  if (!/^[A-Za-z0-9._-]+$/.test(jobId)) {
    return { content: [{ type: "text", text: "Error: invalid jobId" }], isError: true };
  }

  const linesRaw = args?.lines;
  const n = linesRaw === undefined ? 50 : Number(linesRaw);
  if (!Number.isInteger(n) || n <= 0) {
    return { content: [{ type: "text", text: "Error: lines must be a positive integer" }], isError: true };
  }

  const meta = loadJobMeta(jobId);
  if (!meta) {
    return { content: [{ type: "text", text: `Error: Job not found: ${jobId}` }], isError: true };
  }

  const out = tailLogLines(jobId, n);
  return {
    content: [{ type: "text", text: JSON.stringify({ jobId, lines: out }) }],
    isError: false,
  };
}

