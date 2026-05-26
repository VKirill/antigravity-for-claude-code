import { test, expect, describe, beforeEach, beforeAll } from "bun:test";
import { MockTransport, resetMockState, mockFsFiles } from "../test-setup.ts";
import { server } from "../index.ts";
import { resetTestState } from "../state.ts";
import { resolvePromptsDir } from "../utils/prompts.ts";
import path from "node:path";

describe("get_skill_catalog registration tests", () => {
  let transport: MockTransport;
  let catalogPath: string;
  let catalogContent: string;

  beforeAll(async () => {
    catalogPath = path.join(resolvePromptsDir(), "skills-catalog.md");
    catalogContent = await Bun.file(catalogPath).text();

    transport = new MockTransport();
    try {
      await server.close();
    } catch (e) {}
    // @ts-ignore
    await server.connect(transport);
  });

  beforeEach(() => {
    resetTestState();
    resetMockState();
    mockFsFiles.set(catalogPath, catalogContent);
    transport.sentMessages = [];
  });

  test("a) tools/list contains get_skill_catalog tool schema", async () => {
    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/list",
      params: {},
      id: 100
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(transport.sentMessages.length).toBe(1);
    const response: any = transport.sentMessages[0];
    expect(response.id).toBe(100);
    expect(response.result.tools).toBeArray();

    const tool = response.result.tools.find((t: any) => t.name === "get_skill_catalog");
    expect(tool).toBeDefined();
    expect(tool.description).toContain("Lists agy worker skills parsed from prompts/skills-catalog.md");
    expect(tool.inputSchema.properties.name).toBeDefined();
    expect(tool.inputSchema.properties.category).toBeDefined();
  });

  test("b) tools/call with {} returns all skills (>=100)", async () => {
    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "get_skill_catalog",
        arguments: {}
      },
      id: 101
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(transport.sentMessages.length).toBe(1);
    const response: any = transport.sentMessages[0];
    expect(response.id).toBe(101);
    expect(response.result.isError).toBeUndefined();

    const text = response.result.content[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.skills).toBeArray();
    expect(parsed.skills.length).toBeGreaterThanOrEqual(100);
  });

  test("c) tools/call with typescript returns exactly 1 skill", async () => {
    transport.simulateReceive({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "get_skill_catalog",
        arguments: {
          name: "typescript"
        }
      },
      id: 102
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(transport.sentMessages.length).toBe(1);
    const response: any = transport.sentMessages[0];
    expect(response.id).toBe(102);
    expect(response.result.isError).toBeUndefined();

    const text = response.result.content[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.skills).toBeArray();
    expect(parsed.skills.length).toBe(1);
    expect(parsed.skills[0].name).toBe("typescript");
  });
});
