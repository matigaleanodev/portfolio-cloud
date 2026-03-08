import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import type { LambdaResponse } from "./types";

const lambda = new LambdaClient({});

function decodePayload(payload?: Uint8Array): string {
  if (!payload || payload.length === 0) {
    return "";
  }

  return Buffer.from(payload).toString("utf-8");
}

function isLambdaResponse(value: unknown): value is LambdaResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return typeof candidate.statusCode === "number" && typeof candidate.body === "string";
}

export async function invokeLambda<TPayload>(
  functionName: string,
  payload: TPayload,
): Promise<LambdaResponse> {
  const response = await lambda.send(
    new InvokeCommand({
      FunctionName: functionName,
      Payload: Buffer.from(JSON.stringify(payload)),
    }),
  );

  const rawPayload = decodePayload(response.Payload);

  if (response.FunctionError) {
    throw new Error(
      rawPayload || `Lambda invocation failed for ${functionName}: ${response.FunctionError}`,
    );
  }

  const parsedPayload: unknown = rawPayload ? JSON.parse(rawPayload) : null;

  if (!isLambdaResponse(parsedPayload)) {
    throw new Error(`Unexpected Lambda response shape from ${functionName}`);
  }

  return parsedPayload;
}

export function assertLambdaSuccess(
  functionName: string,
  response: LambdaResponse,
): void {
  if (response.statusCode >= 400) {
    throw new Error(`Lambda ${functionName} returned ${response.statusCode}: ${response.body}`);
  }
}
