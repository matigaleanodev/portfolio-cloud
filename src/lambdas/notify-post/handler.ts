import { sendBlogNotification } from "../../shared/email";
import {
  jsonResponse,
  readStringField,
  type LambdaResponse,
} from "../../shared/lambda";

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

  await sendBlogNotification("contacto@matiasgaleano.dev", title, url);

  return jsonResponse(200, {
    message: "Notification sent",
    title,
    url,
  });
};
