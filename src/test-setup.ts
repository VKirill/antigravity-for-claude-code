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

// Generic in-memory file mock state
export let mockFsFiles = new Map<string, string>();
export let mockFsDirs = new Set<string>();
export let mockFsReadShouldThrow = false;
export let mockFsWriteShouldThrow = false;
export let mockExitCodeSessions = new Set<string>();

// tmux execSync mock state
export let mockTmuxSessions: string[] = [];
export let mockExecSyncShouldThrow = false;
export let execSyncCalls: string[] = [];
export let mockKillShouldThrow = false;
export let existsSyncCalls: string[] = [];

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
export function setMockFsReadShouldThrow(val: boolean) { mockFsReadShouldThrow = val; }
export function setMockFsWriteShouldThrow(val: boolean) { mockFsWriteShouldThrow = val; }
export function setMockTmuxSessions(val: string[]) { mockTmuxSessions = val; }
export function setMockExecSyncShouldThrow(val: boolean) { mockExecSyncShouldThrow = val; }
export function setMockKillShouldThrow(val: boolean) { mockKillShouldThrow = val; }

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
  
  mockFsFiles.clear();
  mockFsDirs.clear();
  mockFsReadShouldThrow = false;
  mockFsWriteShouldThrow = false;
  mockExitCodeSessions.clear();
  mockTmuxSessions = [];
  mockExecSyncShouldThrow = false;
  execSyncCalls = [];
  mockKillShouldThrow = false;
  existsSyncCalls = [];
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
    },
    execSync: (cmd: string, options?: { encoding?: string; stdio?: unknown }): string | Buffer => {
      execSyncCalls.push(cmd);
      if (cmd.includes("list-sessions")) {
        if (mockExecSyncShouldThrow) {
          throw new Error("tmux: server not running");
        }
        const output = mockTmuxSessions.join("\n") + "\n";
        if (options?.encoding === "utf-8") {
          return output;
        }
        return Buffer.from(output, "utf-8");
      }
      if (cmd.includes("kill-session")) {
        if (cmd.includes("fail-id") || mockKillShouldThrow) {
          throw new Error("Simulated kill failure");
        }
        if (options?.encoding === "utf-8") {
          return "";
        }
        return Buffer.from("", "utf-8");
      }
      if (options?.encoding === "utf-8") {
        return "";
      }
      return Buffer.from("", "utf-8");
    },
    execFileSync: (file: string, args?: string[], options?: { encoding?: string; stdio?: unknown }): string | Buffer => {
      // Mirror the execSync mock but for the no-shell execFileSync(file, argv) form.
      // Reconstruct the canonical command string (quoting values after -t/-F/-s/-c)
      // so existing session-gc assertions keep working against execSyncCalls.
      const argv = Array.isArray(args) ? args : [];
      const valueFlags = new Set(["-t", "-F", "-s", "-c"]);
      const parts = [file];
      for (let i = 0; i < argv.length; i++) {
        parts.push(i > 0 && valueFlags.has(argv[i - 1]) ? `"${argv[i]}"` : argv[i]);
      }
      const cmd = parts.join(" ");
      execSyncCalls.push(cmd);
      if (argv[0] === "list-sessions") {
        if (mockExecSyncShouldThrow) {
          throw new Error("tmux: server not running");
        }
        const output = mockTmuxSessions.join("\n") + "\n";
        return options?.encoding === "utf-8" ? output : Buffer.from(output, "utf-8");
      }
      if (argv[0] === "kill-session") {
        if (cmd.includes("fail-id") || mockKillShouldThrow) {
          throw new Error("Simulated kill failure");
        }
        return options?.encoding === "utf-8" ? "" : Buffer.from("", "utf-8");
      }
      return options?.encoding === "utf-8" ? "" : Buffer.from("", "utf-8");
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
    readFileSync: (filePath: string, encoding?: string) => {
      if (mockFsReadShouldThrow) {
        throw new Error("Simulated read error");
      }
      if (mockFsFiles.has(filePath)) {
        return mockFsFiles.get(filePath)!;
      }
      if (filePath.endsWith("output.txt")) {
        return "Final output from agy";
      }
      return mockAuditLogContent;
    },
    writeFileSync: (filePath: string, data: string, encoding?: string) => {
      if (mockFsWriteShouldThrow) {
        throw new Error("Simulated write error");
      }
      mockFsFiles.set(filePath, data);
    },
    mkdirSync: (filePath: string, options?: { recursive?: boolean }) => {
      mockFsDirs.add(filePath);
    },
    existsSync: (filePath: string) => {
      existsSyncCalls.push(filePath);
      const normalized = filePath.replace(/\\/g, "/");
      if (normalized.endsWith("exit_code.txt")) {
        const parts = normalized.split("/");
        const idx = parts.indexOf("exit_code.txt");
        if (idx > 0) {
          const sessionName = parts[idx - 1];
          return mockExitCodeSessions.has(sessionName);
        }
        return false;
      }
      if (mockFsFiles.has(filePath)) {
        return true;
      }
      if (mockFsDirs.has(filePath)) {
        return true;
      }
      if (filePath.endsWith("hooks-audit.jsonl")) {
        return mockExistsSyncResult;
      }
      if (filePath.endsWith("output.txt") || filePath.includes("/jobs/")) {
        return true;
      }
      return false;
    },
    appendFileSync: (filePath: string, data: string, encoding?: string) => {
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
