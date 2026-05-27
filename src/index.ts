import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { handleDiscussWithAntigravity, handleResetAntigravitySession } from "./tools/discuss.ts";
import { handleDiscussWithAntigravityAsyncStart, handleDiscussWithAntigravityAsyncStatus, handleDiscussWithAntigravityAsyncResult, handleDiscussWithAntigravityAsyncWait, handleDiscussWithAntigravityAsyncLog } from "./tools/discuss_async.ts";
import { handleRunDebateDeliberation, handleRunInteractiveDebate } from "./tools/debate.ts";
import { handleReviewCodeChanges, handleGetProgrammingAdvice } from "./tools/programming.ts";
import { handleConsultAntigravity } from "./tools/consult.ts";
import { handleGetDebateReceipt } from "./tools/receipt.ts";
import { logLifecycleEvent } from "./utils/observability.ts";
import { handleGetUsageStats } from "./tools/usage_stats.ts";
import { handleGetSkillCatalog } from "./tools/skill_catalog.ts";
import { sweepOrphanJobSessions, killSessions } from "./utils/session-gc.ts";
import { getActiveRunningJobIds, harvestCompletedOrphans } from "./utils/jobs.ts";

export { chunk } from "./utils/chunk.ts";
export { uniqueBy } from "./utils/uniqueBy.ts";
export { flatten } from "./utils/flatten.ts";
export { takeWhile } from "./utils/takeWhile.ts";
export { dropWhile } from "./utils/dropWhile.ts";
export { partition } from "./utils/partition.ts";


export const server = new Server(
  {
    name: "antigravity-bridge",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tools list
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "discuss_with_antigravity",
        description: "Synchronous chat with agy. Server remembers the active session unless reset_antigravity_session is called. systemPrompt or worker+skills configure persona at session start.",
        inputSchema: {
          type: "object",
          properties: {
            prompt:         { type: "string", description: "Message to send." },
            conversationId: { type: "string", description: "Force-switch / resume a specific session id." },
            systemPrompt:   { type: "string", description: "Custom system instructions (applied only at session start)." },
            worker:         { type: "string", description: "Worker role file under prompts/workers/ (e.g. 'worker-coder'). Prepended; {{skills}} filled from `skills`." },
            skills:         { type: "array", items: { type: "string" }, description: "Skill names injected into the worker's {{skills}} placeholder." },
          },
          required: ["prompt"],
        },
      },
      {
        name: "discuss_with_antigravity_async_start",
        description: "Start an async worker (agy CLI in tmux). Returns jobId immediately. PREFER task_id (+cwd+worker) — server reads the contract from <cwd>/.claude/orchestrator.db, worker self-fetches via `task export`. Keeps the orchestrator history ~30 tokens/dispatch instead of 5-7k. `prompt:` is the legacy ad-hoc path.",
        inputSchema: {
          type: "object",
          properties: {
            task_id:        { type: "string", description: "PREFERRED. Id of a task already inserted in <cwd>/.claude/orchestrator.db. Requires cwd. When set, prompt is ignored." },
            prompt:         { type: "string", description: "LEGACY inline body. Use only when task_id is absent." },
            conversationId: { type: "string", description: "Resume a specific historical session." },
            systemPrompt:   { type: "string", description: "Custom system instructions (only at session start)." },
            worker:         { type: "string", description: "Worker role file under prompts/workers/. Prepended to the dispatch prompt." },
            skills:         { type: "array", items: { type: "string" }, description: "Task-specific skills (stack/domain). Don't repeat role defaults." },
            cwd:            { type: "string", description: "Absolute project root. Required with task_id (server resolves <cwd>/.claude/orchestrator.db)." },
          },
          // task_id OR prompt — at least one (handler enforces).
          required: [],
        },
      },
      {
        name: "discuss_with_antigravity_async_status",
        description: "Peek one job: status (running|success|failed|killed) + 1-line progressSummary. NO logs by default. For batch awaits use discuss_with_antigravity_async_wait.",
        inputSchema: {
          type: "object",
          properties: {
            jobId:          { type: "string", description: "Job id from async_start." },
            includeLogTail: { type: "boolean", description: "Append last 25 transcript lines. Default false — debug only." },
          },
          required: ["jobId"],
        },
      },
      {
        name: "discuss_with_antigravity_async_result",
        description: "Worker's `result:` envelope (parsed from sidecar). Raw transcript stays server-side. Call only when status != running.",
        inputSchema: {
          type: "object",
          properties: {
            jobId: { type: "string", description: "Job id of a settled task." },
            full:  { type: "boolean", description: "Return the FULL raw transcript instead of just the envelope. Default false. Debug / recovery only — large." },
          },
          required: ["jobId"],
        },
      },
      {
        name: "discuss_with_antigravity_async_wait",
        description: "BLOCKING batch wait — the token-efficient way to await jobs. Holds the JSON-RPC response until the wait condition fires or timeoutMs elapses. Returns {jobs, finished[], running[], timedOut} — statuses only, no logs. Harvest finished via async_result; re-call with `running` if non-empty.",
        inputSchema: {
          type: "object",
          properties: {
            jobIds:    { type: "array", items: { type: "string" }, description: "In-flight batch to await." },
            waitMode:  { type: "string", enum: ["any", "all"], description: "'any' (default) → return on first settle (fan-in); 'all' → wait for every job." },
            timeoutMs: { type: "number", description: "Max block ms (default 180000, range 1000..300000). On timeout just re-call." },
          },
          required: ["jobIds"],
        },
      },
      {
        name: "discuss_with_antigravity_async_log",
        description: "Read-only tail of a job's transcript. Capped server-side (max 800 lines / 50 KB returned regardless of `lines`).",
        inputSchema: {
          type: "object",
          properties: {
            jobId: { type: "string", description: "Job id from async_start." },
            lines: { type: "number", description: "Trailing lines requested (positive int). Default 50. Server caps at 800." },
          },
          required: ["jobId"],
        },
      },
      {
        name: "reset_antigravity_session",
        description: "Clear in-memory session. Next discuss starts fresh. Optional systemPrompt configures the new session.",
        inputSchema: {
          type: "object",
          properties: {
            systemPrompt: { type: "string", description: "System instructions for the new session." },
          },
        },
      },
      {
        name: "run_debate_deliberation",
        description: "Multi-turn autonomous debate between AI personas (Optimist, Skeptic, Devil's Advocate). Synthesizes a final ADR.",
        inputSchema: {
          type: "object",
          properties: {
            topic:    { type: "string", description: "Architectural/code/design topic." },
            rounds:   { type: "number", description: "Rounds (clamped 3..10, default 5)." },
            language: { type: "string", enum: ["ru", "en"], description: "Debate language. Default 'ru'." },
          },
          required: ["topic"],
        },
      },
      {
        name: "run_interactive_debate",
        description: "Interactive debate where the user judges between Optimist/Skeptic/Agreer/Hater personas, culminating in an ADR.",
        inputSchema: {
          type: "object",
          properties: {
            topic:       { type: "string", description: "Topic. Required only when starting a new session." },
            userComment: { type: "string", description: "Judge's comment/feedback for the next round." },
            debateId:    { type: "string", description: "Session id to continue. Defaults to last active." },
            action:      { type: "string", enum: ["next", "finalize"], description: "'next' continues, 'finalize' synthesizes the ADR. Default 'next'." },
            language:    { type: "string", enum: ["ru", "en"], description: "Debate language. Auto-detected if omitted." },
          },
        },
      },
      {
        name: "review_code_changes",
        description: "One-shot code review of a diff/snippet: logic, quality, security, clean-code adherence (SOLID/DRY/KISS).",
        inputSchema: {
          type: "object",
          properties: {
            diff:    { type: "string", description: "git diff or code snippet to review." },
            context: { type: "string", description: "Additional project context / constraints." },
          },
          required: ["diff"],
        },
      },
      {
        name: "get_programming_advice",
        description: "Fast single-turn expert programming/architecture advice.",
        inputSchema: {
          type: "object",
          properties: {
            question:    { type: "string", description: "The programming or design question." },
            codeSnippet: { type: "string", description: "Related code, if any." },
            language:    { type: "string", description: "Language / stack (e.g. typescript, python, postgres)." },
          },
          required: ["question"],
        },
      },
      {
        name: "consult_antigravity",
        description: "Deep consultation with agy as principal advisor — architecture/product/AI/marketing/strategy. Returns structured PROSE analysis + recommendation, NOT YAML contracts. Uses live perplexity/tavily research for current facts; methodology skills (pass `skills`) ground the framing. For code USE the worker path; for debates use run_debate_deliberation.",
        inputSchema: {
          type: "object",
          properties: {
            prompt:         { type: "string", description: "What to assess/design/evaluate, optionally broken into points." },
            context:        { type: "string", description: "Extra material (spec, constraints, excerpts) prepended before the request." },
            skills:         { type: "array", items: { type: "string" }, description: "Methodology skills to ground in (architecture-craft, coder-craft, consultant-craft, etc.). Consultant reads each SKILL.md." },
            conversationId: { type: "string", description: "Resume a prior consult thread (multi-turn). Echoed back as consult_session_id." },
            cwd:            { type: "string", description: "Absolute path of the project to read. Defaults to server cwd." },
          },
          required: ["prompt"],
        },
      },
      {
        name: "get_debate_receipt",
        description: "Markdown receipt for a debate: role claims, evidence, rejected alternatives, touched files, security audit data.",
        inputSchema: {
          type: "object",
          properties: {
            debateId: { type: "string", description: "Debate session id. Defaults to last active." },
            language: { type: "string", enum: ["ru", "en"], description: "Receipt language. Default 'ru'." },
          },
        },
      },
      { name: "get_usage_stats", description: "All-time agy usage stats (jobs started/succeeded/failed, est. tokens) as a text table.", inputSchema: { type: "object", properties: {} } },
      {
        name: "get_skill_catalog",
        description: "List agy worker skills from prompts/skills-catalog.md. Optional filters: `name` (exact, wins) or `category` (case-insensitive substring of the bold header). Returns JSON {skills, total, warnings}.",
        inputSchema: {
          type: "object",
          properties: {
            name:     { type: "string", description: "Exact skill name (e.g. 'typescript'). Beats category." },
            category: { type: "string", description: "Case-insensitive substring of the catalog category header (e.g. 'testing', 'Backend & data')." },
          },
        },
      }
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params as any; // guardian: allow — dynamic MCP request params

  const metadata: any = { // guardian: allow — dynamic per-tool metadata payload
    tool: name,
  };
  if (args) {
    if (args.conversationId !== undefined) metadata.conversationId = args.conversationId;
    if (args.worker !== undefined) metadata.worker = args.worker;
    if (args.skills !== undefined) metadata.skills = args.skills;
    
    // Check for string arguments to compute their lengths
    const promptChars = args.prompt ? String(args.prompt).length :
                        args.diff ? String(args.diff).length :
                        args.question ? String(args.question).length :
                        args.topic ? String(args.topic).length :
                        undefined;
    if (promptChars !== undefined) {
      metadata.promptChars = promptChars;
    }
  }
  logLifecycleEvent("dispatch", metadata);

  if (name === "discuss_with_antigravity") {
    return handleDiscussWithAntigravity(args);
  }

  if (name === "discuss_with_antigravity_async_start") {
    return handleDiscussWithAntigravityAsyncStart(args);
  }

  if (name === "discuss_with_antigravity_async_status") {
    return handleDiscussWithAntigravityAsyncStatus(args);
  }

  if (name === "discuss_with_antigravity_async_result") {
    return handleDiscussWithAntigravityAsyncResult(args);
  }

  if (name === "discuss_with_antigravity_async_wait") {
    return handleDiscussWithAntigravityAsyncWait(args);
  }

  if (name === "discuss_with_antigravity_async_log") {
    return handleDiscussWithAntigravityAsyncLog(args);
  }

  if (name === "reset_antigravity_session") {
    return handleResetAntigravitySession(args);
  }

  if (name === "run_debate_deliberation") {
    return handleRunDebateDeliberation(args);
  }

  if (name === "run_interactive_debate") {
    return handleRunInteractiveDebate(args);
  }

  if (name === "review_code_changes") {
    return handleReviewCodeChanges(args);
  }

  if (name === "get_programming_advice") {
    return handleGetProgrammingAdvice(args);
  }

  if (name === "consult_antigravity") {
    return handleConsultAntigravity(args);
  }

  if (name === "get_debate_receipt") {
    return handleGetDebateReceipt(args);
  }

  if (name === "get_usage_stats") return handleGetUsageStats();

  if (name === "get_skill_catalog") return handleGetSkillCatalog(args);

  throw new Error(`Unknown tool: ${name}`);
});

export async function startServer() {
  // Record usage for jobs that finished while we were down, then sweep their
  // now-orphan tmux sessions. Best-effort: never block server boot.
  try {
    harvestCompletedOrphans();
    sweepOrphanJobSessions();
  } catch {
    // startup hygiene is best-effort
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Run server only if executed directly
if (import.meta.main) {
  const shutdown = () => {
    try {
      killSessions(getActiveRunningJobIds());
    } catch {
      // best-effort cleanup on the way out
    }
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  // A stdio MCP client that disconnects without a signal just closes our stdin.
  // The crash-monitor interval keeps the event loop alive, so without this the
  // process would linger as a zombie. Treat stdin close as a shutdown trigger.
  process.stdin.on("close", shutdown);
  await startServer();
}
