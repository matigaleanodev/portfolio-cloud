import { describe, expect, it } from "vitest";
import { generateOgImage } from "./og";

describe("shared/og", () => {
  it("renders a PNG buffer for OG previews", async () => {
    const image = await generateOgImage({
      title: "Test flujo completo de Resend y OG",
      excerpt:
        "Pipeline editorial serverless con AWS Lambda, R2 y Resend alineado visualmente con el portfolio.",
      tags: ["aws", "serverless", "blog"],
    });

    expect(Buffer.isBuffer(image)).toBe(true);
    expect(image.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(image.byteLength).toBeGreaterThan(1000);
  });

  it("supports long titles and excerpts without throwing", async () => {
    await expect(
      generateOgImage({
        title:
          "Como disene la arquitectura de Modo Playa para escalar contenido, automatizacion editorial y producto sin perder claridad visual",
        excerpt:
          "API NestJS, MongoDB, ownerId y un pipeline backend para media, automatizacion editorial y assets Open Graph consistentes con el portfolio.",
        tags: ["aws", "serverless", "og", "blog"],
      }),
    ).resolves.toBeInstanceOf(Buffer);
  });
});
