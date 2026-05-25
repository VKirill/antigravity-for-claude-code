/**
 * Returns a new array with duplicates removed, using a key function to determine uniqueness.
 * Preserves the order of the first occurrence of each unique item.
 *
 * @param array The array to filter.
 * @param keyFn The function mapping each item to its unique key.
 * @returns A new array containing only unique items.
 * @throws An error if keyFn is not a function.
 */
export function uniqueBy<T, K>(array: T[], keyFn: (item: T) => K): T[] {
  if (typeof keyFn !== "function") {
    throw new Error("uniqueBy: keyFn must be a function");
  }

  const seen = new Set<K>();
  const result: T[] = [];

  for (const item of array) {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }

  return result;
}
