import { describe, expect, it } from "vitest";
import { jsonResponse, parseJsonBody, readStringField } from "./lambda";

describe("shared/lambda", () => {
  it("builds a JSON lambda response", () => {
    expect(jsonResponse(201, { ok: true })).toEqual({
      statusCode: 201,
      body: JSON.stringify({ ok: true }),
    });
  });

  it("parses a valid JSON object body", () => {
    expect(parseJsonBody('{"email":"test@example.com"}')).toEqual({
      email: "test@example.com",
    });
  });

  it("returns null for invalid or unsupported JSON bodies", () => {
    expect(parseJsonBody("")).toBeNull();
    expect(parseJsonBody("not-json")).toBeNull();
    expect(parseJsonBody('["invalid"]')).toBeNull();
  });

  it("returns a string field only when it contains non-whitespace content", () => {
    expect(readStringField(" hello ")).toBe(" hello ");
    expect(readStringField("   ")).toBeUndefined();
    expect(readStringField(123)).toBeUndefined();
  });
});
