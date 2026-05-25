import { test, expect, describe } from "bun:test";
import { uniqueBy } from "./utils/uniqueBy.ts";
import { uniqueBy as uniqueByFromIndex } from "./index.ts";

describe("uniqueBy", () => {
  test("returns a new array with duplicates collapsed by keyFn(item)", () => {
    const input = [1.2, 2.3, 1.5, 2.6, 3.1];
    const keyFn = Math.floor;
    const result = uniqueBy(input, keyFn);
    expect(result).toEqual([1.2, 2.3, 3.1]);
    expect(result).not.toBe(input); // Check that it is a NEW array
  });

  test("preserves the order of first occurrence", () => {
    const input = ["apple", "banana", "apricot", "cherry", "blueberry"];
    // Uniqueness by first letter
    const result = uniqueBy(input, (word) => word[0]);
    expect(result).toEqual(["apple", "banana", "cherry"]);
  });

  test("empty array input returns []", () => {
    const result = uniqueBy([], (x) => x);
    expect(result).toEqual([]);
  });

  test("different objects sharing the same key: the FIRST one is kept", () => {
    const obj1 = { id: 1, name: "first" };
    const obj2 = { id: 2, name: "second" };
    const obj3 = { id: 1, name: "third" }; // duplicate key with obj1
    const input = [obj1, obj2, obj3];

    const result = uniqueBy(input, (obj) => obj.id);
    expect(result).toEqual([obj1, obj2]);
    expect(result[0]).toBe(obj1); // Must be strictly the first object
  });

  test("keyFn that is not a function throws an error", () => {
    const input = [1, 2, 3];
    // @ts-expect-error - Testing runtime error throwing
    expect(() => uniqueBy(input, null)).toThrow("uniqueBy: keyFn must be a function");
    // @ts-expect-error - Testing runtime error throwing
    expect(() => uniqueBy(input, undefined)).toThrow("uniqueBy: keyFn must be a function");
    // @ts-expect-error - Testing runtime error throwing
    expect(() => uniqueBy(input, "not-a-function")).toThrow("uniqueBy: keyFn must be a function");
  });

  test("is exported from index.ts", () => {
    expect(uniqueByFromIndex).toBe(uniqueBy);
  });
});
