import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();

vi.mock("../../shared/s3", () => ({
  s3: {
    send: sendMock,
  },
}));

describe("publish-chat-knowledge handler", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.R2_BUCKET = "test-bucket";
    process.env.R2_ACCESS_KEY_ID = "test-access-key";
    process.env.R2_SECRET_ACCESS_KEY = "test-secret-key";
    process.env.CHAT_KNOWLEDGE_OBJECT_KEY = "artifacts/chat/knowledge.json";
  });

  it("returns 400 when the artifact is invalid", async () => {
    const { handler } = await import("./handler");

    await expect(handler({ artifact: {} as never })).resolves.toEqual({
      statusCode: 400,
      body: JSON.stringify({ error: "Valid chat knowledge artifact is required" }),
    });
  });

  it("accepts a raw editorial artifact payload for direct CI invocation", async () => {
    sendMock.mockResolvedValue({});

    const { handler } = await import("./handler");

    const response = await handler(
      {
        generatedAt: "2026-03-08T12:29:28.947Z",
        projects: [
          {
            slug: "foodly-notes",
            title: "Foodly Notes",
            excerpt: "Aplicacion de recetas",
            stack: ["Angular", "Ionic"],
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
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      message: "Knowledge artifact published",
      key: "artifacts/chat/knowledge.json",
      generatedAt: "2026-03-08T12:29:28.947Z",
      contentHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
    });
  });
});
