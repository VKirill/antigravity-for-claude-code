/**
 * Flattens a nested array up to the specified depth.
 *
 * @param array The array to flatten.
 * @param depth The depth level specifying how deep a nested array structure should be flattened. Defaults to 1.
 * @returns A new flattened array.
 * @throws An error if depth is less than 0.
 */
export function flatten(array: readonly any[], depth: number = 1): any[] {
  if (depth < 0) {
    throw new Error("flatten: depth must be at least 0");
  }

  const result: any[] = [];

  for (const item of array) {
    if (Array.isArray(item) && depth > 0) {
      result.push(...flatten(item, depth === Infinity ? Infinity : depth - 1));
    } else {
      result.push(item);
    }
  }

  return result;
}
