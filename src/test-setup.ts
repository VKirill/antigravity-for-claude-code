import { mock } from "bun:test";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

// Mock mutable states
export let mockSpawnOutput: {
  stdout: string;
  stderr: string;
  code: number;
  dontFireClose?: boolean;
  fireExit?: boolean;
  exitCode?: number;
  exitSignal?: string;
  exitDelayMs?: number;
  closeDelayMs?: number;
  pid?: number;
} = { stdout: "Hello from mock agy", stderr: "", code: 0 };
export let mockFiles: { name: string; mtime: number; size?: number }[] = [];
export let mockReadContent = "";
export let lastSpawnArgs: string[] = [];
export let lastSpawnStdin = "";
export let mockReaddirShouldThrow = false;
export let mockAuditLogContent = "";
export let mockExistsSyncResult = false;
export let mockSpawnSyncOutput: {
  stdout: string;
  stderr: string;
  status: number;
  error?: Error;
  stdoutQueue?: string[];
} = { stdout: "", stderr: "", status: 0 };
export let lastSpawnSyncArgs: string[] = [];
export let lastAppendFileSyncPath = "";
export let lastAppendFileSyncData = "";
export let appendFileSyncCalls: { filePath: string; data: string }[] = [];

// Setters to allow test files to modify the state in ESM
export function setMockSpawnOutput(val: typeof mockSpawnOutput) { mockSpawnOutput = val; }
export function setMockFiles(val: typeof mockFiles) { mockFiles = val; }
export function setMockReadContent(val: string) { mockReadContent = val; }
export function setLastSpawnArgs(val: typeof lastSpawnArgs) { lastSpawnArgs = val; }
export function setLastSpawnStdin(val: string) { lastSpawnStdin = val; }
export function setMockReaddirShouldThrow(val: boolean) { mockReaddirShouldThrow = val; }
export function setMockAuditLogContent(val: string) { mockAuditLogContent = val; }
export function setMockExistsSyncResult(val: boolean) { mockExistsSyncResult = val; }
export function setMockSpawnSyncOutput(val: typeof mockSpawnSyncOutput) { mockSpawnSyncOutput = val; }
export function setLastSpawnSyncArgs(val: string[]) { lastSpawnSyncArgs = val; }
export function setLastAppendFileSyncPath(val: string) { lastAppendFileSyncPath = val; }
export function setLastAppendFileSyncData(val: string) { lastAppendFileSyncData = val; }

// Reset helper
export function resetMockState() {
  mockSpawnOutput = { stdout: "Hello from mock agy", stderr: "", code: 0 };
  mockFiles = [];
  mockReadContent = "";
  lastSpawnArgs = [];
  lastSpawnStdin = "";
  mockReaddirShouldThrow = false;
  mockAuditLogContent = "";
  mockExistsSyncResult = false;
  mockSpawnSyncOutput = { stdout: "", stderr: "", status: 0 };
  lastSpawnSyncArgs = [];
  lastAppendFileSyncPath = "";
  lastAppendFileSyncData = "";
  appendFileSyncCalls = [];
}

mock.module("child_process", () => {
  return {
    spawn: (cmd: string, args: string[], options: unknown) => {
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
        },
        destroy: mock(() => {}),
      };

      const stderr = {
        setEncoding: mock(() => {}),
        on: (event: string, callback: Function) => {
          if (event === "data") stderrListeners.push(callback);
        },
        destroy: mock(() => {}),
      };

      const pid = mockSpawnOutput.pid !== undefined ? mockSpawnOutput.pid : 12345;

      const proc = {
        pid,
        stdin,
        stdout,
        stderr,
        on: (event: string, callback: Function) => {
          if (!listeners[event]) listeners[event] = [];
          listeners[event].push(callback);
        }
      };

      // Fire events asynchronously to simulate the process running
      const closeDelay = mockSpawnOutput.closeDelayMs !== undefined ? mockSpawnOutput.closeDelayMs : 5;
      const exitDelay = mockSpawnOutput.exitDelayMs !== undefined ? mockSpawnOutput.exitDelayMs : (closeDelay - 1 >= 0 ? closeDelay - 1 : 0);

      if (mockSpawnOutput.stdout) {
        setTimeout(() => {
          stdoutListeners.forEach(cb => cb(Buffer.from(mockSpawnOutput.stdout)));
        }, 1);
      }
      if (mockSpawnOutput.stderr) {
        setTimeout(() => {
          stderrListeners.forEach(cb => cb(Buffer.from(mockSpawnOutput.stderr)));
        }, 1);
      }

      if (mockSpawnOutput.fireExit || mockSpawnOutput.dontFireClose) {
        setTimeout(() => {
          const exitListeners = listeners["exit"] || [];
          exitListeners.forEach(cb => cb(mockSpawnOutput.exitCode !== undefined ? mockSpawnOutput.exitCode : mockSpawnOutput.code, mockSpawnOutput.exitSignal || null));
        }, exitDelay);
      }

      if (!mockSpawnOutput.dontFireClose) {
        setTimeout(() => {
          const closeListeners = listeners["close"] || [];
          closeListeners.forEach(cb => cb(mockSpawnOutput.code));
        }, closeDelay);
      }

      return proc;
    },
    spawnSync: (cmd: string, args: string[], options: unknown) => {
      lastSpawnSyncArgs = args;
      if (mockSpawnSyncOutput.error) {
        return {
          error: mockSpawnSyncOutput.error,
          status: mockSpawnSyncOutput.status,
          stdout: mockSpawnSyncOutput.stdout,
          stderr: mockSpawnSyncOutput.stderr
        };
      }
      let stdout = mockSpawnSyncOutput.stdout;
      if (mockSpawnSyncOutput.stdoutQueue && mockSpawnSyncOutput.stdoutQueue.length > 0) {
        stdout = mockSpawnSyncOutput.stdoutQueue.shift()!;
      }
      return {
        status: mockSpawnSyncOutput.status,
        stdout: stdout,
        stderr: mockSpawnSyncOutput.stderr
      };
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
        },
        mtimeMs: matched ? matched.mtime : 0,
        size: matched && matched.size !== undefined ? matched.size : 0,
      };
    },
    openSync: (filePath: string) => 1,
    closeSync: (fd: number) => {},
    readSync: (fd: number, buffer: Buffer, offset: number, length: number, position: number) => {
      const data = Buffer.from(mockReadContent, "utf-8");
      const slice = data.subarray(position, position + length);
      slice.copy(buffer, offset);
      return slice.length;
    },
    readFileSync: (filePath: string, encoding: string) => {
      return mockAuditLogContent;
    },
    existsSync: (filePath: string) => {
      if (filePath.endsWith("hooks-audit.jsonl")) {
        return mockExistsSyncResult;
      }
      return false;
    },
    appendFileSync: (filePath: string, data: string, encoding: string) => {
      lastAppendFileSyncPath = filePath;
      lastAppendFileSyncData = data;
      appendFileSyncCalls.push({ filePath, data });
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
      set onmessage(cb: unknown) {}
      set onclose(cb: unknown) {}
      set onerror(cb: unknown) {}
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
