import { beforeEach, describe, expect, it, vi } from "vitest";

const createSubscriberMock = vi.fn();
const isValidSubscriberEmailMock = vi.fn();
const normalizeSubscriberEmailMock = vi.fn();

vi.mock("../../shared/subscribers", () => ({
  createSubscriber: createSubscriberMock,
  isValidSubscriberEmail: isValidSubscriberEmailMock,
  normalizeSubscriberEmail: normalizeSubscriberEmailMock,
}));

describe("subscribe handler", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    normalizeSubscriberEmailMock.mockImplementation((email: string) =>
      email.trim().toLowerCase(),
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

  it("returns 400 when email is invalid", async () => {
    isValidSubscriberEmailMock.mockReturnValue(false);

    const { handler } = await import("./handler");

    await expect(handler({ email: "invalid" })).resolves.toEqual({
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid email" }),
    });
  });

  it("returns already subscribed when the subscriber file already exists", async () => {
    createSubscriberMock.mockResolvedValue("exists");

    const { handler } = await import("./handler");

    await expect(handler({ email: "USER@example.com" })).resolves.toEqual({
      statusCode: 200,
      body: JSON.stringify({ message: "Already subscribed" }),
    });
    expect(createSubscriberMock).toHaveBeenCalledWith("user@example.com");
  });

  it("creates a subscriber from the JSON body payload", async () => {
    createSubscriberMock.mockResolvedValue("created");

    const { handler } = await import("./handler");

    await expect(
      handler({ body: JSON.stringify({ email: "USER@example.com" }) }),
    ).resolves.toEqual({
      statusCode: 200,
      body: JSON.stringify({
        message: "Subscribed successfully",
        email: "user@example.com",
      }),
    });
  });
});
