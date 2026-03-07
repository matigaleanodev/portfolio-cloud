import { beforeEach, describe, expect, it, vi } from "vitest";

const listSubscriberEmailsMock = vi.fn();
const sendBlogNotificationMock = vi.fn();

vi.mock("../../shared/subscribers", () => ({
  listSubscriberEmails: listSubscriberEmailsMock,
}));

vi.mock("../../shared/email", () => ({
  sendBlogNotification: sendBlogNotificationMock,
}));

describe("notify-post handler", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 400 when required fields are missing", async () => {
    const { handler } = await import("./handler");

    await expect(handler({ title: "Test" })).resolves.toEqual({
      statusCode: 400,
      body: JSON.stringify({ error: "Title and url are required" }),
    });
  });

  it("sends a notification to every subscriber and reports the count", async () => {
    listSubscriberEmailsMock.mockResolvedValue([
      "one@example.com",
      "two@example.com",
    ]);
    sendBlogNotificationMock.mockResolvedValue({});

    const { handler } = await import("./handler");

    await expect(
      handler({
        title: "Arquitectura de Modo Playa",
        url: "https://matiasgaleano.dev/blog/arquitectura-modo-playa",
        excerpt: "Excerpt",
        date: "2026-03-07",
        tags: ["nestjs", "architecture", ""],
      }),
    ).resolves.toEqual({
      statusCode: 200,
      body: JSON.stringify({
        message: "Notification sent",
        title: "Arquitectura de Modo Playa",
        url: "https://matiasgaleano.dev/blog/arquitectura-modo-playa",
        recipients: 2,
      }),
    });

    expect(sendBlogNotificationMock).toHaveBeenCalledTimes(2);
    expect(sendBlogNotificationMock).toHaveBeenNthCalledWith(1, {
      to: "one@example.com",
      title: "Arquitectura de Modo Playa",
      url: "https://matiasgaleano.dev/blog/arquitectura-modo-playa",
      excerpt: "Excerpt",
      date: "2026-03-07",
      tags: ["nestjs", "architecture"],
    });
  });
});
