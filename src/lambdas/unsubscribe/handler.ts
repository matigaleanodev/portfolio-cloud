import { getSubscribers, saveSubscribers } from "../../shared/subscribers";
import {
  jsonResponse,
  parseJsonBody,
  readStringField,
  type LambdaEvent,
  type LambdaResponse,
} from "../../shared/lambda";

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
  const normalizedEmail = rawEmail
    ? decodeURIComponent(rawEmail).trim().toLowerCase()
    : "";

  if (!normalizedEmail) {
    return jsonResponse(400, { error: "Email required" });
  }

  const subscribers = await getSubscribers();

  const updated = subscribers.filter(
    (subscriber: string) => subscriber.toLowerCase() !== normalizedEmail,
  );

  await saveSubscribers(updated);

  console.log("Unsubscribed:", normalizedEmail);

  return jsonResponse(200, { message: "Unsubscribed successfully" });
};
