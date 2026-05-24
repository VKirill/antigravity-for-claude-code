import { writeFileSync } from "fs";
import { sessionState } from "../state.ts";
import { runAgy, getNewestConversationId } from "../utils/agy.ts";
import { handleGetDebateReceipt } from "./receipt.ts";
import { loadPrompt } from "../utils/prompts.ts";

const DEBATE_PROMPTS: Record<string, any> = {
  ru: {
    optimist: (topic: string) => loadPrompt("rounds/ru/optimist.md", { topic }),
    get skeptic() { return loadPrompt("rounds/ru/skeptic.md"); },
    get agreer() { return loadPrompt("rounds/ru/agreer.md"); },
    get hater() { return loadPrompt("rounds/ru/hater.md"); },
    get optimist_defend() { return loadPrompt("rounds/ru/optimist_defend.md"); },
    get skeptic_review() { return loadPrompt("rounds/ru/skeptic_review.md"); },
    get hater_persist() { return loadPrompt("rounds/ru/hater_persist.md"); },
    get synthesizer() { return loadPrompt("rounds/ru/synthesizer.md"); },
  },
  en: {
    optimist: (topic: string) => loadPrompt("rounds/en/optimist.md", { topic }),
    get skeptic() { return loadPrompt("rounds/en/skeptic.md"); },
    get agreer() { return loadPrompt("rounds/en/agreer.md"); },
    get hater() { return loadPrompt("rounds/en/hater.md"); },
    get optimist_defend() { return loadPrompt("rounds/en/optimist_defend.md"); },
    get skeptic_review() { return loadPrompt("rounds/en/skeptic_review.md"); },
    get hater_persist() { return loadPrompt("rounds/en/hater_persist.md"); },
    get synthesizer() { return loadPrompt("rounds/en/synthesizer.md"); },
  }
};

const INTERACTIVE_PROMPTS: Record<string, any> = {
  ru: {
    optimist: (topic: string) => loadPrompt("rounds/ru/optimist.md", { topic }),
    get skeptic() { return loadPrompt("rounds/ru/skeptic.md"); },
    agreer: (comment: string) => loadPrompt("rounds/ru/agreer.interactive.md", { comment }),
    get hater() { return loadPrompt("rounds/ru/hater.interactive.md"); },
    synthesizer: (comment?: string) => {
      const prompt = loadPrompt("rounds/ru/synthesizer.interactive.md");
      if (comment) {
        return prompt.split("{{comment}}").join(comment);
      } else {
        const index = prompt.indexOf("[СИСТЕМНЫЙ ПРОМПТ");
        return prompt.slice(index);
      }
    },
    title: (topic: string) => `# Интерактивные дебаты: ${topic}\n`,
    finalizeTitle: (id: string) => `# Финализация дебатов (Сессия: ${id})\n\n`,
    judgeComment: "Ваш комментарий как Судьи:",
    nextSteps: (id: string) => `---\n**Пожалуйста, введите ваш комментарий как Судья/Архитектор**, чтобы направить ход дебатов.\nИспользуйте инструмент \`run_interactive_debate\`, передав \`debateId: "${id}"\` и \`userComment: "ваш комментарий"\`.\nИли завершите дебаты и сгенерируйте ADR, передав \`action: "finalize"\`.\n\n`,
    nextStepsCont: "Или завершите дебаты и сгенерируйте итоговый ADR, передав `action: \"finalize\"`.\n\n",
  },
  en: {
    optimist: (topic: string) => loadPrompt("rounds/en/optimist.md", { topic }),
    get skeptic() { return loadPrompt("rounds/en/skeptic.md"); },
    agreer: (comment: string) => loadPrompt("rounds/en/agreer.interactive.md", { comment }),
    get hater() { return loadPrompt("rounds/en/hater.interactive.md"); },
    synthesizer: (comment?: string) => {
      const prompt = loadPrompt("rounds/en/synthesizer.interactive.md");
      if (comment) {
        return prompt.split("{{comment}}").join(comment);
      } else {
        const index = prompt.indexOf("[SYSTEM PROMPT");
        return prompt.slice(index);
      }
    },
    title: (topic: string) => `# Interactive Debate: ${topic}\n`,
    finalizeTitle: (id: string) => `# Debate Finalization (Session: ${id})\n\n`,
    judgeComment: "Your comment as Judge:",
    nextSteps: (id: string) => `---\n**Please enter your comment as the Judge/Architect** to guide the debate.\nUse the \`run_interactive_debate\` tool, passing \`debateId: "${id}"\` and \`userComment: "your comment"\`.\nOr finalize the debate and generate the ADR by passing \`action: "finalize"\`.\n\n`,
    nextStepsCont: "Or finalize the debate and generate the final ADR by passing `action: \"finalize\"`.\n\n",
  }
};

function detectLanguage(text: string): "ru" | "en" {
  return /[а-яА-ЯёЁ]/.test(text) ? "ru" : "en";
}

export async function handleRunDebateDeliberation(args: any) {
  const topic = String(args?.topic || "");
  const roundsInput = args?.rounds ? Number(args.rounds) : 5;
  const rounds = Math.max(3, Math.min(10, roundsInput)); // clamp rounds between 3 and 10
  const lang = (args?.language === "en" || args?.language === "english") ? "en" : (args?.language === "ru" ? "ru" : detectLanguage(topic));

  const transcript: { persona: string; text: string }[] = [];
  let debateConversationId: string | null = null;

  const prompts = DEBATE_PROMPTS[lang];

  try {
    // Round 1: Optimist initial proposal
    const r1Prompt = prompts.optimist(topic);
    
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
        instructions = prompts.skeptic;
      } else if (r === 3) {
        currentPersona = "agreer";
        instructions = prompts.agreer;
      } else if (r === 4) {
        currentPersona = "hater";
        instructions = prompts.hater;
      } else {
        // For round 5 and onward, alternate
        if (r % 2 === 1) {
          currentPersona = "optimist";
          instructions = prompts.optimist_defend;
        } else {
          // Alternate critics: skeptic or hater
          if (r % 4 === 0) {
            currentPersona = "skeptic";
            instructions = prompts.skeptic_review;
          } else {
            currentPersona = "hater";
            instructions = prompts.hater_persist;
          }
        }
      }

      const reply = await runAgy(["--dangerously-skip-permissions", "--print", "--conversation", debateConversationId], instructions);
      transcript.push({ persona: currentPersona, text: reply });
    }

    // Final Round: Synthesizer
    const finalPrompt = prompts.synthesizer;
    
    const synthesisOutput = await runAgy(["--dangerously-skip-permissions", "--print", "--conversation", debateConversationId], finalPrompt);
    transcript.push({ persona: "synthesizer", text: synthesisOutput });

    // Construct output markdown
    const title = lang === "en" ? `Debate Results: ${topic}` : `Результаты дебатов: ${topic}`;
    const transcriptTitle = lang === "en" ? "Debate Transcript" : "Стенограмма дебатов (Transcript)";
    const showDetailsText = lang === "en" ? `View discussion flow (${rounds} rounds)` : `Посмотреть ход обсуждения (${rounds} раундов)`;

    let outputMarkdown = `# ${title}\n\n`;
    outputMarkdown += `${synthesisOutput}\n\n`;
    outputMarkdown += `## ${transcriptTitle}\n`;
    outputMarkdown += `<details>\n<summary>${showDetailsText}</summary>\n\n`;

    for (let i = 0; i < transcript.length; i++) {
      const entry = transcript[i];
      const roleName = entry.persona.toUpperCase();
      outputMarkdown += `### Round ${i + 1}: [${roleName}]\n${entry.text}\n\n---\n\n`;
    }

    outputMarkdown += `</details>\n\n<!-- active_session_id: ${debateConversationId} -->`;

    // Set active session in memory to the debate session
    sessionState.activeConversationId = debateConversationId;

    // Save files locally in the workspace (project root)
    try {
      const projectCwd = process.env.PWD || process.cwd();
      const deliberationPath = `${projectCwd}/debate-deliberation.md`;
      const receiptPath = `${projectCwd}/debate-receipt.md`;

      writeFileSync(deliberationPath, outputMarkdown);

      if (debateConversationId) {
        const receiptResult = await handleGetDebateReceipt({ debateId: debateConversationId, language: lang });
        if (!receiptResult.isError && receiptResult.content && receiptResult.content[0]) {
          writeFileSync(receiptPath, receiptResult.content[0].text);
        }
      }
    } catch (e) {
      // Ignore file save errors during MCP execution
    }

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

export async function handleRunInteractiveDebate(args: any) {
  const topic = args?.topic ? String(args.topic) : undefined;
  const userComment = args?.userComment ? String(args.userComment) : undefined;
  const action = args?.action ? String(args.action) : "next";
  
  let debateConversationId = args?.debateId ? String(args.debateId) : sessionState.activeConversationId;

  // Resolve language: check explicitly, auto-detect from topic or userComment, default to "ru"
  const langInput = args?.language;
  const lang = (langInput === "en" || langInput === "english") 
    ? "en" 
    : ((langInput === "ru" || langInput === "russian") 
        ? "ru" 
        : (topic ? detectLanguage(topic) : (userComment ? detectLanguage(userComment) : "ru")));

  const prompts = INTERACTIVE_PROMPTS[lang];

  try {
    if (action === "finalize") {
      if (!debateConversationId) {
        throw new Error(lang === "en" ? "No active debate session found. Please specify debateId." : "No active debate session found. Please specify debateId.");
      }

      // Run Synthesizer
      const finalPrompt = prompts.synthesizer(userComment);

      const synthesisOutput = await runAgy(
        ["--dangerously-skip-permissions", "--print", "--conversation", debateConversationId],
        finalPrompt
      );

      let outputMarkdown = prompts.finalizeTitle(debateConversationId);
      outputMarkdown += `${synthesisOutput}\n\n`;
      outputMarkdown += `<!-- active_session_id: ${debateConversationId} -->`;

      // Update active session ID in memory
      sessionState.activeConversationId = debateConversationId;

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
      const r1Prompt = prompts.optimist(topic);
      
      const r1Output = await runAgy(["--dangerously-skip-permissions", "--print", "--continue=false"], r1Prompt);
      debateConversationId = getNewestConversationId();
      if (!debateConversationId) {
        throw new Error("Failed to initialize debate conversation ID");
      }

      // Round 2: Skeptic criticizes
      const r2Prompt = prompts.skeptic;
      
      const r2Output = await runAgy(
        ["--dangerously-skip-permissions", "--print", "--conversation", debateConversationId],
        r2Prompt
      );

      let outputMarkdown = prompts.title(topic);
      outputMarkdown += lang === "en" ? `Session ID: \`${debateConversationId}\`\n\n` : `ID сессии: \`${debateConversationId}\`\n\n`;
      outputMarkdown += `## Round 1: [OPTIMIST]\n${r1Output}\n\n`;
      outputMarkdown += `## Round 2: [SKEPTIC]\n${r2Output}\n\n`;
      outputMarkdown += prompts.nextSteps(debateConversationId);
      outputMarkdown += `<!-- active_session_id: ${debateConversationId} -->`;

      // Update active session ID in memory
      sessionState.activeConversationId = debateConversationId;

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
        throw new Error(lang === "en" ? "Missing 'userComment' to continue the debate." : "Missing 'userComment' to continue the debate.");
      }

      // Round 3: Agreer reacts to userComment
      const r3Prompt = prompts.agreer(userComment);
      
      const r3Output = await runAgy(
        ["--dangerously-skip-permissions", "--print", "--conversation", debateConversationId],
        r3Prompt
      );

      // Round 4: Hater reacts to userComment
      const r4Prompt = prompts.hater;
      
      const r4Output = await runAgy(
        ["--dangerously-skip-permissions", "--print", "--conversation", debateConversationId],
        r4Prompt
      );

      let outputMarkdown = prompts.finalizeTitle(debateConversationId);
      outputMarkdown += `### ${prompts.judgeComment}\n> ${userComment}\n\n`;
      outputMarkdown += `## Round 3: [AGREER]\n${r3Output}\n\n`;
      outputMarkdown += `## Round 4: [HATER]\n${r4Output}\n\n`;
      outputMarkdown += prompts.nextStepsCont;
      outputMarkdown += `<!-- active_session_id: ${debateConversationId} -->`;

      // Update active session ID in memory
      sessionState.activeConversationId = debateConversationId;

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
    throw new Error(lang === "en" ? "No active debate session." : "No active debate session.");

  } catch (err: any) {
    return {
      content: [
        {
          type: "text",
          text: lang === "en" ? `Error during interactive debate: ${err.message}` : `Ошибка во время интерактивных дебатов: ${err.message}`,
        }
      ],
      isError: true
    };
  }
}
