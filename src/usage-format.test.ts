import { test, expect, describe } from "bun:test";
import { formatUsageSummary, type UsageSummary } from "./utils/usage-format.ts";

describe("formatUsageSummary", () => {
  test("renders a zeroed summary without throwing", () => {
    const zeroed: UsageSummary = {
      since: "2026-01-01",
      jobsStarted: 0,
      jobsSucceeded: 0,
      jobsFailed: 0,
      totalPromptChars: 0,
      totalOutputChars: 0,
      totalAgySeconds: 0,
      totalSuccessAgySeconds: 0,
      estimatedTokens: 0,
    };

    const output = formatUsageSummary(zeroed);
    expect(typeof output).toBe("string");
    expect(output).toContain("agy usage (all-time)");
    expect(output).toContain("Since");
    expect(output).toContain("2026-01-01");
    expect(output).toContain("Jobs Started");
    expect(output).toContain("Total Agy Seconds");
    expect(output).toContain("0s (0.0m)");
    // Verified: Average successful job duration (s) is present and defaults to 0.0 without NaN/Infinity
    expect(output).toContain("Average successful job duration (s)");
    expect(output).toContain("0.0");
  });

  test("renders a sample summary with correct labels and formatted numbers", () => {
    const sample: UsageSummary = {
      since: "2026-05-25T15:30:00Z",
      jobsStarted: 1234,
      jobsSucceeded: 1200,
      jobsFailed: 34,
      totalPromptChars: 9876543,
      totalOutputChars: 1234567,
      totalAgySeconds: 90050,
      totalSuccessAgySeconds: 60050,
      estimatedTokens: 2753051,
    };

    const output = formatUsageSummary(sample);

    // Verify key labels are present
    expect(output).toContain("Since");
    expect(output).toContain("Jobs Started");
    expect(output).toContain("Jobs Succeeded");
    expect(output).toContain("Jobs Failed");
    expect(output).toContain("Total Prompt Chars");
    expect(output).toContain("Total Output Chars");
    expect(output).toContain("Total Agy Seconds");
    expect(output).toContain("Average successful job duration (s)");
    expect(output).toContain("Estimated Tokens");

    // Verify numbers are formatted with thousands separators
    expect(output).toContain("1,234");
    expect(output).toContain("1,200");
    expect(output).toContain("34");
    expect(output).toContain("9,876,543");
    expect(output).toContain("1,234,567");
    expect(output).toContain("2,753,051");

    // Verify time formatting (90050 seconds = 1500.833... minutes -> 1500.8m)
    expect(output).toContain("90,050s");
    expect(output).toContain("1,500.8m");

    // Verify average successful job duration formatting (60050 / 1200 = 50.0416... -> 50.042)
    expect(output).toContain("50.042");

    // Verify alignment
    const lines = output.split("\n");
    const contentLines = lines.filter(l => l.includes(":"));
    expect(contentLines.length).toBe(9);

    const colonPositions = contentLines.map(l => l.indexOf(":"));
    const firstColonPos = colonPositions[0];
    expect(firstColonPos).toBeGreaterThan(0);
    for (const pos of colonPositions) {
      expect(pos).toBe(firstColonPos);
    }
  });
});
