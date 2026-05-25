import { formatUsageSummary } from "../utils/usage-format.ts";
import { getUsageSummary } from "../utils/usage-store.ts";

export async function handleGetUsageStats() {
  const summary = getUsageSummary();
  const text = formatUsageSummary(summary);
  return {
    content: [
      {
        type: "text",
        text,
      }
    ]
  };
}
