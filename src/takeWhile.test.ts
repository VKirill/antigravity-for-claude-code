import { test, expect, describe } from "bun:test";
import { takeWhile } from "./utils/takeWhile.ts";

describe("takeWhile", () => {
  test("basic case: stops at first falsy element", () => {
    const arr = [1, 2, 3, 4, 5];
    const predicate = (x: number) => x < 4;
    expect(takeWhile(arr, predicate)).toEqual([1, 2, 3]);
  });

  test("empty array: returns an empty array", () => {
    const arr: number[] = [];
    const predicate = (x: number) => x < 4;
    expect(takeWhile(arr, predicate)).toEqual([]);
  });

  test("predicate immediately false: returns an empty array", () => {
    const arr = [4, 1, 2, 3];
    const predicate = (x: number) => x < 4;
    expect(takeWhile(arr, predicate)).toEqual([]);
  });

  test("predicate always true: returns a copy of all elements", () => {
    const arr = [1, 2, 3];
    const predicate = (x: number) => x < 10;
    const result = takeWhile(arr, predicate);
    expect(result).toEqual([1, 2, 3]);
    expect(result).not.toBe(arr); // Ensure it returns a copy
  });

  test("non-function predicate: throws an error", () => {
    const arr = [1, 2, 3];
    // @ts-expect-error - testing invalid parameter types
    expect(() => takeWhile(arr, undefined)).toThrow("takeWhile: predicate must be a function");
    // @ts-expect-error - testing invalid parameter types
    expect(() => takeWhile(arr, null)).toThrow("takeWhile: predicate must be a function");
    // @ts-expect-error - testing invalid parameter types
    expect(() => takeWhile(arr, {} as any)).toThrow("takeWhile: predicate must be a function");
  });

  test("input array is not mutated", () => {
    const arr = [1, 2, 3, 4];
    const original = [...arr];
    takeWhile(arr, (x) => x < 3);
    expect(arr).toEqual(original);
  });
});
