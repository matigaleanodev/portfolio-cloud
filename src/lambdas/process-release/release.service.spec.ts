import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();
const invokeLambdaMock = vi.fn();
const assertLambdaSuccessMock = vi.fn();

vi.mock("../../shared/s3", () => ({
  s3: {
    send: sendMock,
  },
}));

vi.mock("../../shared/invoke-lambda", () => ({
  invokeLambda: invokeLambdaMock,
  assertLambdaSuccess: assertLambdaSuccessMock,
}));

describe("process-release service", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.R2_BUCKET = "test-bucket";
    process.env.GENERATE_OG_FUNCTION_NAME = "portfolio-cloud-dev-generate-og";
    process.env.NOTIFY_POST_FUNCTION_NAME = "portfolio-cloud-dev-notify-post";
  });

  it("loads processed posts from a readable stream body", async () => {
    sendMock.mockResolvedValue({
      Body: Readable.from([JSON.stringify(["a", "", "b"])]),
    });

    const { loadProcessedPosts } = await import("./release.service");

    await expect(loadProcessedPosts()).resolves.toEqual(["a", "b"]);
    expect(sendMock.mock.calls[0]?.[0]).toBeInstanceOf(GetObjectCommand);
  });

  it("saves unique processed slugs into state/posts.json", async () => {
    const { saveProcessedPosts } = await import("./release.service");

    await saveProcessedPosts(["a", "b", "a"]);

    expect(sendMock.mock.calls[0]?.[0]).toBeInstanceOf(PutObjectCommand);
    const command = sendMock.mock.calls[0]?.[0] as PutObjectCommand;

    expect(command.input).toMatchObject({
      Bucket: "test-bucket",
      Key: "state/posts.json",
      ContentType: "application/json",
    });
    expect(JSON.parse(String(command.input.Body))).toEqual(["a", "b"]);
  });

  it("detects only posts that were not previously processed", async () => {
    const { detectNewPosts } = await import("./release.service");

    expect(
      detectNewPosts(
        [
          {
            slug: "a",
            title: "Post A",
            date: "2026-03-08",
            canonicalPath: "/blog/a",
          },
          {
            slug: "b",
            title: "Post B",
            date: "2026-03-08",
            canonicalPath: "/blog/b",
          },
        ],
        ["a"],
      ),
    ).toEqual([
      {
        slug: "b",
        title: "Post B",
        date: "2026-03-08",
        canonicalPath: "/blog/b",
      },
    ]);
  });

  it("invokes generate-og and notify-post with canonical URLs", async () => {
    invokeLambdaMock
      .mockResolvedValueOnce({
        statusCode: 200,
        body: JSON.stringify({ message: "OG image generated" }),
      })
      .mockResolvedValueOnce({
        statusCode: 200,
        body: JSON.stringify({ message: "Notification sent" }),
      });

    const { processPost } = await import("./release.service");

    await processPost(
      {
        slug: "nuevo-post",
        title: "Nuevo post",
        date: "2026-03-08",
        canonicalPath: "blog/nuevo-post",
      },
      "https://matiasgaleano.dev/",
    );

    expect(invokeLambdaMock).toHaveBeenNthCalledWith(
      1,
      "portfolio-cloud-dev-generate-og",
      {
        slug: "nuevo-post",
        title: "Nuevo post",
        date: "2026-03-08",
      },
    );
    expect(invokeLambdaMock).toHaveBeenNthCalledWith(
      2,
      "portfolio-cloud-dev-notify-post",
      {
        title: "Nuevo post",
        url: "https://matiasgaleano.dev/blog/nuevo-post",
        date: "2026-03-08",
      },
    );
    expect(assertLambdaSuccessMock).toHaveBeenCalledTimes(2);
  });
});
