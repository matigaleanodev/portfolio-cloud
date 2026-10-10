import { beforeEach, describe, expect, it, vi } from "vitest";

const listSubscriberEmailsMock = vi.fn();
const sendBlogNotificationMock = vi.fn();

vi.mock("../../shared/subscribers", () => ({
  listSubscriberEmails: listSubscriberEmailsMock,
}));

vi.mock("../../shared/email", () => ({
  sendBlogNotification: sendBlogNotificationMock,
}));

describe("notify-post service", () => {
  it("rechaza una fecha futura antes de leer suscriptores o mandar mails", async () => {
    const { notifyPost } = await import("./notify.service");
    const response = await notifyPost({ title: "Programado", url: "https://matiasgaleano.dev/blog/programado", date: "2999-01-01" });
    expect(response.statusCode).toBe(400);
    expect(listSubscriberEmailsMock).not.toHaveBeenCalled();
    expect(sendBlogNotificationMock).not.toHaveBeenCalled();
  });
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("notifies every subscriber with normalized optional metadata", async () => {
    listSubscriberEmailsMock.mockResolvedValue(["one@example.com"]);
    sendBlogNotificationMock.mockResolvedValue({ id: "email_123" });

    const { notifyPost } = await import("./notify.service");

    await expect(
      notifyPost({
        title: "Nuevo post",
        url: "https://matiasgaleano.dev/blog/nuevo-post",
        excerpt: "Resumen",
        date: "2026-03-08",
        tags: ["aws", "", "cloud"],
      }),
    ).resolves.toEqual({
      statusCode: 200,
      body: JSON.stringify({
        message: "Notification sent",
        title: "Nuevo post",
        url: "https://matiasgaleano.dev/blog/nuevo-post",
        recipients: 1,
      }),
    });

    expect(sendBlogNotificationMock).toHaveBeenCalledWith({
      to: "one@example.com",
      title: "Nuevo post",
      url: "https://matiasgaleano.dev/blog/nuevo-post",
      excerpt: "Resumen",
      date: "2026-03-08",
      tags: ["aws", "cloud"],
    });
  });

  it("returns 400 when title or url are missing", async () => {
    const { notifyPost } = await import("./notify.service");

    await expect(notifyPost({ title: "Missing url" })).resolves.toEqual({
      statusCode: 400,
      body: JSON.stringify({ error: "Title and url are required" }),
    });
  });
});
