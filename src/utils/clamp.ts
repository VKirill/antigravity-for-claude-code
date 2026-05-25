/**
 * Constrains a numeric value to be within the specified [min, max] range.
 *
 * @param value The input value to clamp.
 * @param min The minimum allowed value.
 * @param max The maximum allowed value.
 * @returns The clamped value.
 */
export function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}
