import { PutObjectCommand } from "@aws-sdk/client-s3";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();

vi.mock("../../shared/s3", () => ({
  s3: {
    send: sendMock,
  },
}));

describe("publish-chat-knowledge service", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.R2_BUCKET = "test-bucket";
    process.env.R2_ACCESS_KEY_ID = "test-access-key";
    process.env.R2_SECRET_ACCESS_KEY = "test-secret-key";
    process.env.CHAT_KNOWLEDGE_OBJECT_KEY = "artifacts/chat/knowledge.json";
  });

  it("publishes the canonical envelope to R2", async () => {
    sendMock.mockResolvedValue({});

    const { publishChatKnowledge } = await import("./publish-chat-knowledge.service");

    const response = await publishChatKnowledge({
      artifact: {
        generatedAt: "2026-03-08T12:29:28.947Z",
        projects: [
          {
            slug: "foodly-notes",
            title: "Foodly Notes",
            excerpt: "Aplicacion de recetas",
            stack: ["Angular", "Ionic"],
            links: [
              {
                label: "Repositorio Frontend",
                url: "https://github.com/matigaleanodev/foodly-notes",
                icon: "code",
              },
            ],
          },
        ],
        posts: [
          {
            slug: "arquitectura-modo-playa",
            title: "Como disene la arquitectura de Modo Playa",
            excerpt: "Producto multi-tenant real",
            date: "2026-03-07",
            tags: ["nestjs", "backend"],
            canonicalUrl: "https://matiasgaleano.dev/blog/arquitectura-modo-playa",
          },
        ],
      },
      release: {
        generatedAt: "2026-03-08T12:40:00.000Z",
        siteUrl: "https://matiasgaleano.dev",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      message: "Knowledge artifact published",
      key: "artifacts/chat/knowledge.json",
      generatedAt: "2026-03-08T12:29:28.947Z",
    });

    expect(sendMock.mock.calls[0]?.[0]).toBeInstanceOf(PutObjectCommand);

    const command = sendMock.mock.calls[0]?.[0] as PutObjectCommand;

    expect(command.input).toMatchObject({
      Bucket: "test-bucket",
      Key: "artifacts/chat/knowledge.json",
      ContentType: "application/json",
    });

    expect(JSON.parse(String(command.input.Body))).toEqual({
      version: 1,
      generatedAt: "2026-03-08T12:29:28.947Z",
      source: {
        repository: "portfolio",
        artifactPath: ".generated/chat/knowledge.json",
      },
      release: {
        generatedAt: "2026-03-08T12:40:00.000Z",
        siteUrl: "https://matiasgaleano.dev",
      },
      contentHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      knowledge: {
        generatedAt: "2026-03-08T12:29:28.947Z",
        projects: [
          {
            slug: "foodly-notes",
            title: "Foodly Notes",
            excerpt: "Aplicacion de recetas",
            stack: ["Angular", "Ionic"],
            links: [
              {
                label: "Repositorio Frontend",
                url: "https://github.com/matigaleanodev/foodly-notes",
                icon: "code",
              },
            ],
          },
        ],
        posts: [
          {
            slug: "arquitectura-modo-playa",
            title: "Como disene la arquitectura de Modo Playa",
            excerpt: "Producto multi-tenant real",
            date: "2026-03-07",
            tags: ["nestjs", "backend"],
            canonicalUrl: "https://matiasgaleano.dev/blog/arquitectura-modo-playa",
          },
        ],
      },
    });
  });

  it("returns 400 when artifact validation fails", async () => {
    const { publishChatKnowledge } = await import("./publish-chat-knowledge.service");

    await expect(
      publishChatKnowledge({
        artifact: {
          generatedAt: "2026-03-08T12:29:28.947Z",
          posts: [
            {
              slug: "post-invalido",
              title: "",
              excerpt: "Falta titulo",
              date: "2026-03-07",
            },
          ],
        },
      }),
    ).resolves.toEqual({
      statusCode: 400,
      body: JSON.stringify({ error: "Valid chat knowledge artifact is required" }),
    });
  });
});
