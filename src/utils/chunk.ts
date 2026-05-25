/**
 * Splits an array into consecutive sub-arrays of length <= size.
 *
 * @param array The array to split.
 * @param size The size of each chunk.
 * @returns An array of chunks.
 * @throws An error if size is less than 1.
 */
export function chunk<T>(array: T[], size: number): T[][] {
  if (size < 1) {
    throw new Error("chunk: size must be at least 1");
  }

  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}
