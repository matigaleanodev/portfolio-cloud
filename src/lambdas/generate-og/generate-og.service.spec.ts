import { beforeEach, describe, expect, it, vi } from "vitest";

const generateOgImageMock = vi.fn();
const uploadObjectMock = vi.fn();

vi.mock("../../shared/og", () => ({
  generateOgImage: generateOgImageMock,
}));

vi.mock("../../shared/s3", () => ({
  uploadObject: uploadObjectMock,
}));

describe("generate-og service", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.OG_OBJECT_PREFIX = "og";
    process.env.MEDIA_BASE_URL = "https://media.matiasgaleano.dev";
  });

  it("normalizes optional fields before generating the image", async () => {
    generateOgImageMock.mockResolvedValue(Buffer.from("image"));
    uploadObjectMock.mockResolvedValue(undefined);

    const { generateOg } = await import("./generate-og.service");

    await expect(
      generateOg({
        title: "Nuevo post",
        slug: "nuevo-post",
        excerpt: "  resumen  ",
        date: "2026-03-08",
        tags: ["aws", "", "cloud"],
      }),
    ).resolves.toEqual({
      statusCode: 200,
      body: JSON.stringify({
        message: "OG image generated",
        url: "https://media.matiasgaleano.dev/og/nuevo-post.png",
      }),
    });

    expect(generateOgImageMock).toHaveBeenCalledWith({
      title: "Nuevo post",
      excerpt: "  resumen  ",
      date: "2026-03-08",
      tags: ["aws", "cloud"],
    });
  });

  it("returns 400 when title or slug are missing", async () => {
    const { generateOg } = await import("./generate-og.service");

    await expect(generateOg({ slug: "missing-title" })).resolves.toEqual({
      statusCode: 400,
      body: JSON.stringify({ error: "Title and slug are required" }),
    });
  });
});
