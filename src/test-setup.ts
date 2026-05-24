import { mock } from "bun:test";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

// Mock mutable states
export let mockSpawnOutput = { stdout: "Hello from mock agy", stderr: "", code: 0 };
export let mockFiles: { name: string; mtime: number }[] = [];
export let lastSpawnArgs: string[] = [];
export let lastSpawnStdin = "";
export let mockReaddirShouldThrow = false;
export let mockAuditLogContent = "";
export let mockExistsSyncResult = false;

// Setters to allow test files to modify the state in ESM
export function setMockSpawnOutput(val: typeof mockSpawnOutput) { mockSpawnOutput = val; }
export function setMockFiles(val: typeof mockFiles) { mockFiles = val; }
export function setLastSpawnArgs(val: typeof lastSpawnArgs) { lastSpawnArgs = val; }
export function setLastSpawnStdin(val: string) { lastSpawnStdin = val; }
export function setMockReaddirShouldThrow(val: boolean) { mockReaddirShouldThrow = val; }
export function setMockAuditLogContent(val: string) { mockAuditLogContent = val; }
export function setMockExistsSyncResult(val: boolean) { mockExistsSyncResult = val; }

// Reset helper
export function resetMockState() {
  mockSpawnOutput = { stdout: "Hello from mock agy", stderr: "", code: 0 };
  mockFiles = [];
  lastSpawnArgs = [];
  lastSpawnStdin = "";
  mockReaddirShouldThrow = false;
  mockAuditLogContent = "";
  mockExistsSyncResult = false;
}

// Register Mocks for child_process
mock.module("child_process", () => {
  return {
    spawn: (cmd: string, args: string[], options: any) => {
      lastSpawnArgs = args;
      const listeners: Record<string, Function[]> = {};
      const stdoutListeners: Function[] = [];
      const stderrListeners: Function[] = [];

      const stdin = {
        write: mock((data: string) => {
          lastSpawnStdin = data;
        }),
        end: mock(() => {}),
      };

      const stdout = {
        setEncoding: mock(() => {}),
        on: (event: string, callback: Function) => {
          if (event === "data") stdoutListeners.push(callback);
        }
      };

      const stderr = {
        setEncoding: mock(() => {}),
        on: (event: string, callback: Function) => {
          if (event === "data") stderrListeners.push(callback);
        }
      };

      const proc: any = {
        stdin,
        stdout,
        stderr,
        on: (event: string, callback: Function) => {
          if (!listeners[event]) listeners[event] = [];
          listeners[event].push(callback);
        }
      };

      // Fire events asynchronously to simulate the process running
      setTimeout(() => {
        if (mockSpawnOutput.stdout) {
          stdoutListeners.forEach(cb => cb(Buffer.from(mockSpawnOutput.stdout)));
        }
        if (mockSpawnOutput.stderr) {
          stderrListeners.forEach(cb => cb(Buffer.from(mockSpawnOutput.stderr)));
        }
        const closeListeners = listeners["close"] || [];
        closeListeners.forEach(cb => cb(mockSpawnOutput.code));
      }, 5);

      return proc;
    }
  };
});

// Register Mocks for fs
mock.module("fs", () => {
  return {
    readdirSync: (dir: string) => {
      if (mockReaddirShouldThrow) {
        throw new Error("Disk read error");
      }
      return mockFiles.map(f => f.name);
    },
    statSync: (filePath: string) => {
      const basename = filePath.split("/").pop() || "";
      const matched = mockFiles.find(f => f.name === basename);
      return {
        mtime: {
          getTime: () => matched ? matched.mtime : 0
        }
      };
    },
    readFileSync: (filePath: string, encoding: string) => {
      return mockAuditLogContent;
    },
    existsSync: (filePath: string) => {
      if (filePath.endsWith("hooks-audit.jsonl")) {
        return mockExistsSyncResult;
      }
      return false;
    }
  };
});

// Register Mocks for @modelcontextprotocol/sdk/server/stdio.js
mock.module("@modelcontextprotocol/sdk/server/stdio.js", () => {
  return {
    StdioServerTransport: class {
      start = mock(() => Promise.resolve());
      send = mock(() => Promise.resolve());
      close = mock(() => Promise.resolve());
      set onmessage(cb: any) {}
      set onclose(cb: any) {}
      set onerror(cb: any) {}
    }
  };
});

// Custom Mock Transport for testing JSON-RPC exchanges
export class MockTransport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;
  sentMessages: JSONRPCMessage[] = [];

  async start() {}
  async send(message: JSONRPCMessage) {
    this.sentMessages.push(message);
  }
  async close() {
    if (this.onclose) this.onclose();
  }
  simulateReceive(message: JSONRPCMessage) {
    if (this.onmessage) this.onmessage(message);
  }
}
