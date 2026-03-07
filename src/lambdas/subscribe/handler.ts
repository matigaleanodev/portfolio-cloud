import { getSubscribers, saveSubscribers } from "../../shared/subscribers";
import {
  jsonResponse,
  parseJsonBody,
  readStringField,
  type LambdaEvent,
  type LambdaResponse,
} from "../../shared/lambda";

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
  const email = getEmail(event)?.trim().toLowerCase();

  if (!email) {
    return jsonResponse(400, { error: "Email required" });
  }

  const subscribers = await getSubscribers();

  if (subscribers.includes(email)) {
    return jsonResponse(200, { message: "Already subscribed" });
  }

  subscribers.push(email);

  await saveSubscribers(subscribers);

  console.log("Subscribed:", email);

  return jsonResponse(200, { message: "Subscribed successfully" });
};
