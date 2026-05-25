export interface UsageSummary {
  since: string;
  jobsStarted: number;
  jobsSucceeded: number;
  jobsFailed: number;
  totalPromptChars: number;
  totalOutputChars: number;
  totalAgySeconds: number;
  totalSuccessAgySeconds: number;
  estimatedTokens: number;
}

/**
 * Returns a neat, human-readable multi-line text table representing the usage summary.
 * All label columns are aligned. Large numbers are formatted with thousands separators.
 * Pure function, no I/O, no side effects.
 */
export function formatUsageSummary(s: UsageSummary): string {
  const minutes = s.totalAgySeconds / 60;
  const minutesFormatted = minutes.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const timeVal = `${s.totalAgySeconds.toLocaleString("en-US")}s (${minutesFormatted}m)`;

  const avgSuccessSec = s.jobsSucceeded > 0 ? (s.totalSuccessAgySeconds || 0) / s.jobsSucceeded : 0;
  const avgSuccessVal = avgSuccessSec.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 3 });

  const rows = [
    { label: "Since", value: s.since },
    { label: "Jobs Started", value: s.jobsStarted.toLocaleString("en-US") },
    { label: "Jobs Succeeded", value: s.jobsSucceeded.toLocaleString("en-US") },
    { label: "Jobs Failed", value: s.jobsFailed.toLocaleString("en-US") },
    { label: "Total Prompt Chars", value: s.totalPromptChars.toLocaleString("en-US") },
    { label: "Total Output Chars", value: s.totalOutputChars.toLocaleString("en-US") },
    { label: "Total Agy Seconds", value: timeVal },
    { label: "Average successful job duration (s)", value: avgSuccessVal },
    { label: "Estimated Tokens", value: s.estimatedTokens.toLocaleString("en-US") },
  ];

  const maxLabelLen = Math.max(...rows.map(r => r.label.length));

  const formattedRows = rows.map(r => {
    const pad = " ".repeat(maxLabelLen - r.label.length);
    return `${r.label}${pad}: ${r.value}`;
  });

  const header = "agy usage (all-time)";
  const lineLength = Math.max(header.length, ...formattedRows.map(r => r.length));
  const divider = "-".repeat(lineLength);

  return [header, divider, ...formattedRows, divider].join("\n");
}
