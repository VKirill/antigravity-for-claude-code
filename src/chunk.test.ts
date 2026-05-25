import { test, expect, describe } from "bun:test";
import { chunk } from "./utils/chunk.ts";

describe("chunk", () => {
  test("even division: splits array evenly into chunks", () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
  });

  test("remainder in last chunk: splits array with remainder in last chunk", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  test("empty array: returns an empty array", () => {
    expect(chunk([], 2)).toEqual([]);
  });

  test("size=1: returns single element chunks", () => {
    expect(chunk([1, 2, 3], 1)).toEqual([[1], [2], [3]]);
  });

  test("size < 1 throws an error", () => {
    expect(() => chunk([1, 2, 3], 0)).toThrow("chunk: size must be at least 1");
    expect(() => chunk([1, 2, 3], -1)).toThrow("chunk: size must be at least 1");
  });
});
