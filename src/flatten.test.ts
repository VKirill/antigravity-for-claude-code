import { test, expect, describe } from "bun:test";
import { flatten } from "./utils/flatten.ts";

describe("flatten", () => {
  test("default depth=1: flattens one level", () => {
    const input = [1, [2, [3, [4]]], 5];
    const result = flatten(input);
    expect(result).toEqual([1, 2, [3, [4]], 5]);
  });

  test("depth=2: flattens two levels", () => {
    const input = [1, [2, [3, [4]]], 5];
    const result = flatten(input, 2);
    expect(result).toEqual([1, 2, 3, [4], 5]);
  });

  test("deep nesting via depth=Infinity: flattens fully", () => {
    const input = [1, [2, [3, [4]]], 5];
    const result = flatten(input, Infinity);
    expect(result).toEqual([1, 2, 3, 4, 5]);
  });

  test("empty array returns []", () => {
    expect(flatten([])).toEqual([]);
  });

  test("already-flat array returned as-is (but new instance)", () => {
    const input = [1, 2, 3];
    const result = flatten(input);
    expect(result).toEqual([1, 2, 3]);
    expect(result).not.toBe(input);
  });

  test("depth < 0 throws an error", () => {
    expect(() => flatten([1, 2, 3], -1)).toThrow();
  });

  test("input array is not mutated", () => {
    const input = [1, [2, 3], 4];
    const originalInput = [1, [2, 3], 4];
    flatten(input);
    expect(input).toEqual(originalInput);
  });
});
