import { beforeEach, describe, expect, it, vi } from "vitest";

const deleteSubscriberMock = vi.fn();
const isValidSubscriberEmailMock = vi.fn();
const normalizeSubscriberEmailMock = vi.fn();

vi.mock("../../shared/subscribers", () => ({
  deleteSubscriber: deleteSubscriberMock,
  isValidSubscriberEmail: isValidSubscriberEmailMock,
  normalizeSubscriberEmail: normalizeSubscriberEmailMock,
}));

describe("unsubscribe handler", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    normalizeSubscriberEmailMock.mockImplementation((email: string) =>
      decodeURIComponent(email).trim().toLowerCase(),
    );
    isValidSubscriberEmailMock.mockReturnValue(true);
  });

  it("returns 400 when email is missing", async () => {
    const { handler } = await import("./handler");

    await expect(handler({})).resolves.toEqual({
      statusCode: 400,
      body: JSON.stringify({ error: "Email required" }),
    });
  });

  it("returns already unsubscribed when the subscriber does not exist", async () => {
    deleteSubscriberMock.mockResolvedValue("missing");

    const { handler } = await import("./handler");

    await expect(
      handler({ queryStringParameters: { email: "USER%40example.com" } }),
    ).resolves.toEqual({
      statusCode: 200,
      body: JSON.stringify({ message: "Already unsubscribed" }),
    });
    expect(deleteSubscriberMock).toHaveBeenCalledWith("user@example.com");
  });

  it("returns 400 when email is invalid", async () => {
    isValidSubscriberEmailMock.mockReturnValue(false);

    const { handler } = await import("./handler");

    await expect(handler({ email: "invalid" })).resolves.toEqual({
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid email" }),
    });
  });

  it("deletes a subscriber from the JSON body payload", async () => {
    deleteSubscriberMock.mockResolvedValue("deleted");

    const { handler } = await import("./handler");

    await expect(
      handler({ body: JSON.stringify({ email: "USER@example.com" }) }),
    ).resolves.toEqual({
      statusCode: 200,
      body: JSON.stringify({
        message: "Unsubscribed successfully",
        email: "user@example.com",
      }),
    });
  });
});
