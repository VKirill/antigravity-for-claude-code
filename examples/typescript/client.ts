import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function runMcpClient() {
  // 1. Initialize Stdio transport pointing to the built server entry point
  const transport = new StdioClientTransport({
    command: "node",
    args: ["../../dist/index.js"]
  });

  const client = new Client({
    name: "Antigravity-Client-Example",
    version: "1.0.0"
  }, {
    capabilities: {}
  });

  console.log("Connecting to Antigravity MCP Server...");
  await client.connect(transport);
  console.log("Connected successfully!\n");

  // 2. List available tools
  const tools = await client.listTools();
  console.log("Available tools:", JSON.stringify(tools.tools.map(t => t.name), null, 2));

  // 3. Call the debate deliberation tool
  console.log("\n--- Simulating AI debate ---");
  const debateResponse = await client.callTool({
    name: "run_debate_deliberation",
    arguments: {
      topic: "Should we migrate our legacy Express monolith to a Serverless Next.js App Router API?",
      rounds: 1 // Keep it short for the test run
    }
  });

  console.log("Debate Outcome:\n");
  console.log(debateResponse.content[0].text);

  // 4. Call code review tool
  console.log("\n--- Running Code Review ---");
  const codeSnippet = `
  function getUser(id) {
    const query = "SELECT * FROM users WHERE id = " + id; // SQL Injection
    return db.execute(query);
  }
  `;

  const reviewResponse = await client.callTool({
    name: "review_code_changes",
    arguments: {
      diff: codeSnippet,
      context: "Node.js application, Postgres database."
    }
  });

  console.log("Review Findings:\n");
  console.log(reviewResponse.content[0].text);

  await transport.close();
}

runMcpClient().catch(console.error);
