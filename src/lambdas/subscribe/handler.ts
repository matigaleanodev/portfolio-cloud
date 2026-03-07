import {
  jsonResponse,
  parseJsonBody,
  readStringField,
} from "../../shared/lambda";
import { logInfo } from "../../shared/logger";
import {
  createSubscriber,
  isValidSubscriberEmail,
  normalizeSubscriberEmail,
} from "../../shared/subscribers";
import type { LambdaEvent, LambdaResponse } from "../../shared/types";

type SubscribeEvent = LambdaEvent & {
  email?: string;
};

function getEmail(event: SubscribeEvent): string | undefined {
  const body = parseJsonBody(event.body);

  return readStringField(event.email) ?? readStringField(body?.email);
}

export const handler = async (
  event: SubscribeEvent,
): Promise<LambdaResponse> => {
  const rawEmail = getEmail(event);
  const email = rawEmail ? normalizeSubscriberEmail(rawEmail) : "";

  if (!email) {
    return jsonResponse(400, { error: "Email required" });
  }

  if (!isValidSubscriberEmail(email)) {
    return jsonResponse(400, { error: "Invalid email" });
  }

  const result = await createSubscriber(email);

  if (result === "exists") {
    return jsonResponse(200, { message: "Already subscribed" });
  }

  logInfo("Subscribed", { email });

  return jsonResponse(200, {
    message: "Subscribed successfully",
    email,
  });
};
