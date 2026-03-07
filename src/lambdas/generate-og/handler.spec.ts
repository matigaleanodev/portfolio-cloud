import { beforeEach, describe, expect, it, vi } from "vitest";

const generateOgImageMock = vi.fn();
const uploadObjectMock = vi.fn();

vi.mock("../../shared/og", () => ({
  generateOgImage: generateOgImageMock,
}));

vi.mock("../../shared/s3", () => ({
  uploadObject: uploadObjectMock,
}));

describe("generate-og handler", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.OG_OBJECT_PREFIX = "og";
    process.env.MEDIA_BASE_URL = "https://cdn.matiasgaleano.dev";
  });

  it("returns 400 when title or slug is missing", async () => {
    const { handler } = await import("./handler");

    await expect(handler({ title: "Missing slug" })).resolves.toEqual({
      statusCode: 400,
      body: JSON.stringify({ error: "Title and slug are required" }),
    });
  });

  it("generates and uploads an OG image with normalized optional metadata", async () => {
    generateOgImageMock.mockResolvedValue(Buffer.from("image"));
    uploadObjectMock.mockResolvedValue(undefined);

    const { handler } = await import("./handler");

    await expect(
      handler({
        title: "Arquitectura de Modo Playa",
        slug: "arquitectura-modo-playa",
        excerpt: "Excerpt",
        date: "2026-03-07",
        tags: ["nestjs", "architecture", ""],
      }),
    ).resolves.toEqual({
      statusCode: 200,
      body: JSON.stringify({
        message: "OG image generated",
        url: "https://cdn.matiasgaleano.dev/og/arquitectura-modo-playa.png",
      }),
    });

    expect(generateOgImageMock).toHaveBeenCalledWith({
      title: "Arquitectura de Modo Playa",
      excerpt: "Excerpt",
      date: "2026-03-07",
      tags: ["nestjs", "architecture"],
    });
    expect(uploadObjectMock).toHaveBeenCalledWith(
      "og/arquitectura-modo-playa.png",
      Buffer.from("image"),
      "image/png",
    );
  });
});
