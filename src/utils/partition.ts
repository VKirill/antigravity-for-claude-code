/**
 * Splits an array into two arrays, one containing elements that satisfy the predicate,
 * and the other containing elements that do not.
 * Preserves the original order of the elements.
 *
 * @param array The array to partition.
 * @param predicate The function called per iteration to test elements.
 * @returns A tuple of two arrays: the first contains elements that passed the predicate, the second contains elements that failed.
 * @throws An error if predicate is not a function.
 */
export function partition<T>(array: T[], predicate: (item: T) => boolean): [T[], T[]] {
  if (typeof predicate !== "function") {
    throw new Error("partition: predicate must be a function");
  }

  const passed: T[] = [];
  const failed: T[] = [];

  for (const item of array) {
    if (predicate(item)) {
      passed.push(item);
    } else {
      failed.push(item);
    }
  }

  return [passed, failed];
}
