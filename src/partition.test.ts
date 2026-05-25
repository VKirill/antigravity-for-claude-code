import { test, expect, describe } from "bun:test";
import { partition } from "./utils/partition.ts";

describe("partition", () => {
  test("basic case (correct split into [passed, failed])", () => {
    const input = [1, 2, 3, 4, 5, 6];
    const isEven = (x: number) => x % 2 === 0;
    expect(partition(input, isEven)).toEqual([
      [2, 4, 6],
      [1, 3, 5],
    ]);
  });

  test("empty array -> [[], []]", () => {
    const input: number[] = [];
    const isEven = (x: number) => x % 2 === 0;
    expect(partition(input, isEven)).toEqual([[], []]);
  });

  test("predicate immediately false (all fail) -> [[], all]", () => {
    const input = [1, 2, 3];
    const alwaysFalse = () => false;
    expect(partition(input, alwaysFalse)).toEqual([[], [1, 2, 3]]);
  });

  test("predicate always true (all pass) -> [all, []]", () => {
    const input = [1, 2, 3];
    const alwaysTrue = () => true;
    expect(partition(input, alwaysTrue)).toEqual([[1, 2, 3], []]);
  });

  test("non-function predicate -> throws", () => {
    const input = [1, 2, 3];
    // @ts-expect-error - Testing runtime error throwing
    expect(() => partition(input, null as any)).toThrow("partition: predicate must be a function");
    // @ts-expect-error - Testing runtime error throwing
    expect(() => partition(input, undefined as any)).toThrow("partition: predicate must be a function");
    // @ts-expect-error - Testing runtime error throwing
    expect(() => partition(input, "not-a-function" as any)).toThrow("partition: predicate must be a function");
  });

  test("input array is not mutated", () => {
    const input = [1, 2, 3, 4];
    const originalInput = [...input];
    const isEven = (x: number) => x % 2 === 0;

    partition(input, isEven);

    expect(input).toEqual(originalInput);
  });
});
