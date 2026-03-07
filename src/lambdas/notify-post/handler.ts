import { sendBlogNotification } from "../../shared/email";
import {
  jsonResponse,
  readStringField,
  type LambdaResponse,
} from "../../shared/lambda";
import { listSubscriberEmails } from "../../shared/subscribers";

type NotifyPostEvent = {
  title?: string;
  url?: string;
  excerpt?: string;
  date?: string;
  tags?: string[];
};

export const handler = async (
  event: NotifyPostEvent,
): Promise<LambdaResponse> => {
  const title = readStringField(event.title);
  const url = readStringField(event.url);
  const excerpt = readStringField(event.excerpt);
  const date = readStringField(event.date);
  const tags = Array.isArray(event.tags)
    ? event.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
    : [];

  if (!title || !url) {
    return jsonResponse(400, { error: "Title and url are required" });
  }

  console.log("Sending notification for post:", title);

  const subscribers = await listSubscriberEmails();

  await Promise.all(
    subscribers.map(async (subscriberEmail) => {
      const notificationInput = {
        to: subscriberEmail,
        title,
        url,
        tags,
        ...(excerpt ? { excerpt } : {}),
        ...(date ? { date } : {}),
      };

      return sendBlogNotification(notificationInput);
    }),
  );

  return jsonResponse(200, {
    message: "Notification sent",
    title,
    url,
    recipients: subscribers.length,
  });
};
