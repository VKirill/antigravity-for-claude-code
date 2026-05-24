import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { handleDiscussWithAntigravity, handleResetAntigravitySession } from "./tools/discuss.ts";
import { handleRunDebateDeliberation, handleRunInteractiveDebate } from "./tools/debate.ts";
import { handleReviewCodeChanges, handleGetProgrammingAdvice } from "./tools/programming.ts";
import { handleGetDebateReceipt } from "./tools/receipt.ts";
import { logLifecycleEvent } from "./utils/observability.ts";

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
        description: "Engage in a multi-turn deliberative debate or discussion session with Antigravity (agy). The server automatically remembers the active conversation history unless reset. You can pass systemPrompt or worker/skills parameters to configure the persona/worker instructions when starting a new discussion thread or executing worker tasks.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "The prompt/message/question to send to Antigravity.",
            },
            conversationId: {
              type: "string",
              description: "Optional conversation ID to force-switch or resume a specific historical debate thread.",
            },
            systemPrompt: {
              type: "string",
              description: "Optional custom system instructions to initialize the conversation with (only applied when starting a new session).",
            },
            worker: {
              type: "string",
              description: "Optional worker instruction file under prompts/workers/ (e.g. 'worker-coder'). Its {{skills}} placeholder is filled from `skills`. When set, the full instruction is prepended and the role preset is skipped.",
            },
            skills: {
              type: "array",
              items: {
                type: "string",
              },
              description: "Skills the worker must load (read each SKILL.md), injected into the worker instruction's {{skills}} placeholder.",
            },
          },
          required: ["prompt"],
        },
      },
      {
        name: "reset_antigravity_session",
        description: "Clears the active discussion session history in memory. The next discussion call will start a fresh, new conversation context. Optionally configures a systemPrompt for the new session in advance.",
        inputSchema: {
          type: "object",
          properties: {
            systemPrompt: {
              type: "string",
              description: "Optional custom system instructions to initialize the new session with.",
            },
          },
        },
      },
      {
        name: "run_debate_deliberation",
        description: "Runs a multi-turn autonomous debate between specialized AI personas (Optimist, Skeptic, Devil's Advocate) to review and refine a solution, ending with a synthesized architectural proposal (ADR).",
        inputSchema: {
          type: "object",
          properties: {
            topic: {
              type: "string",
              description: "The architectural, code, or design topic to debate.",
            },
            rounds: {
              type: "number",
              description: "Number of debate rounds (turns) to run. Clamped between 3 and 10. Default: 5.",
            },
            language: {
              type: "string",
              description: "The language for the debate. Supported: 'ru', 'en'. Default: 'ru'.",
              enum: ["ru", "en"],
            },
          },
          required: ["topic"],
        },
      },
      {
        name: "run_interactive_debate",
        description: "Runs an interactive multi-turn debate session where the user acts as a Judge/Architect, guiding the AI personas (Optimist, Skeptic, Agreer, Hater) with comments, culminating in a structured ADR.",
        inputSchema: {
          type: "object",
          properties: {
            topic: {
              type: "string",
              description: "The topic of the debate. Required only when starting a new debate session.",
            },
            userComment: {
              type: "string",
              description: "The comment or feedback from the user (Judge/Architect) to guide the debate.",
            },
            debateId: {
              type: "string",
              description: "The ID of the active debate session to continue. If not specified, uses the last active session in memory.",
            },
            action: {
              type: "string",
              description: "Action to perform: 'next' (continue the debate with a new round) or 'finalize' (conclude the debate and synthesize the final ADR). Default is 'next'.",
              enum: ["next", "finalize"],
            },
            language: {
              type: "string",
              description: "The language for the debate. Supported: 'ru', 'en'. Defaults to auto-detection based on the topic/comment.",
              enum: ["ru", "en"],
            },
          },
        },
      },
      {
        name: "review_code_changes",
        description: "Analyzes a git diff or code snippet for logic errors, code quality, security vulnerabilities, and adherence to clean code principles (SOLID, DRY, KISS). Runs in a single non-continuous session.",
        inputSchema: {
          type: "object",
          properties: {
            diff: {
              type: "string",
              description: "The git diff or code snippet to review.",
            },
            context: {
              type: "string",
              description: "Optional additional context about the changes or specific project requirements.",
            },
          },
          required: ["diff"],
        },
      },
      {
        name: "get_programming_advice",
        description: "Provides fast, focused, single-turn expert programming or architectural advice for a specific problem or code snippet. Runs in a single non-continuous session.",
        inputSchema: {
          type: "object",
          properties: {
            question: {
              type: "string",
              description: "The programming or design question to ask.",
            },
            codeSnippet: {
              type: "string",
              description: "Optional block of code related to the question.",
            },
            language: {
              type: "string",
              description: "Optional programming language or technology stack (e.g., typescript, python, postgres).",
            },
          },
          required: ["question"],
        },
      },
      {
        name: "get_debate_receipt",
        description: "Generates a structured Debate Receipt (Markdown report) containing role claims, evidence, rejected alternatives, touched files, and security hooks audit data for a given debate session ID.",
        inputSchema: {
          type: "object",
          properties: {
            debateId: {
              type: "string",
              description: "The unique ID of the debate session to generate a receipt for. If not provided, uses the last active session in memory.",
            },
            language: {
              type: "string",
              description: "The language for the receipt. Supported: 'ru', 'en'. Default: 'ru'.",
              enum: ["ru", "en"],
            },
          },
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params as any;

  const metadata: any = {
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

  if (name === "get_debate_receipt") {
    return handleGetDebateReceipt(args);
  }

  throw new Error(`Unknown tool: ${name}`);
});

export async function startServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Run server only if executed directly
if (import.meta.main) {
  await startServer();
}
