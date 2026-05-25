import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

export interface UsageSummary {
  since: string;
  jobsStarted: number;
  jobsSucceeded: number;
  jobsFailed: number;
  totalPromptChars: number;
  totalOutputChars: number;
  totalAgySeconds: number;
  estimatedTokens: number;
}

function getProjectCwd(): string {
  return process.env.PWD || process.cwd();
}

function getUsageFilePath(): string {
  return join(getProjectCwd(), ".claude", "agy-usage.json");
}

function parseUsageFile(): UsageSummary {
  const filePath = getUsageFilePath();
  const defaultSummary: UsageSummary = {
    since: "",
    jobsStarted: 0,
    jobsSucceeded: 0,
    jobsFailed: 0,
    totalPromptChars: 0,
    totalOutputChars: 0,
    totalAgySeconds: 0,
    estimatedTokens: 0,
  };

  try {
    if (!existsSync(filePath)) {
      return defaultSummary;
    }
    const data = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(data) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") {
      return defaultSummary;
    }

    return {
      since: typeof parsed.since === "string" ? parsed.since : "",
      jobsStarted: typeof parsed.jobsStarted === "number" ? parsed.jobsStarted : 0,
      jobsSucceeded: typeof parsed.jobsSucceeded === "number" ? parsed.jobsSucceeded : 0,
      jobsFailed: typeof parsed.jobsFailed === "number" ? parsed.jobsFailed : 0,
      totalPromptChars: typeof parsed.totalPromptChars === "number" ? parsed.totalPromptChars : 0,
      totalOutputChars: typeof parsed.totalOutputChars === "number" ? parsed.totalOutputChars : 0,
      totalAgySeconds: typeof parsed.totalAgySeconds === "number" ? parsed.totalAgySeconds : 0,
      estimatedTokens: typeof parsed.estimatedTokens === "number" ? parsed.estimatedTokens : 0,
    };
  } catch (error: unknown) {
    return defaultSummary;
  }
}

function writeUsageSummary(summary: UsageSummary): void {
  try {
    const filePath = getUsageFilePath();
    const dirPath = join(getProjectCwd(), ".claude");
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
    }
    writeFileSync(filePath, JSON.stringify(summary, null, 2), "utf-8");
  } catch (error: unknown) {
    // Soft-fail: swallow write errors
  }
}

export function recordJobStart(i: { promptChars: number }): void {
  const summary = parseUsageFile();
  if (!summary.since) {
    summary.since = new Date().toISOString();
  }
  summary.jobsStarted += 1;
  summary.totalPromptChars += i.promptChars;
  writeUsageSummary(summary);
}

export function recordJobEnd(i: {
  success: boolean;
  outputChars: number;
  durationMs: number;
  estimatedTokens: number;
}): void {
  const summary = parseUsageFile();
  if (!summary.since) {
    summary.since = new Date().toISOString();
  }
  if (i.success) {
    summary.jobsSucceeded += 1;
  } else {
    summary.jobsFailed += 1;
  }
  summary.totalOutputChars += i.outputChars;
  summary.totalAgySeconds += i.durationMs / 1000;
  summary.estimatedTokens += i.estimatedTokens;
  writeUsageSummary(summary);
}

export function getUsageSummary(): UsageSummary {
  return parseUsageFile();
}
