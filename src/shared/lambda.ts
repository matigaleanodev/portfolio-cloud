import type { LambdaResponse } from "./types";

export type { LambdaEvent, LambdaResponse } from "./types";

export function jsonResponse(
  statusCode: number,
  payload: Record<string, unknown>,
): LambdaResponse {
  return {
    statusCode,
    body: JSON.stringify(payload),
  };
}

export function parseJsonBody(
  body: string | null | undefined,
): Record<string, unknown> | null {
  if (!body) {
    return null;
  }

  try {
    const parsed = JSON.parse(body);

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }

    return null;
  } catch {
    return null;
  }
}

export function readStringField(
  value: unknown,
): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}
