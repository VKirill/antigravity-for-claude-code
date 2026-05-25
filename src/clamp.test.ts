import { test, expect, describe } from "bun:test";
import { clamp } from "./utils/clamp.ts";

describe("clamp", () => {
  test("value < min returns min", () => {
    expect(clamp(2, 5, 10)).toBe(5);
  });

  test("value within [min, max] returns value", () => {
    expect(clamp(7, 5, 10)).toBe(7);
  });

  test("value > max returns max", () => {
    expect(clamp(12, 5, 10)).toBe(10);
  });

  test("value === min returns min", () => {
    expect(clamp(5, 5, 10)).toBe(5);
  });

  test("value === max returns max", () => {
    expect(clamp(10, 5, 10)).toBe(10);
  });
});
