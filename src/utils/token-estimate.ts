/**
 * Estimates the number of tokens in a given text based on character length.
 * Calculation: Math.ceil(text.length / 4)
 * Returns 0 for empty string, null, or undefined.
 *
 * @param text The input text to estimate tokens for.
 * @returns The estimated token count.
 */
export function estimateTokens(text: string | null | undefined): number {
  if (text === null || text === undefined || text === "") {
    return 0;
  }
  return Math.ceil(text.length / 4);
}
