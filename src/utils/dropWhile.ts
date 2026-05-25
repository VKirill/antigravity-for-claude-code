/**
 * Skips elements from the start of the input array while predicate(item) is truthy.
 * Returns the remaining elements starting at the first falsy result.
 *
 * @param array The array to iterate over.
 * @param predicate The function invoked per iteration.
 * @returns A new array of the remaining elements.
 * @throws An error if predicate is not a function.
 */
export function dropWhile<T>(array: T[], predicate: (item: T) => boolean): T[] {
  if (typeof predicate !== "function") {
    throw new Error("dropWhile: predicate must be a function");
  }

  let index = 0;
  while (index < array.length && predicate(array[index])) {
    index++;
  }

  return array.slice(index);
}
