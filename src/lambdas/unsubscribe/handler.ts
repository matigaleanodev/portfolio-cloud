import {
  jsonResponse,
  parseJsonBody,
  readStringField,
} from "../../shared/lambda";
import { logInfo } from "../../shared/logger";
import {
  deleteSubscriber,
  isValidSubscriberEmail,
  normalizeSubscriberEmail,
} from "../../shared/subscribers";
import type { LambdaEvent, LambdaResponse } from "../../shared/types";

type UnsubscribeEvent = LambdaEvent & {
  email?: string;
};

function getEmail(event: UnsubscribeEvent): string | undefined {
  const body = parseJsonBody(event.body);

  return (
    readStringField(event.email) ??
    readStringField(event.queryStringParameters?.email) ??
    readStringField(body?.email)
  );
}

export const handler = async (
  event: UnsubscribeEvent,
): Promise<LambdaResponse> => {
  const rawEmail = getEmail(event);
  const normalizedEmail = rawEmail ? normalizeSubscriberEmail(rawEmail) : "";

  if (!normalizedEmail) {
    return jsonResponse(400, { error: "Email required" });
  }

  if (!isValidSubscriberEmail(normalizedEmail)) {
    return jsonResponse(400, { error: "Invalid email" });
  }

  const result = await deleteSubscriber(normalizedEmail);

  if (result === "missing") {
    return jsonResponse(200, { message: "Already unsubscribed" });
  }

  logInfo("Unsubscribed", { email: normalizedEmail });

  return jsonResponse(200, {
    message: "Unsubscribed successfully",
    email: normalizedEmail,
  });
};
