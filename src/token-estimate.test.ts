import { test, expect, describe } from "bun:test";
import { estimateTokens } from "./utils/token-estimate.ts";

describe("estimateTokens", () => {
  test("returns 0 for empty string, null, or undefined", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens(null)).toBe(0);
    expect(estimateTokens(undefined)).toBe(0);
  });

  test("rounds up for normal text", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
    expect(estimateTokens("a")).toBe(1);
    expect(estimateTokens("ab")).toBe(1);
    expect(estimateTokens("abc")).toBe(1);
    expect(estimateTokens("abcdefgh")).toBe(2);
    expect(estimateTokens("abcdefghi")).toBe(3);
  });

  test("estimates large strings correctly", () => {
    const largeStr = "a".repeat(1000);
    expect(estimateTokens(largeStr)).toBe(250);

    const largeStrOff = "a".repeat(1001);
    expect(estimateTokens(largeStrOff)).toBe(251);
  });
});
