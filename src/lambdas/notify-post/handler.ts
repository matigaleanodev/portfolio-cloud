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
};

export const handler = async (
  event: NotifyPostEvent,
): Promise<LambdaResponse> => {
  const title = readStringField(event.title);
  const url = readStringField(event.url);

  if (!title || !url) {
    return jsonResponse(400, { error: "Title and url are required" });
  }

  console.log("Sending notification for post:", title);

  const subscribers = await listSubscriberEmails();

  await Promise.all(
    subscribers.map(async (subscriberEmail) =>
      sendBlogNotification(subscriberEmail, title, url),
    ),
  );

  return jsonResponse(200, {
    message: "Notification sent",
    title,
    url,
    recipients: subscribers.length,
  });
};
