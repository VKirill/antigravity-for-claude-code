import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { spawn } from "child_process";
import { readdirSync, statSync } from "fs";
import { join } from "path";

// Active conversation state kept in memory
export let activeConversationId: string | null = null;
export let pendingSystemPrompt: string | null = null;
export let pendingRole: string | null = null;

// Helper to reset state between tests
export function resetTestState() {
  activeConversationId = null;
  pendingSystemPrompt = null;
  pendingRole = null;
}

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

// Preset role instructions
export const ROLE_PRESETS: Record<string, string> = {
  designer: "Ты — опытный UI/UX дизайнер и эксперт по интерфейсам. Твоя цель — проектировать красивые, современные, премиальные и удобные интерфейсы. Используй лучшие практики дизайна (сетки, визуальный ритм, цветовые схемы OKLCH, микро-анимации). Давай развернутые советы по улучшению UX и эстетики.",
  copywriter: "Ты — профессиональный технический копирайтер и редактор. Твоя цель — писать простой, понятный, убедительный и живой текст. Избегай канцеляризмов, лишней воды и роботизированного тона. Пиши лаконично, структурированно и с заботой о читателе.",
  programmer: "Ты — Senior Software Engineer. Твоя цель — писать простой, чистый, эффективный и безопасный код. Следуй принципам SOLID, DRY и KISS. Избегай преждевременной оптимизации и ненужных абстракций. Тщательно продумывай граничные случаи и валидацию.",
  architect: "Ты — Software Architect. Твоя цель — проектировать масштабируемые, отказоустойчивые и простые в поддержке системы. Оценивай архитектурные компромиссы (trade-offs), выбирай подходящие паттерны проектирования и стек технологий.",
};

// Debate-specific persona descriptions
export const DEBATE_PERSONAS: Record<string, string> = {
  optimist: "Ты — Оптимист (Инженер-Разработчик). Твоя цель — предлагать креативные и эстетичные технические решения. Активно используй современные практики, премиальный дизайн (OKLCH, сетки, анимации) и пиши простой, рабочий код. Твой тон: энтузиаст, готовый к реализации.",
  skeptic: "Ты — Скептик (Критик логики). Твоя цель — находить слабые места в предложении, сомневаться в логике, подвергать сомнению архитектурные решения, задавать неудобные каверзные вопросы и указывать на избыточную сложность. Твой тон: конструктивный критик, постоянно задающий вопросы.",
  agreer: "Ты — Соглашатель (Поддакивающий). Твоя цель — во всем соглашаться с Оптимистом, хвалить простоту предложенного решения, предлагать срезать углы ради скорости разработки, игнорировать сложные проверки и одобрять самые очевидные подходы. Твой тон: дружелюбный, угодливый, ищущий легкие пути.",
  hater: "Ты — Хейтер (Пессимист). Твоя цель — не верить в затею и искренне желать, чтобы проект провалился. Доказывай, что идея бессмысленна, бесполезна, устарела, не принесет ценности и отнимет кучу времени. Накидывай самые мрачные жизненные вопросы, примеры провалов аналогичных систем и утверждай, что всё рухнет. Твой тон: вечно недовольный, язвительный, циничный.",
  synthesizer: "Ты — Синтезатор (Главный Архитектор). Твоя цель — взвесить все мнения участников дебатов, сопоставить плюсы и минусы, найти компромиссы и сформировать итоговый структурированный документ Architecture Decision Record (ADR) или RFC на русском языке. Твой тон: авторитетный, взвешенный и конструктивный.",
};

// Register tools list
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "discuss_with_antigravity",
        description: "Engage in a multi-turn deliberative debate or discussion session with Antigravity (agy). The server automatically remembers the active conversation history unless reset. You can pass systemPrompt/role parameters to configure the persona when starting a new discussion thread.",
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
            role: {
              type: "string",
              description: "Optional preset role for Antigravity: 'designer', 'copywriter', 'programmer', 'architect' (only applied when starting a new session).",
              enum: ["designer", "copywriter", "programmer", "architect"],
            },
          },
          required: ["prompt"],
        },
      },
      {
        name: "reset_antigravity_session",
        description: "Clears the active discussion session history in memory. The next discussion call will start a fresh, new conversation context. Optionally configures a systemPrompt or role for the new session in advance.",
        inputSchema: {
          type: "object",
          properties: {
            systemPrompt: {
              type: "string",
              description: "Optional custom system instructions to initialize the new session with.",
            },
            role: {
              type: "string",
              description: "Optional preset role for the new session: 'designer', 'copywriter', 'programmer', 'architect'.",
              enum: ["designer", "copywriter", "programmer", "architect"],
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
    ],
  };
});

// Helper to run agy CLI command, passing prompt via stdin and inheriting environment
export function runAgy(args: string[], prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const homeDir = process.env.HOME || "/home/ubuntu/.gemini_mcp";
    const child = spawn("/home/ubuntu/.local/bin/agy", args, {
      env: {
        ...process.env,
        HOME: homeDir,
        PATH: process.env.PATH || "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
      }
    });
    let stdout = "";
    let stderr = "";

    // Write prompt to stdin and close it
    child.stdin.write(prompt);
    child.stdin.end();

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`agy process exited with code ${code}. Stderr: ${stderr.trim()}`));
      }
    });
  });
}

export function getNewestConversationId(): string | null {
  const homeDir = process.env.HOME || "/home/ubuntu/.gemini_mcp";
  const dir = join(homeDir, ".gemini/antigravity-cli/conversations");
  try {
    const files = readdirSync(dir)
      .filter(file => file.endsWith(".pb"))
      .map(file => ({
        name: file,
        time: statSync(join(dir, file)).mtime.getTime(),
      }));

    if (files.length === 0) return null;

    files.sort((a, b) => b.time - a.time);
    return files[0].name.replace(/\.pb$/, "");
  } catch (err) {
    return null;
  }
}

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "discuss_with_antigravity") {
    const prompt = String(args?.prompt || "");
    
    // Auto-detect task ID from the prompt content if conversationId is not explicitly specified
    let conversationIdToUse = args?.conversationId ? String(args.conversationId) : null;
    
    if (!conversationIdToUse) {
      const taskMatch = prompt.match(/(?:^|\n)(?:id|task|task_id):\s*(TASK-\d+)/i) || prompt.match(/(?:id|task|task_id):\s*(TASK-\d+)/i);
      if (taskMatch) {
        conversationIdToUse = taskMatch[1];
      }
    }
    
    // Fallback to activeConversationId from memory if still not resolved
    if (!conversationIdToUse) {
      conversationIdToUse = activeConversationId;
    }

    let promptToSend = prompt;

    // If it's a new conversation, inject system instructions/roles
    if (!conversationIdToUse) {
      const selectedRole = args?.role ? String(args.role) : pendingRole;
      const selectedSystemPrompt = args?.systemPrompt ? String(args.systemPrompt) : pendingSystemPrompt;

      let systemPromptText = "";
      if (selectedRole && ROLE_PRESETS[selectedRole.toLowerCase()]) {
        systemPromptText = ROLE_PRESETS[selectedRole.toLowerCase()];
      }

      if (selectedSystemPrompt) {
        systemPromptText = systemPromptText
          ? `${systemPromptText}\n\nДополнительные системные инструкции:\n${selectedSystemPrompt}`
          : selectedSystemPrompt;
      }

      if (systemPromptText) {
        promptToSend = `[СИСТЕМНЫЙ ПРОМПТ ДЛЯ РОЛИ: ${systemPromptText}]\n\n${prompt}`;
      }

      // Clear pending configurations as they are now consumed
      pendingRole = null;
      pendingSystemPrompt = null;
    }

    const cmdArgs = ["--dangerously-skip-permissions", "--print"];
    if (conversationIdToUse) {
      cmdArgs.push("--conversation", conversationIdToUse);
    } else {
      cmdArgs.push("--continue=false");
    }

    try {
      const responseText = await runAgy(cmdArgs, promptToSend);
      
      // If we didn't have an ID, grab the newly created one and store it
      if (conversationIdToUse) {
        activeConversationId = conversationIdToUse;
      } else {
        activeConversationId = getNewestConversationId();
      }

      const currentId = activeConversationId || "unknown";

      return {
        content: [
          {
            type: "text",
            text: `${responseText}\n\n<!-- active_session_id: ${currentId} -->`,
          }
        ],
      };
    } catch (err: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error debating with Antigravity: ${err.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  if (name === "reset_antigravity_session") {
    activeConversationId = null;
    pendingSystemPrompt = args?.systemPrompt ? String(args.systemPrompt) : null;
    pendingRole = args?.role ? String(args.role) : null;

    let confirmationMsg = "Antigravity discussion session has been reset. The next call to discuss_with_antigravity will start a brand new conversation.";
    if (pendingRole || pendingSystemPrompt) {
      confirmationMsg += ` Pre-configured role: ${pendingRole || "custom"}, system prompt: ${pendingSystemPrompt || "none"}.`;
    }

    return {
      content: [
        {
          type: "text",
          text: confirmationMsg,
        },
      ],
    };
  }

  if (name === "run_debate_deliberation") {
    const topic = String(args?.topic || "");
    const roundsInput = args?.rounds ? Number(args.rounds) : 5;
    const rounds = Math.max(3, Math.min(10, roundsInput)); // clamp rounds between 3 and 10

    const transcript: { persona: string; text: string }[] = [];
    let debateConversationId: string | null = null;

    try {
      // Round 1: Optimist initial proposal
      const r1Prompt = `[СИСТЕМНЫЙ ПРОМПТ ДЛЯ РОЛИ: ${DEBATE_PERSONAS.optimist}]\n\nТема для дебатов: ${topic}\n\nПредложи начальную архитектуру или техническое решение.`;
      
      const r1Output = await runAgy(["--dangerously-skip-permissions", "--print", "--continue=false"], r1Prompt);
      debateConversationId = getNewestConversationId();
      if (!debateConversationId) {
        throw new Error("Failed to initialize debate conversation ID");
      }
      
      transcript.push({ persona: "optimist", text: r1Output });

      // Middle Rounds
      for (let r = 2; r < rounds; r++) {
        let currentPersona = "";
        let instructions = "";

        if (r === 2) {
          currentPersona = "skeptic";
          instructions = `[СИСТЕМНЫЙ ПРОМПТ ДЛЯ РОЛИ: ${DEBATE_PERSONAS.skeptic}]\n\nИзучи предыдущее предложение Оптимиста. Задай неудобные каверзные вопросы к предложенному решению, укажи на логические нестыковки.`;
        } else if (r === 3) {
          currentPersona = "agreer";
          instructions = `[СИСТЕМНЫЙ ПРОМПТ ДЛЯ РОЛИ: ${DEBATE_PERSONAS.agreer}]\n\nИзучи предложение Оптимиста и замечания Скептика. Поддержи Оптимиста, похвали простоту, предложи срезать углы ради быстрой разработки и обойтись без сложных проверок.`;
        } else if (r === 4) {
          currentPersona = "hater";
          instructions = `[СИСТЕМНЫЙ ПРОМПТ ДЛЯ РОЛИ: ${DEBATE_PERSONAS.hater}]\n\nИзучи ход дебатов. Выскажись резко против этой затеи: объясни, почему проект обречен на провал, приведи примеры аналогичных неудач из жизни, накинь токсичных сомнений и утверждай, что всё рухнет.`;
        } else {
          // For round 5 and onward, alternate
          if (r % 2 === 1) {
            currentPersona = "optimist";
            instructions = `[СИСТЕМНЫЙ ПРОМПТ ДЛЯ РОЛИ: ${DEBATE_PERSONAS.optimist}]\n\nИзучи все замечания (критику Скептика, предложения Соглашателя и хейт Пессимиста). Защити проект и предложи доработанное сбалансированное решение, отвечающее на все выпады.`;
          } else {
            // Alternate critics: skeptic or hater
            if (r % 4 === 0) {
              currentPersona = "skeptic";
              instructions = `[СИСТЕМНЫЙ ПРОМПТ ДЛЯ РОЛИ: ${DEBATE_PERSONAS.skeptic}]\n\nИзучи доработанное предложение Оптимиста. Напиши краткую рецензию: остались ли логические нестыковки? Решены ли каверзные вопросы?`;
            } else {
              currentPersona = "hater";
              instructions = `[СИСТЕМНЫЙ ПРОМПТ ДЛЯ РОЛИ: ${DEBATE_PERSONAS.hater}]\n\nИзучи доработанное предложение Оптимиста. Все еще ли проект обречен на провал? Найди новые причины для токсичного пессимизма.`;
            }
          }
        }

        const reply = await runAgy(["--dangerously-skip-permissions", "--print", "--conversation", debateConversationId], instructions);
        transcript.push({ persona: currentPersona, text: reply });
      }

      // Final Round: Synthesizer
      const finalPrompt = `[СИСТЕМНЫЙ ПРОМПТ ДЛЯ РОЛИ: ${DEBATE_PERSONAS.synthesizer}]\n\nИзучи весь ход дебатов. Составь итоговый структурированный документ Architecture Decision Record (ADR) на русском языке. Он должен включать: тему, контекст обсуждения, итоговое принятое решение, компромиссы (trade-offs) и список рисков с их минимизацией.`;
      
      const synthesisOutput = await runAgy(["--dangerously-skip-permissions", "--print", "--conversation", debateConversationId], finalPrompt);
      transcript.push({ persona: "synthesizer", text: synthesisOutput });

      // Construct output markdown
      let outputMarkdown = `# Результаты дебатов: ${topic}\n\n`;
      outputMarkdown += `${synthesisOutput}\n\n`;
      outputMarkdown += `## Стенограмма дебатов (Transcript)\n`;
      outputMarkdown += `<details>\n<summary>Посмотреть ход обсуждения (${rounds} раундов)</summary>\n\n`;

      for (let i = 0; i < transcript.length; i++) {
        const entry = transcript[i];
        const roleName = entry.persona.toUpperCase();
        outputMarkdown += `### Раунд ${i + 1}: [${roleName}]\n${entry.text}\n\n---\n\n`;
      }

      outputMarkdown += `</details>\n\n<!-- active_session_id: ${debateConversationId} -->`;

      // Set active session in memory to the debate session
      activeConversationId = debateConversationId;

      return {
        content: [
          {
            type: "text",
            text: outputMarkdown,
          }
        ]
      };
    } catch (err: any) {
      return {
        content: [
          {
            type: "text",
            text: `Ошибка во время дебатов: ${err.message}`,
          }
        ],
        isError: true
      };
    }
  }

  if (name === "run_interactive_debate") {
    const topic = args?.topic ? String(args.topic) : undefined;
    const userComment = args?.userComment ? String(args.userComment) : undefined;
    const action = args?.action ? String(args.action) : "next";
    
    let debateConversationId = args?.debateId ? String(args.debateId) : activeConversationId;

    try {
      if (action === "finalize") {
        if (!debateConversationId) {
          throw new Error("No active debate session found. Please specify debateId or start a new debate with a topic.");
        }

        // Run Synthesizer
        let finalPrompt = "";
        if (userComment) {
          finalPrompt = `[КОММЕНТАРИЙ СУДЬИ/ПОЛЬЗОВАТЕЛЯ]:\n${userComment}\n\n`;
        }
        finalPrompt += `[СИСТЕМНЫЙ ПРОМПТ ДЛЯ РОЛИ: ${DEBATE_PERSONAS.synthesizer}]\n\nИзучи весь ход дебатов, включая комментарии Судьи. Составь итоговый структурированный документ Architecture Decision Record (ADR) на русском языке. Он должен включать: тему, контекст обсуждения, итоговое принятое решение (с учетом финального мнения Судьи), компромиссы (trade-offs) и список рисков с их минимизацией.`;

        const synthesisOutput = await runAgy(
          ["--dangerously-skip-permissions", "--print", "--conversation", debateConversationId],
          finalPrompt
        );

        let outputMarkdown = `# Финализация дебатов (Сессия: ${debateConversationId})\n\n`;
        outputMarkdown += `${synthesisOutput}\n\n`;
        outputMarkdown += `<!-- active_session_id: ${debateConversationId} -->`;

        // Update active session ID in memory
        activeConversationId = debateConversationId;

        return {
          content: [
            {
              type: "text",
              text: outputMarkdown,
            }
          ]
        };
      }

      // If we are starting a new session (topic provided)
      if (topic) {
        // Round 1: Optimist initial proposal
        const r1Prompt = `[СИСТЕМНЫЙ ПРОМПТ ДЛЯ РОЛИ: ${DEBATE_PERSONAS.optimist}]\n\nТема для дебатов: ${topic}\n\nПредложи начальную архитектуру или техническое решение.`;
        
        const r1Output = await runAgy(["--dangerously-skip-permissions", "--print", "--continue=false"], r1Prompt);
        debateConversationId = getNewestConversationId();
        if (!debateConversationId) {
          throw new Error("Failed to initialize debate conversation ID");
        }

        // Round 2: Skeptic criticizes
        const r2Prompt = `[СИСТЕМНЫЙ ПРОМПТ ДЛЯ РОЛИ: ${DEBATE_PERSONAS.skeptic}]\n\nИзучи предыдущее предложение Оптимиста. Задай неудобные каверзные вопросы к предложенному решению, укажи на логические нестыковки.`;
        
        const r2Output = await runAgy(
          ["--dangerously-skip-permissions", "--print", "--conversation", debateConversationId],
          r2Prompt
        );

        let outputMarkdown = `# Интерактивные дебаты: ${topic}\n`;
        outputMarkdown += `ID сессии: \`${debateConversationId}\`\n\n`;
        outputMarkdown += `## Раунд 1: [OPTIMIST]\n${r1Output}\n\n`;
        outputMarkdown += `## Раунд 2: [SKEPTIC]\n${r2Output}\n\n`;
        outputMarkdown += `---\n`;
        outputMarkdown += `**Пожалуйста, введите ваш комментарий как Судья/Архитектор**, чтобы направить ход дебатов.\n`;
        outputMarkdown += `Используйте инструмент \`run_interactive_debate\`, передав \`debateId: "${debateConversationId}"\` и \`userComment: "ваш комментарий"\`.\n`;
        outputMarkdown += `Или завершите дебаты и сгенерируйте ADR, передав \`action: "finalize"\`.\n\n`;
        outputMarkdown += `<!-- active_session_id: ${debateConversationId} -->`;

        // Update active session ID in memory
        activeConversationId = debateConversationId;

        return {
          content: [
            {
              type: "text",
              text: outputMarkdown,
            }
          ]
        };
      }

      // If we are continuing an existing session
      if (debateConversationId) {
        if (!userComment) {
          throw new Error("Missing 'userComment' to continue the debate. Please provide a comment or use action: 'finalize'.");
        }

        // Round 3: Agreer reacts to userComment
        const r3Prompt = `[КОММЕНТАРИЙ СУДЬИ/ПОЛЬЗОВАТЕЛЯ]:\n${userComment}\n\n[СИСТЕМНЫЙ ПРОМПТ ДЛЯ РОЛИ: ${DEBATE_PERSONAS.agreer}]\n\nИзучи предложение Оптимиста, критику Скептика и комментарий Судьи. Поддержи Оптимиста и Судью, похвали простоту, предложи срезать углы ради быстрой разработки.`;
        
        const r3Output = await runAgy(
          ["--dangerously-skip-permissions", "--print", "--conversation", debateConversationId],
          r3Prompt
        );

        // Round 4: Hater reacts to userComment
        const r4Prompt = `[СИСТЕМНЫЙ ПРОМПТ ДЛЯ РОЛИ: ${DEBATE_PERSONAS.hater}]\n\nИзучи ход дебатов и комментарий Судьи. Выскажись резко против этой затеи: объясни, почему проект обречен на провал, приведи примеры аналогичных неудач из жизни, накинь токсичных сомнений и утверждай, что всё рухнет.`;
        
        const r4Output = await runAgy(
          ["--dangerously-skip-permissions", "--print", "--conversation", debateConversationId],
          r4Prompt
        );

        let outputMarkdown = `# Интерактивные дебаты (Сессия: ${debateConversationId})\n\n`;
        outputMarkdown += `### Ваш комментарий как Судьи:\n> ${userComment}\n\n`;
        outputMarkdown += `## Раунд 3: [AGREER]\n${r3Output}\n\n`;
        outputMarkdown += `## Раунд 4: [HATER]\n${r4Output}\n\n`;
        outputMarkdown += `---\n`;
        outputMarkdown += `**Вы можете продолжить обсуждение**, введя новый комментарий, или завершить его и сгенерировать итоговый ADR, передав \`action: "finalize"\`.\n\n`;
        outputMarkdown += `<!-- active_session_id: ${debateConversationId} -->`;

        // Update active session ID in memory
        activeConversationId = debateConversationId;

        return {
          content: [
            {
              type: "text",
              text: outputMarkdown,
            }
          ]
        };
      }

      // Neither topic nor debateConversationId is available
      throw new Error("No active debate session. Please provide a 'topic' to start a new debate, or specify 'debateId' to continue.");

    } catch (err: any) {
      return {
        content: [
          {
            type: "text",
            text: `Ошибка во время интерактивных дебатов: ${err.message}`,
          }
        ],
        isError: true
      };
    }
  }

  if (name === "review_code_changes") {
    const diff = String(args?.diff || "");
    const context = args?.context ? String(args.context) : "";

    const systemPrompt = `Ты — Senior Code Reviewer и эксперт по безопасности. Твоя цель — провести профессиональный аудит изменений кода (code review) на русском языке.
Найди потенциальные баги, утечки ресурсов, проблемы безопасности (например, инъекции, небезопасное управление состоянием), неэффективные алгоритмы и отступления от стандартов кодирования или принципов SOLID, DRY, KISS.

Сгруппируй замечания по категориям:
1. **Критические (P0/P1)**: Реальные ошибки, уязвимости, проблемы логики, которые могут сломать систему.
2. **Рекомендации (P2)**: Улучшения читаемости, стилистики, упрощение кода, рефакторинг.

Для каждого важного замечания предложи конкретный пример улучшения кода (исправленный фрагмент). Будь конструктивным и лаконичным.`;

    let promptToSend = `[СИСТЕМНЫЙ ПРОМПТ ДЛЯ РОЛИ: ${systemPrompt}]\n\n`;
    if (context) {
      promptToSend += `Контекст проекта/дополнительные требования:\n${context}\n\n`;
    }
    promptToSend += `Изменения кода для обзора (git diff):\n\`\`\`diff\n${diff}\n\`\`\``;

    try {
      const responseText = await runAgy(["--dangerously-skip-permissions", "--print", "--continue=false"], promptToSend);
      return {
        content: [
          {
            type: "text",
            text: responseText,
          }
        ]
      };
    } catch (err: any) {
      return {
        content: [
          {
            type: "text",
            text: `Ошибка при проведении код-ревью: ${err.message}`,
          }
        ],
        isError: true
      };
    }
  }

  if (name === "get_programming_advice") {
    const question = String(args?.question || "");
    const codeSnippet = args?.codeSnippet ? String(args.codeSnippet) : "";
    const language = args?.language ? String(args.language) : "";

    const systemPrompt = `Ты — Senior Software Engineer и Solutions Architect. Твоя цель — дать точный, лаконичный, глубокий и практически полезный технический ответ на вопрос разработчика на русском языке.
Используй лучшие индустриальные практики, избегай общих слов и лишней воды. Приводи наглядные, чистые и готовые к использованию примеры кода.`;

    let promptToSend = `[СИСТЕМНЫЙ ПРОМПТ ДЛЯ РОЛИ: ${systemPrompt}]\n\n`;
    if (language) {
      promptToSend += `Язык/Технология/Стек: ${language}\n\n`;
    }
    if (codeSnippet) {
      promptToSend += `Исходный код для контекста:\n\`\`\`\n${codeSnippet}\n\`\`\`\n\n`;
    }
    promptToSend += `Вопрос:\n${question}`;

    try {
      const responseText = await runAgy(["--dangerously-skip-permissions", "--print", "--continue=false"], promptToSend);
      return {
        content: [
          {
            type: "text",
            text: responseText,
          }
        ]
      };
    } catch (err: any) {
      return {
        content: [
          {
            type: "text",
            text: `Ошибка при получении совета по программированию: ${err.message}`,
          }
        ],
        isError: true
      };
    }
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
