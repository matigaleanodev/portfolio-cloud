import {
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();

vi.mock("./s3", () => ({
  s3: {
    send: sendMock,
  },
}));

describe("shared/subscribers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.R2_BUCKET = "test-bucket";
  });

  it("normalizes emails and builds subscriber keys", async () => {
    const subscribers = await import("./subscribers");

    expect(subscribers.normalizeSubscriberEmail(" USER%40Example.com ")).toBe(
      "user@example.com",
    );
    expect(subscribers.buildSubscriberKey(" USER@example.com ")).toBe(
      "subscribers/user@example.com.json",
    );
  });

  it("creates a subscriber object when the key does not exist", async () => {
    sendMock
      .mockRejectedValueOnce(Object.assign(new Error("missing"), { name: "NotFound" }))
      .mockResolvedValueOnce({});

    const subscribers = await import("./subscribers");

    expect(await subscribers.createSubscriber("User@example.com")).toBe("created");
    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(sendMock.mock.calls[0]?.[0]).toBeInstanceOf(HeadObjectCommand);
    expect(sendMock.mock.calls[1]?.[0]).toBeInstanceOf(PutObjectCommand);

    const putCommand = sendMock.mock.calls[1]?.[0] as PutObjectCommand;

    expect(putCommand.input).toMatchObject({
      Bucket: "test-bucket",
      Key: "subscribers/user@example.com.json",
      ContentType: "application/json",
    });
    expect(JSON.parse(String(putCommand.input.Body))).toMatchObject({
      email: "user@example.com",
    });
  });

  it("returns exists without writing when the subscriber object already exists", async () => {
    sendMock.mockResolvedValueOnce({});

    const subscribers = await import("./subscribers");

    expect(await subscribers.createSubscriber("user@example.com")).toBe("exists");
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0]?.[0]).toBeInstanceOf(HeadObjectCommand);
  });

  it("deletes a subscriber object when present", async () => {
    sendMock.mockResolvedValueOnce({}).mockResolvedValueOnce({});

    const subscribers = await import("./subscribers");

    expect(await subscribers.deleteSubscriber("user@example.com")).toBe("deleted");
    expect(sendMock.mock.calls[1]?.[0]).toBeInstanceOf(DeleteObjectCommand);
  });

  it("returns missing when trying to delete a subscriber that does not exist", async () => {
    sendMock.mockRejectedValueOnce(Object.assign(new Error("missing"), { name: "NotFound" }));

    const subscribers = await import("./subscribers");

    expect(await subscribers.deleteSubscriber("user@example.com")).toBe("missing");
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("lists subscriber emails from keys under the subscribers prefix", async () => {
    sendMock
      .mockResolvedValueOnce({
        Contents: [
          { Key: "subscribers/one@example.com.json" },
          { Key: "subscribers/two@example.com.json" },
          { Key: "subscribers/" },
        ],
        IsTruncated: true,
        NextContinuationToken: "page-2",
      })
      .mockResolvedValueOnce({
        Contents: [{ Key: "subscribers/two@example.com.json" }],
        IsTruncated: false,
      });

    const subscribers = await import("./subscribers");

    expect(await subscribers.listSubscriberEmails()).toEqual([
      "one@example.com",
      "two@example.com",
    ]);
    expect(sendMock.mock.calls[0]?.[0]).toBeInstanceOf(ListObjectsV2Command);
    expect(sendMock.mock.calls[1]?.[0]).toBeInstanceOf(ListObjectsV2Command);
  });
});
