/**
 * Collects elements from the start of the input array while predicate(item) is truthy.
 * Stops at the first falsy result and returns what was collected.
 *
 * @param array The array to iterate over.
 * @param predicate The function invoked per iteration.
 * @returns A new array of the collected elements.
 * @throws An error if predicate is not a function.
 */
export function takeWhile<T>(array: T[], predicate: (item: T) => boolean): T[] {
  if (typeof predicate !== "function") {
    throw new Error("takeWhile: predicate must be a function");
  }

  const result: T[] = [];
  for (const item of array) {
    if (predicate(item)) {
      result.push(item);
    } else {
      break;
    }
  }
  return result;
}
