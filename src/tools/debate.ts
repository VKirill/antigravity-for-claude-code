import { DEBATE_PERSONAS } from "../config.ts";
import { sessionState } from "../state.ts";
import { runAgy, getNewestConversationId } from "../utils/agy.ts";

export async function handleRunDebateDeliberation(args: any) {
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
    sessionState.activeConversationId = debateConversationId;

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
