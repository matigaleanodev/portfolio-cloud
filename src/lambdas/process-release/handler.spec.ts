import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
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
  assertLambdaSuccess: vi.fn(),
}));

describe("process-release handler", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.R2_BUCKET = "test-bucket";
    process.env.GENERATE_OG_FUNCTION_NAME = "portfolio-cloud-dev-generate-og";
    process.env.NOTIFY_POST_FUNCTION_NAME = "portfolio-cloud-dev-notify-post";
  });

  it("returns 400 when the manifest is invalid", async () => {
    const { handler } = await import("./handler");

    await expect(handler({})).resolves.toEqual({
      statusCode: 400,
      body: JSON.stringify({ error: "Valid manifest is required" }),
    });
  });

  it("returns no new posts when all manifest posts were already processed", async () => {
    sendMock.mockResolvedValueOnce({
      Body: {
        transformToString: vi
          .fn()
          .mockResolvedValueOnce(JSON.stringify(["arquitectura-modo-playa"])),
      },
    });

    const { handler } = await import("./handler");

    await expect(
      handler({
        manifest: {
          generatedAt: "2026-03-07T15:00:00Z",
          siteUrl: "https://matiasgaleano.dev",
          content: {
            posts: [
              {
                slug: "arquitectura-modo-playa",
                title: "Como disene la arquitectura de Modo Playa",
                date: "2026-03-07",
                canonicalPath: "/blog/arquitectura-modo-playa",
              },
            ],
          },
        },
      }),
    ).resolves.toEqual({
      statusCode: 200,
      body: JSON.stringify({ message: "No new posts" }),
    });

    expect(invokeLambdaMock).not.toHaveBeenCalled();
  });

  it("accepts a raw release manifest payload for direct CI invocation", async () => {
    sendMock
      .mockRejectedValueOnce(Object.assign(new Error("missing"), { name: "NotFound" }))
      .mockResolvedValueOnce({});
    invokeLambdaMock
      .mockResolvedValueOnce({
        statusCode: 200,
        body: JSON.stringify({ message: "OG image generated" }),
      })
      .mockResolvedValueOnce({
        statusCode: 200,
        body: JSON.stringify({ message: "Notification sent" }),
      });

    const { handler } = await import("./handler");

    await expect(
      handler({
        generatedAt: "2026-03-07T15:00:00Z",
        siteUrl: "https://matiasgaleano.dev",
        content: {
          posts: [
            {
              slug: "arquitectura-modo-playa",
              title: "Como disene la arquitectura de Modo Playa",
              date: "2026-03-07",
              canonicalPath: "/blog/arquitectura-modo-playa",
            },
          ],
        },
      }),
    ).resolves.toEqual({
      statusCode: 200,
      body: JSON.stringify({ processedPosts: ["arquitectura-modo-playa"] }),
    });
  });

  it("processes new posts and persists updated state", async () => {
    sendMock
      .mockResolvedValueOnce({
        Body: {
          transformToString: vi.fn().mockResolvedValueOnce(JSON.stringify(["a", "b"])),
        },
      })
      .mockResolvedValueOnce({});
    invokeLambdaMock
      .mockResolvedValueOnce({
        statusCode: 200,
        body: JSON.stringify({ message: "OG image generated" }),
      })
      .mockResolvedValueOnce({
        statusCode: 200,
        body: JSON.stringify({ message: "Notification sent" }),
      });

    const { handler } = await import("./handler");

    await expect(
      handler({
        manifest: {
          generatedAt: "2026-03-07T15:00:00Z",
          siteUrl: "https://matiasgaleano.dev",
          content: {
            posts: [
              {
                slug: "a",
                title: "Post A",
                date: "2026-03-05",
                canonicalPath: "/blog/a",
              },
              {
                slug: "b",
                title: "Post B",
                date: "2026-03-06",
                canonicalPath: "/blog/b",
              },
              {
                slug: "c",
                title: "Post C",
                date: "2026-03-07",
                canonicalPath: "/blog/c",
              },
            ],
          },
        },
      }),
    ).resolves.toEqual({
      statusCode: 200,
      body: JSON.stringify({ processedPosts: ["c"] }),
    });

    expect(invokeLambdaMock).toHaveBeenNthCalledWith(
      1,
      "portfolio-cloud-dev-generate-og",
      {
        slug: "c",
        title: "Post C",
        date: "2026-03-07",
      },
    );
    expect(invokeLambdaMock).toHaveBeenNthCalledWith(
      2,
      "portfolio-cloud-dev-notify-post",
      {
        title: "Post C",
        url: "https://matiasgaleano.dev/blog/c",
        date: "2026-03-07",
      },
    );

    expect(sendMock.mock.calls[0]?.[0]).toBeInstanceOf(GetObjectCommand);
    expect(sendMock.mock.calls[1]?.[0]).toBeInstanceOf(PutObjectCommand);

    const putCommand = sendMock.mock.calls[1]?.[0] as PutObjectCommand;

    expect(putCommand.input).toMatchObject({
      Bucket: "test-bucket",
      Key: "state/posts.json",
      ContentType: "application/json",
    });
    expect(JSON.parse(String(putCommand.input.Body))).toMatchObject({
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
      c: {
        ogGeneratedAt: expect.any(String),
        notifiedAt: expect.any(String),
        updatedAt: expect.any(String),
      },
    });
  });

  it("assumes an empty state when state/posts.json does not exist", async () => {
    sendMock
      .mockRejectedValueOnce(Object.assign(new Error("missing"), { name: "NotFound" }))
      .mockResolvedValueOnce({});
    invokeLambdaMock
      .mockResolvedValueOnce({
        statusCode: 200,
        body: JSON.stringify({ message: "OG image generated" }),
      })
      .mockResolvedValueOnce({
        statusCode: 200,
        body: JSON.stringify({ message: "Notification sent" }),
      });

    const { handler } = await import("./handler");

    await expect(
      handler({
        manifest: {
          generatedAt: "2026-03-07T15:00:00Z",
          siteUrl: "https://matiasgaleano.dev/",
          content: {
            posts: [
              {
                slug: "arquitectura-modo-playa",
                title: "Como disene la arquitectura de Modo Playa",
                date: "2026-03-07",
                canonicalPath: "blog/arquitectura-modo-playa",
              },
            ],
          },
        },
      }),
    ).resolves.toEqual({
      statusCode: 200,
      body: JSON.stringify({ processedPosts: ["arquitectura-modo-playa"] }),
    });
  });
});
