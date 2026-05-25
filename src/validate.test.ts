import { test, expect, describe } from "bun:test";
import { z } from "zod";
import { validate } from "./validate.ts";

describe("validate", () => {
  test("returns parsed data when valid object conforms to schema", () => {
    // Arrange
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });
    const input = { name: "Alice", age: 30 };

    // Act
    const result = validate(input, schema);

    // Assert
    expect(result).toEqual({ name: "Alice", age: 30 });
  });

  test("throws when object has invalid field types", () => {
    // Arrange
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });
    const input = { name: "Alice", age: "thirty" };

    // Act & Assert
    expect(() => validate(input, schema)).toThrow();
  });

  test("throws when object is missing required fields", () => {
    // Arrange
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });
    const input = { name: "Alice" };

    // Act & Assert
    expect(() => validate(input, schema)).toThrow();
  });

  test("throws when empty object is validated against schema with required fields", () => {
    // Arrange
    const schema = z.object({
      name: z.string(),
    });
    const input = {};

    // Act & Assert
    expect(() => validate(input, schema)).toThrow();
  });

  test("strips unknown fields by default", () => {
    // Arrange
    const schema = z.object({
      name: z.string(),
    });
    const input = { name: "Alice", extraField: "should be stripped" };

    // Act
    const result = validate(input, schema);

    // Assert
    expect(result).toEqual({ name: "Alice" });
    expect(result).not.toHaveProperty("extraField");
  });

  test("throws when schema is strict and unknown fields are present", () => {
    // Arrange
    const schema = z.object({
      name: z.string(),
    }).strict();
    const input = { name: "Alice", extraField: "should cause error" };

    // Act & Assert
    expect(() => validate(input, schema)).toThrow();
  });

  test("returns validated primitive when valid", () => {
    // Arrange
    const schema = z.string().email();
    const input = "test@example.com";

    // Act
    const result = validate(input, schema);

    // Assert
    expect(result).toBe("test@example.com");
  });

  test("throws when primitive is invalid", () => {
    // Arrange
    const schema = z.string().email();
    const input = "not-an-email";

    // Act & Assert
    expect(() => validate(input, schema)).toThrow();
  });
});
