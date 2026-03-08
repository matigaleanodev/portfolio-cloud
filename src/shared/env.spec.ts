import { afterEach, describe, expect, it } from "vitest";

describe("shared/env", () => {
  afterEach(() => {
    delete process.env.TEST_ENV_VALUE;
  });

  it("returns the raw env value when present", async () => {
    process.env.TEST_ENV_VALUE = "configured";

    const { getEnv } = await import("./env");

    expect(getEnv("TEST_ENV_VALUE")).toBe("configured");
  });

  it("throws when a required env value is missing", async () => {
    const { requireEnv } = await import("./env");

    expect(() => requireEnv("TEST_ENV_VALUE")).toThrowError(
      "TEST_ENV_VALUE is required",
    );
  });
});
