import { handleRunDebateDeliberation } from "../src/tools/debate.ts";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

async function main() {
  const topic = "Какие еще добавления, новые инструменты и улучшения стоит внедрить в наш Antigravity MCP сервер (например, интеграция с внешними API, расширенное логирование, новые хуки, автоматизация рутинных задач кодинга)";
  console.log(`Starting debate on: "${topic}"...`);
  
  const result = await handleRunDebateDeliberation({
    topic: topic,
    rounds: 5
  });

  if (result.isError) {
    console.error("Debate failed:", result.content[0].text);
    process.exit(1);
  }

  const markdown = result.content[0].text;
  const outputDir = join(import.meta.dir, "../examples");
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = join(outputDir, "debate_mcp_features.md");
  writeFileSync(outputPath, markdown, "utf8");
  console.log(`Debate successfully saved to: ${outputPath}`);
}

main().catch(console.error);
