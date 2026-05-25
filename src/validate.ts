import { z } from "zod";

/**
 * Validates unknown data against a Zod schema.
 *
 * @param data - The unknown data to validate.
 * @param schema - The Zod schema to validate against.
 * @returns The validated and typed data.
 * @throws {ZodError} If validation fails.
 */
export function validate<T>(data: unknown, schema: z.ZodType<T>): T {
  return schema.parse(data);
}
