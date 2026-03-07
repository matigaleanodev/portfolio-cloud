import { sendBlogNotification } from "../../shared/email";
import { logInfo } from "../../shared/logger";
import { jsonResponse } from "../../shared/lambda";
import { listSubscriberEmails } from "../../shared/subscribers";
import type { LambdaResponse, NotifyPostEvent, NotifyPostInput } from "../../shared/types";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeNotifyInput(event: NotifyPostEvent): NotifyPostInput | null {
  const title = isNonEmptyString(event.title) ? event.title : null;
  const url = isNonEmptyString(event.url) ? event.url : null;
  const excerpt = isNonEmptyString(event.excerpt) ? event.excerpt : undefined;
  const date = isNonEmptyString(event.date) ? event.date : undefined;
  const tags = Array.isArray(event.tags)
    ? event.tags.filter((tag): tag is string => isNonEmptyString(tag))
    : [];

  if (!title || !url) {
    return null;
  }

  return {
    title,
    url,
    tags,
    ...(excerpt ? { excerpt } : {}),
    ...(date ? { date } : {}),
  };
}

export async function notifyPost(event: NotifyPostEvent): Promise<LambdaResponse> {
  const input = normalizeNotifyInput(event);

  if (!input) {
    return jsonResponse(400, { error: "Title and url are required" });
  }

  logInfo("Sending post notification", { title: input.title });

  const subscribers = await listSubscriberEmails();

  await Promise.all(
    subscribers.map(async (subscriberEmail) =>
      sendBlogNotification({
        to: subscriberEmail,
        ...input,
      }),
    ),
  );

  return jsonResponse(200, {
    message: "Notification sent",
    title: input.title,
    url: input.url,
    recipients: subscribers.length,
  });
}
