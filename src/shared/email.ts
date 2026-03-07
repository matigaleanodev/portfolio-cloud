import "dotenv/config";
import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendBlogNotification(
  to: string,
  title: string,
  url: string,
) {
  return resend.emails.send({
    from: process.env.BLOG_FROM_EMAIL!,
    to,
    subject: `New article — ${title}`,
    html: `
      <h2>New article published</h2>
      <p>${title}</p>
      <p>
        <a href="${url}">Read the article</a>
      </p>
    `,
  });
}
