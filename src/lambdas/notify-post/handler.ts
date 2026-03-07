import { sendBlogNotification } from "../../shared/email";

export const handler = async (event: any) => {
  const { title, url } = event;

  console.log("Sending notification for post:", title);

  await sendBlogNotification("contacto@matiasgaleano.dev", title, url);

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Notification sent",
      title,
      url,
    }),
  };
};
