/**
 * Creates a debounced function that delays invoking `fn` until after `waitMs`
 * milliseconds have elapsed since the last time the debounced function was invoked.
 *
 * @param fn - The function to debounce.
 * @param waitMs - The number of milliseconds to delay.
 * @returns The new debounced function.
 */
export function debounce<Args extends any[], This>(
  fn: (this: This, ...args: Args) => any,
  waitMs: number
): (this: This, ...args: Args) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function (this: This, ...args: Args): void {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn.apply(this, args);
    }, waitMs);
  };
}
