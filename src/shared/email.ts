import "dotenv/config";
import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

type BlogNotificationInput = {
  to: string;
  title: string;
  url: string;
  excerpt?: string;
  date?: string;
  tags?: string[];
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDateLabel(date?: string): string | null {
  if (!date) {
    return null;
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsedDate);
}

export async function sendBlogNotification(
  input: BlogNotificationInput,
): Promise<unknown> {
  const from = process.env.BLOG_FROM_EMAIL;
  const safeTitle = escapeHtml(input.title);
  const safeUrl = escapeHtml(input.url);
  const safeExcerpt = input.excerpt ? escapeHtml(input.excerpt) : null;
  const formattedDate = formatDateLabel(input.date);
  const tags = (input.tags ?? []).slice(0, 4).map((tag) => escapeHtml(tag));
  const tagMarkup = tags
    .map(
      (tag) => `
        <span style="display:inline-block;margin:0 8px 8px 0;padding:8px 12px;border:1px solid rgba(31,41,55,0.10);border-radius:999px;background:rgba(255,255,255,0.22);font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#1f2937;">
          ${tag}
        </span>
      `,
    )
    .join("");

  if (!from) {
    throw new Error("BLOG_FROM_EMAIL is required");
  }

  return resend.emails.send({
    from,
    to: input.to,
    subject: `Nuevo post en el blog — ${input.title}`,
    text: [
      "Nuevo post publicado en matiasgaleano.dev/blog",
      input.title,
      safeExcerpt ? input.excerpt ?? "" : "",
      input.url,
    ]
      .filter(Boolean)
      .join("\n\n"),
    html: `
      <div style="margin:0;padding:32px 20px;background:#e5e7eb;font-family:'IBM Plex Sans','Segoe UI',Arial,sans-serif;color:#1f2937;">
        <div style="max-width:680px;margin:0 auto;">
          <div style="margin-bottom:16px;padding:24px 28px;border:1px solid rgba(31,41,55,0.08);border-radius:28px;background:linear-gradient(180deg, rgba(255,255,255,0.20), rgba(255,255,255,0.06));box-shadow:inset 0 1px 0 rgba(255,255,255,0.22),0 28px 60px -40px rgba(31,41,55,0.45);">
            <div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:18px;">
              <span style="display:inline-block;width:56px;height:4px;border-radius:999px;background:#5b5f8f;"></span>
              <span style="font-family:'IBM Plex Mono','Courier New',monospace;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(31,41,55,0.62);">Post tecnico</span>
            </div>

            <p style="margin:0 0 10px;font-family:'IBM Plex Mono','Courier New',monospace;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(31,41,55,0.56);">
              ${formattedDate ?? "matiasgaleano.dev/blog"}
            </p>

            <h1 style="margin:0 0 16px;font-size:38px;line-height:0.95;font-weight:650;letter-spacing:-0.04em;color:#1f2937;">
              ${safeTitle}
            </h1>

            ${
              safeExcerpt
                ? `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#4b5563;">${safeExcerpt}</p>`
                : ""
            }

            ${tagMarkup ? `<div style="margin:0 0 18px;">${tagMarkup}</div>` : ""}

            <a href="${safeUrl}" style="display:inline-block;padding:14px 18px;border-radius:16px;background:#1f2937;color:#e5e7eb;text-decoration:none;font-weight:600;">
              Leer articulo
            </a>
          </div>

          <div style="padding:0 6px;font-size:13px;line-height:1.65;color:#4b5563;">
            <p style="margin:0 0 8px;">Recibiste este mail porque te suscribiste al blog de Matias Galeano.</p>
            <p style="margin:0;">Blog de arquitectura, backend, cloud y productos reales.</p>
          </div>
        </div>
      </div>
    `,
  });
}
