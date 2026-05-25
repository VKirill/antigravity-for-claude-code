import { test, expect, describe } from "bun:test";
import { dropWhile } from "./utils/dropWhile.ts";

describe("dropWhile", () => {
  test("basic case: drops leading truthy elements, returns the remainder", () => {
    const arr = [1, 2, 3, 4, 5];
    const predicate = (x: number) => x < 4;
    expect(dropWhile(arr, predicate)).toEqual([4, 5]);
  });

  test("empty array: returns an empty array", () => {
    const arr: number[] = [];
    const predicate = (x: number) => x < 4;
    expect(dropWhile(arr, predicate)).toEqual([]);
  });

  test("predicate immediately false: returns a copy of all elements", () => {
    const arr = [4, 1, 2, 3];
    const predicate = (x: number) => x < 4;
    const result = dropWhile(arr, predicate);
    expect(result).toEqual([4, 1, 2, 3]);
    expect(result).not.toBe(arr); // Ensure it returns a copy
  });

  test("predicate always true: returns an empty array", () => {
    const arr = [1, 2, 3];
    const predicate = (x: number) => x < 10;
    expect(dropWhile(arr, predicate)).toEqual([]);
  });

  test("non-function predicate: throws an error", () => {
    const arr = [1, 2, 3];
    // @ts-expect-error - testing invalid parameter types
    expect(() => dropWhile(arr, undefined)).toThrow("dropWhile: predicate must be a function");
    // @ts-expect-error - testing invalid parameter types
    expect(() => dropWhile(arr, null)).toThrow("dropWhile: predicate must be a function");
    // @ts-expect-error - testing invalid parameter types
    expect(() => dropWhile(arr, {} as any)).toThrow("dropWhile: predicate must be a function");
  });

  test("input array is not mutated", () => {
    const arr = [1, 2, 3, 4];
    const original = [...arr];
    dropWhile(arr, (x) => x < 3);
    expect(arr).toEqual(original);
  });
});
