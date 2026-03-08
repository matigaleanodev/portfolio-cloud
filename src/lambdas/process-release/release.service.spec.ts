import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();
const invokeLambdaMock = vi.fn();

vi.mock("../../shared/s3", () => ({
  s3: {
    send: sendMock,
  },
}));

vi.mock("../../shared/invoke-lambda", () => ({
  invokeLambda: invokeLambdaMock,
  assertLambdaSuccess: vi.fn(
    (functionName: string, response: { statusCode: number; body: string }) => {
      if (response.statusCode >= 400) {
        throw new Error(`Lambda ${functionName} returned ${response.statusCode}: ${response.body}`);
      }
    },
  ),
}));

describe("process-release service", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.R2_BUCKET = "test-bucket";
    process.env.GENERATE_OG_FUNCTION_NAME = "portfolio-cloud-dev-generate-og";
    process.env.NOTIFY_POST_FUNCTION_NAME = "portfolio-cloud-dev-notify-post";
    process.env.RELEASE_STAGE_MAX_ATTEMPTS = "2";
  });

  it("loads processed posts from a legacy readable stream body", async () => {
    sendMock
      .mockResolvedValueOnce({
        Body: Readable.from([JSON.stringify(["a", "", "b"])]),
      })
      .mockResolvedValueOnce({
        Body: Readable.from([JSON.stringify(["a", "", "b"])]),
      });

    const { loadProcessedPosts, loadProcessedPostsState } = await import("./release.service");

    await expect(loadProcessedPosts()).resolves.toEqual(["a", "b"]);
    await expect(loadProcessedPostsState()).resolves.toMatchObject({
      a: {
        ogGeneratedAt: "1970-01-01T00:00:00.000Z",
        notifiedAt: "1970-01-01T00:00:00.000Z",
      },
      b: {
        ogGeneratedAt: "1970-01-01T00:00:00.000Z",
        notifiedAt: "1970-01-01T00:00:00.000Z",
      },
    });
    expect(sendMock.mock.calls[0]?.[0]).toBeInstanceOf(GetObjectCommand);
  });

  it("saves unique processed slugs into the normalized state file", async () => {
    const { saveProcessedPosts } = await import("./release.service");

    await saveProcessedPosts(["a", "b", "a"]);

    expect(sendMock.mock.calls[0]?.[0]).toBeInstanceOf(PutObjectCommand);
    const command = sendMock.mock.calls[0]?.[0] as PutObjectCommand;

    expect(command.input).toMatchObject({
      Bucket: "test-bucket",
      Key: "state/posts.json",
      ContentType: "application/json",
    });
    expect(JSON.parse(String(command.input.Body))).toEqual({
      a: {
        ogGeneratedAt: "1970-01-01T00:00:00.000Z",
        notifiedAt: "1970-01-01T00:00:00.000Z",
        updatedAt: "1970-01-01T00:00:00.000Z",
      },
      b: {
        ogGeneratedAt: "1970-01-01T00:00:00.000Z",
        notifiedAt: "1970-01-01T00:00:00.000Z",
        updatedAt: "1970-01-01T00:00:00.000Z",
      },
    });
  });

  it("detects only posts that do not have notification completed", async () => {
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
        {
          a: {
            ogGeneratedAt: "2026-03-08T10:00:00.000Z",
            notifiedAt: "2026-03-08T10:05:00.000Z",
            updatedAt: "2026-03-08T10:05:00.000Z",
          },
        },
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
  });

  it("retries a failed stage and succeeds on the second attempt", async () => {
    invokeLambdaMock
      .mockResolvedValueOnce({
        statusCode: 500,
        body: JSON.stringify({ error: "temporary OG failure" }),
      })
      .mockResolvedValueOnce({
        statusCode: 200,
        body: JSON.stringify({ message: "OG image generated" }),
      })
      .mockResolvedValueOnce({
        statusCode: 200,
        body: JSON.stringify({ message: "Notification sent" }),
      });

    const { processPost } = await import("./release.service");

    const result = await processPost(
      {
        slug: "nuevo-post",
        title: "Nuevo post",
        date: "2026-03-08",
        canonicalPath: "/blog/nuevo-post",
      },
      "https://matiasgaleano.dev",
    );

    expect(invokeLambdaMock).toHaveBeenCalledTimes(3);
    expect(result.ogGeneratedAt).toBeTypeOf("string");
    expect(result.notifiedAt).toBeTypeOf("string");
  });

  it("skips generate-og when the state already marks that stage as completed", async () => {
    invokeLambdaMock.mockResolvedValueOnce({
      statusCode: 200,
      body: JSON.stringify({ message: "Notification sent" }),
    });

    const { processPost } = await import("./release.service");

    await processPost(
      {
        slug: "nuevo-post",
        title: "Nuevo post",
        date: "2026-03-08",
        canonicalPath: "/blog/nuevo-post",
      },
      "https://matiasgaleano.dev",
      {
        ogGeneratedAt: "2026-03-08T10:00:00.000Z",
        updatedAt: "2026-03-08T10:00:00.000Z",
      },
    );

    expect(invokeLambdaMock).toHaveBeenCalledTimes(1);
    expect(invokeLambdaMock).toHaveBeenCalledWith(
      "portfolio-cloud-dev-notify-post",
      {
        title: "Nuevo post",
        url: "https://matiasgaleano.dev/blog/nuevo-post",
        date: "2026-03-08",
      },
    );
  });

  it("persists partial progress and returns 500 when a post fails after retries", async () => {
    sendMock
      .mockResolvedValueOnce({
        Body: Readable.from([
          JSON.stringify({
            previo: {
              ogGeneratedAt: "2026-03-07T10:00:00.000Z",
              notifiedAt: "2026-03-07T10:01:00.000Z",
              updatedAt: "2026-03-07T10:01:00.000Z",
            },
          }),
        ]),
      })
      .mockResolvedValue(undefined)
      .mockResolvedValue(undefined);

    invokeLambdaMock
      .mockResolvedValueOnce({
        statusCode: 200,
        body: JSON.stringify({ message: "OG image generated" }),
      })
      .mockResolvedValueOnce({
        statusCode: 500,
        body: JSON.stringify({ error: "notify failure" }),
      })
      .mockResolvedValueOnce({
        statusCode: 500,
        body: JSON.stringify({ error: "notify failure" }),
      })
      .mockResolvedValueOnce({
        statusCode: 200,
        body: JSON.stringify({ message: "OG image generated" }),
      })
      .mockResolvedValueOnce({
        statusCode: 200,
        body: JSON.stringify({ message: "Notification sent" }),
      });

    const { processRelease } = await import("./release.service");

    const response = await processRelease({
      manifest: {
        generatedAt: "2026-03-08T12:00:00.000Z",
        siteUrl: "https://matiasgaleano.dev",
        content: {
          posts: [
            {
              slug: "fallido",
              title: "Fallido",
              date: "2026-03-08",
              canonicalPath: "/blog/fallido",
            },
            {
              slug: "ok",
              title: "OK",
              date: "2026-03-08",
              canonicalPath: "/blog/ok",
            },
          ],
        },
      },
    });

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toMatchObject({
      message: "Release processed with partial failures",
      processedPosts: ["ok"],
      failedPosts: [
        {
          slug: "fallido",
          stage: "notify-post",
          attempts: 2,
        },
      ],
    });
    expect(sendMock).toHaveBeenCalledTimes(3);
    expect(invokeLambdaMock).toHaveBeenCalledTimes(5);
  });

  it("treats posts with failed notify and completed OG as pending for the next run", async () => {
    const { detectNewPosts } = await import("./release.service");

    expect(
      detectNewPosts(
        [
          {
            slug: "pending",
            title: "Pending",
            date: "2026-03-08",
            canonicalPath: "/blog/pending",
          },
        ],
        {
          pending: {
            ogGeneratedAt: "2026-03-08T10:00:00.000Z",
            updatedAt: "2026-03-08T10:00:00.000Z",
            lastFailure: {
              stage: "notify-post",
              failedAt: "2026-03-08T10:01:00.000Z",
              attempts: 2,
              message: "notify failure",
            },
          },
        },
      ),
    ).toEqual([
      {
        slug: "pending",
        title: "Pending",
        date: "2026-03-08",
        canonicalPath: "/blog/pending",
      },
    ]);
  });
});
