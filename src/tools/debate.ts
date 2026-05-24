import { writeFileSync } from "fs";
import { DEBATE_PERSONAS } from "../config.ts";
import { sessionState } from "../state.ts";
import { runAgy, getNewestConversationId } from "../utils/agy.ts";
import { handleGetDebateReceipt } from "./receipt.ts";

const DEBATE_PROMPTS: Record<string, any> = {
  ru: {
    optimist: (topic: string) => `[СИСТЕМНЫЙ ПРОМПТ ДЛЯ РОЛИ: ${DEBATE_PERSONAS.optimist}]\n\nТема для дебатов: ${topic}\n\nПредложи начальную архитектуру или техническое решение.`,
    skeptic: `[СИСТЕМНЫЙ ПРОМПТ ДЛЯ РОЛИ: ${DEBATE_PERSONAS.skeptic}]\n\nИзучи предыдущее предложение Оптимиста. Задай неудобные каверзные вопросы к предложенному решению, укажи на логические нестыковки.`,
    agreer: `[СИСТЕМНЫЙ ПРОМПТ ДЛЯ РОЛИ: ${DEBATE_PERSONAS.agreer}]\n\nИзучи предложение Оптимиста и замечания Скептика. Поддержи Оптимиста, похвали простоту, предложи срезать углы ради быстрой разработки и обойтись без сложных проверок.`,
    hater: `[СИСТЕМНЫЙ ПРОМПТ ДЛЯ РОЛИ: ${DEBATE_PERSONAS.hater}]\n\nИзучи ход дебатов. Выскажись резко против этой затеи: объясни, почему проект обречен на провал, приведи примеры аналогичных неудач из жизни, накинь токсичных сомнений и утверждай, что всё рухнет.`,
    optimist_defend: `[СИСТЕМНЫЙ ПРОМПТ ДЛЯ РОЛИ: ${DEBATE_PERSONAS.optimist}]\n\nИзучи все замечания (критику Скептика, предложения Соглашателя и хейт Пессимиста). Защити проект и предложи доработанное сбалансированное решение, отвечающее на все выпады.`,
    skeptic_review: `[СИСТЕМНЫЙ ПРОМПТ ДЛЯ РОЛИ: ${DEBATE_PERSONAS.skeptic}]\n\nИзучи доработанное предложение Оптимиста. Напиши краткую рецензию: остались ли логические нестыковки? Решены ли каверзные вопросы?`,
    hater_persist: `[СИСТЕМНЫЙ ПРОМПТ ДЛЯ РОЛИ: ${DEBATE_PERSONAS.hater}]\n\nИзучи доработанное предложение Оптимиста. Все еще ли проект обречен на провал? Найди новые причины для токсичного пессимизма.`,
    synthesizer: `[СИСТЕМНЫЙ ПРОМПТ ДЛЯ РОЛИ: ${DEBATE_PERSONAS.synthesizer}]\n\nИзучи весь ход дебатов. Составь итоговый структурированный документ Architecture Decision Record (ADR) на русском языке. Он должен включать: тему, контекст обсуждения, итоговое принятое решение, компромиссы (trade-offs) и список рисков с их минимизацией.`,
  },
  en: {
    optimist: (topic: string) => `[SYSTEM PROMPT FOR ROLE: You are the Optimist (Engineer-Developer). Your goal is to propose creative and robust technical solutions. Your tone: enthusiastic developer ready to build.]\n\nDebate topic: ${topic}\n\nPropose an initial architecture or technical solution in English.`,
    skeptic: `[SYSTEM PROMPT FOR ROLE: You are the Skeptic (Logic Critic). Your goal is to find weaknesses in the proposal, question logic, ask challenging questions, and point out redundant complexity. Your tone: constructive critic.]\n\nAnalyze the Optimist's initial proposal. Ask tough questions and point out logical inconsistencies in English.`,
    agreer: `[SYSTEM PROMPT FOR ROLE: You are the Agreer. Your goal is to agree with the Optimist, praise the simplicity of the solution, suggest cutting corners for speed of development, and ignore complex validations. Your tone: friendly, pleasing, seeking easy paths.]\n\nStudy the Optimist's proposal and the Skeptic's feedback. Support the Optimist, praise the simplicity, and suggest cutting corners to ship faster without complex checks in English.`,
    hater: `[SYSTEM PROMPT FOR ROLE: You are the Hater (Toxic Pessimist). Your goal is to express strong doubts and argue that the project is doomed to fail. Bring up real-world failures and toxic skepticism. Your tone: sarcastic, cynical.]\n\nAnalyze the debate. Speak out strongly against this initiative: explain why the project will fail, give examples of real-world failures of similar systems, add cynical doubts, and claim it will crash in English.`,
    optimist_defend: `[SYSTEM PROMPT FOR ROLE: You are the Optimist.]\n\nStudy all comments (Skeptic's critique, Agreer's proposals, and Hater's skepticism). Defend the project and propose a refined, balanced solution addressing all concerns in English.`,
    skeptic_review: `[SYSTEM PROMPT FOR ROLE: You are the Skeptic.]\n\nStudy the refined proposal from the Optimist. Write a brief review in English: are there still logical inconsistencies? Have the tough questions been answered?`,
    hater_persist: `[SYSTEM PROMPT FOR ROLE: You are the Hater.]\n\nStudy the refined proposal from the Optimist. Is the project still doomed to fail? Find new reasons for toxic pessimism in English.`,
    synthesizer: `[SYSTEM PROMPT FOR ROLE: You are the Synthesizer (Lead Architect). Your goal is to weigh all opinions, find compromises, and write a final Architecture Decision Record (ADR) in English. Your tone: authoritative, balanced, constructive.]\n\nAnalyze the entire debate history. Write the final structured Architecture Decision Record (ADR) in English. It must include: topic, context, final decision, trade-offs, and risk mitigation list.`,
  }
};

const INTERACTIVE_PROMPTS: Record<string, any> = {
  ru: {
    optimist: (topic: string) => `[СИСТЕМНЫЙ ПРОМПТ ДЛЯ РОЛИ: ${DEBATE_PERSONAS.optimist}]\n\nТема для дебатов: ${topic}\n\nПредложи начальную архитектуру или техническое решение.`,
    skeptic: `[СИСТЕМНЫЙ ПРОМПТ ДЛЯ РОЛИ: ${DEBATE_PERSONAS.skeptic}]\n\nИзучи предыдущее предложение Оптимиста. Задай неудобные каверзные вопросы к предложенному решению, укажи на логические нестыковки.`,
    agreer: (comment: string) => `[КОММЕНТАРИЙ СУДЬИ/ПОЛЬЗОВАТЕЛЯ]:\n${comment}\n\n[СИСТЕМНЫЙ ПРОМПТ ДЛЯ РОЛИ: ${DEBATE_PERSONAS.agreer}]\n\nИзучи предложение Оптимиста, критику Скептика и комментарий Судьи. Поддержи Оптимиста и Судью, похвали простоту, предложи срезать углы ради быстрой разработки.`,
    hater: `[СИСТЕМНЫЙ ПРОМПТ ДЛЯ РОЛИ: ${DEBATE_PERSONAS.hater}]\n\nИзучи ход дебатов и комментарий Судьи. Выскажись резко против этой затеи: объясни, почему проект обречен на провал, приведи примеры аналогичных неудач из жизни, накинь токсичных сомнений и утверждай, что всё рухнет.`,
    synthesizer: (comment?: string) => {
      let p = "";
      if (comment) p += `[КОММЕНТАРИЙ СУДЬИ/ПОЛЬЗОВАТЕЛЯ]:\n${comment}\n\n`;
      p += `[СИСТЕМНЫЙ ПРОМПТ ДЛЯ РОЛИ: ${DEBATE_PERSONAS.synthesizer}]\n\nИзучи весь ход дебатов, включая комментарии Судьи. Составь итоговый структурированный документ Architecture Decision Record (ADR) на русском языке. Он должен включать: тему, контекст обсуждения, итоговое принятое решение (с учетом финального мнения Судьи), компромиссы (trade-offs) и список рисков с их минимизацией.`;
      return p;
    },
    title: (topic: string) => `# Интерактивные дебаты: ${topic}\n`,
    finalizeTitle: (id: string) => `# Финализация дебатов (Сессия: ${id})\n\n`,
    judgeComment: "Ваш комментарий как Судьи:",
    nextSteps: (id: string) => `---\n**Пожалуйста, введите ваш комментарий как Судья/Архитектор**, чтобы направить ход дебатов.\nИспользуйте инструмент \`run_interactive_debate\`, передав \`debateId: "${id}"\` и \`userComment: "ваш комментарий"\`.\nИли завершите дебаты и сгенерируйте ADR, передав \`action: "finalize"\`.\n\n`,
    nextStepsCont: "Или завершите дебаты и сгенерируйте итоговый ADR, передав `action: \"finalize\"`.\n\n",
  },
  en: {
    optimist: (topic: string) => `[SYSTEM PROMPT FOR ROLE: You are the Optimist (Engineer-Developer). Your goal is to propose creative and robust technical solutions. Your tone: enthusiastic developer ready to build.]\n\nDebate topic: ${topic}\n\nPropose an initial architecture or technical solution in English.`,
    skeptic: `[SYSTEM PROMPT FOR ROLE: You are the Skeptic (Logic Critic). Your goal is to find weaknesses in the proposal, question logic, ask challenging questions, and point out redundant complexity. Your tone: constructive critic.]\n\nAnalyze the Optimist's initial proposal. Ask tough questions and point out logical inconsistencies in English.`,
    agreer: (comment: string) => `[JUDGE/USER COMMENT]:\n${comment}\n\n[SYSTEM PROMPT FOR ROLE: You are the Agreer. Your goal is to agree with the Optimist and the Judge, praise the simplicity of the solution, suggest cutting corners for speed of development, and ignore complex validations.]\n\nStudy the Optimist's proposal, the Skeptic's feedback, and the Judge's comment. Support the Optimist and the Judge, praise the simplicity, and suggest cutting corners to ship faster in English.`,
    hater: `[SYSTEM PROMPT FOR ROLE: You are the Hater (Toxic Pessimist). Your goal is to express strong doubts and argue that the project is doomed to fail. Bring up real-world failures and toxic skepticism.]\n\nAnalyze the debate and the Judge's comment. Speak out strongly against this initiative: explain why the project will fail, give examples of real-world failures, add cynical doubts, and claim it will crash in English.`,
    synthesizer: (comment?: string) => {
      let p = "";
      if (comment) p += `[JUDGE/USER COMMENT]:\n${comment}\n\n`;
      p += `[SYSTEM PROMPT FOR ROLE: You are the Synthesizer (Lead Architect). Your goal is to weigh all opinions, consider the Judge's final input, and write a final Architecture Decision Record (ADR) in English.]\n\nAnalyze the entire debate history, including the Judge's comments. Write the final structured Architecture Decision Record (ADR) in English. It must include: topic, context, final decision (taking the Judge's final view into account), trade-offs, and risk mitigation list.`;
      return p;
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
