import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(
    function MockResend() {
      return {
        emails: {
          send: sendMock,
        },
      };
    },
  ),
}));

describe("shared/email", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "test-resend-key";
    process.env.BLOG_FROM_EMAIL = "blog@matiasgaleano.dev";
  });

  it("builds the notification payload with escaped content and tags", async () => {
    sendMock.mockResolvedValue({ id: "email_123" });

    const { sendBlogNotification } = await import("./email");

    await expect(
      sendBlogNotification({
        to: "contacto@matiasgaleano.dev",
        title: 'Arquitectura <Modo Playa>',
        url: "https://matiasgaleano.dev/blog/modo-playa?ref=og",
        excerpt: "Backend & cloud con <tags>",
        date: "2026-03-08",
        tags: ["aws", "serverless", "blog", "cloud", "extra"],
      }),
    ).resolves.toEqual({ id: "email_123" });

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0]?.[0]).toMatchObject({
      from: "blog@matiasgaleano.dev",
      to: "contacto@matiasgaleano.dev",
      subject: "Nuevo post en el blog — Arquitectura <Modo Playa>",
    });

    const payload = sendMock.mock.calls[0]?.[0] as {
      text: string;
      html: string;
    };

    expect(payload.text).toContain("Arquitectura <Modo Playa>");
    expect(payload.text).toContain("Backend & cloud con <tags>");
    expect(payload.text).toContain(
      "Cancelar suscripcion: https://matiasgaleano.dev/blog/unsubscribe?email=contacto%40matiasgaleano.dev",
    );
    expect(payload.html).toContain("Arquitectura &lt;Modo Playa&gt;");
    expect(payload.html).toContain("Backend &amp; cloud con &lt;tags&gt;");
    expect(payload.html).toContain("mar");
    expect(payload.html).toContain("2026");
    expect(payload.html).toContain("aws");
    expect(payload.html).toContain("serverless");
    expect(payload.html).toContain(
      "https://matiasgaleano.dev/blog/unsubscribe?email=contacto%40matiasgaleano.dev",
    );
    expect(payload.html).not.toContain("extra");
  });

  it("falls back cleanly when excerpt and date are missing", async () => {
    sendMock.mockResolvedValue({ id: "email_456" });

    const { sendBlogNotification } = await import("./email");

    await sendBlogNotification({
      to: "contacto@matiasgaleano.dev",
      title: "Nuevo post",
      url: "https://matiasgaleano.dev/blog/nuevo-post",
    });

    const payload = sendMock.mock.calls[0]?.[0] as {
      text: string;
      html: string;
    };

    expect(payload.text).toContain("Nuevo post");
    expect(payload.text).toContain("https://matiasgaleano.dev/blog/nuevo-post");
    expect(payload.text).toContain("Cancelar suscripcion:");
    expect(payload.html).toContain("matiasgaleano.dev/blog");
    expect(payload.html).toContain("esta pagina");
  });
});
