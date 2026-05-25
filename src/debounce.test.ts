import { test, expect, describe, mock, jest } from "bun:test";
import { debounce } from "./debounce.ts";

describe("debounce", () => {
  test("fake timers check: burst of rapid calls fires fn exactly once", () => {
    jest.useFakeTimers();
    try {
      const fn = mock((x: number) => x);
      const debounced = debounce(fn, 100);

      debounced(1);
      debounced(2);
      debounced(3);

      expect(fn).toHaveBeenCalledTimes(0);

      jest.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenLastCalledWith(3);
    } finally {
      jest.useRealTimers();
    }
  });

  test("fake timers check: fn fires only after waitMs elapses, not before", () => {
    jest.useFakeTimers();
    try {
      const fn = mock(() => {});
      const debounced = debounce(fn, 100);

      debounced();

      jest.advanceTimersByTime(99);
      expect(fn).toHaveBeenCalledTimes(0);

      jest.advanceTimersByTime(1);
      expect(fn).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  test("fake timers check: new call during the wait resets the timer", () => {
    jest.useFakeTimers();
    try {
      const fn = mock(() => {});
      const debounced = debounce(fn, 100);

      debounced();

      jest.advanceTimersByTime(50);
      expect(fn).toHaveBeenCalledTimes(0);

      debounced();

      jest.advanceTimersByTime(60);
      expect(fn).toHaveBeenCalledTimes(0);

      jest.advanceTimersByTime(40);
      expect(fn).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  test("preserves 'this' context and forwards call arguments", () => {
    jest.useFakeTimers();
    try {
      const context = { value: 42 };
      let calledContext: any = null;
      let calledArgs: any[] = [];

      const fn = function (this: any, ...args: any[]) {
        calledContext = this;
        calledArgs = args;
      };

      const debounced = debounce(fn, 100);

      debounced.call(context, "a", "b");

      jest.advanceTimersByTime(100);

      expect(calledContext).toBe(context);
      expect(calledArgs).toEqual(["a", "b"]);
    } finally {
      jest.useRealTimers();
    }
  });
});
