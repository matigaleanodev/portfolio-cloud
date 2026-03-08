import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();
const invokeCommandMock = vi.fn().mockImplementation(
  function MockInvokeCommand(input) {
    return { input };
  },
);

vi.mock("@aws-sdk/client-lambda", () => ({
  LambdaClient: vi.fn().mockImplementation(
    function MockLambdaClient() {
      return {
        send: sendMock,
      };
    },
  ),
  InvokeCommand: invokeCommandMock,
}));

describe("shared/invoke-lambda", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("invokes a lambda and decodes the response payload", async () => {
    sendMock.mockResolvedValue({
      Payload: Buffer.from(
        JSON.stringify({
          statusCode: 200,
          body: JSON.stringify({ message: "ok" }),
        }),
      ),
    });

    const { invokeLambda } = await import("./invoke-lambda");

    await expect(
      invokeLambda("portfolio-cloud-dev-generate-og", {
        slug: "test-post",
      }),
    ).resolves.toEqual({
      statusCode: 200,
      body: JSON.stringify({ message: "ok" }),
    });

    expect(invokeCommandMock).toHaveBeenCalledWith({
      FunctionName: "portfolio-cloud-dev-generate-og",
      Payload: Buffer.from(JSON.stringify({ slug: "test-post" })),
    });
  });

  it("throws the lambda payload when the invocation reports a function error", async () => {
    sendMock.mockResolvedValue({
      FunctionError: "Unhandled",
      Payload: Buffer.from(JSON.stringify({ errorMessage: "boom" })),
    });

    const { invokeLambda } = await import("./invoke-lambda");

    await expect(
      invokeLambda("portfolio-cloud-dev-generate-og", { slug: "test-post" }),
    ).rejects.toThrowError(JSON.stringify({ errorMessage: "boom" }));
  });

  it("throws when the lambda response shape is unexpected", async () => {
    sendMock.mockResolvedValue({
      Payload: Buffer.from(JSON.stringify({ message: "ok" })),
    });

    const { invokeLambda } = await import("./invoke-lambda");

    await expect(
      invokeLambda("portfolio-cloud-dev-generate-og", { slug: "test-post" }),
    ).rejects.toThrowError(
      "Unexpected Lambda response shape from portfolio-cloud-dev-generate-og",
    );
  });

  it("throws for failing lambda status codes in assertLambdaSuccess", async () => {
    const { assertLambdaSuccess } = await import("./invoke-lambda");

    expect(() =>
      assertLambdaSuccess("portfolio-cloud-dev-notify-post", {
        statusCode: 500,
        body: JSON.stringify({ error: "failed" }),
      }),
    ).toThrowError(
      'Lambda portfolio-cloud-dev-notify-post returned 500: {"error":"failed"}',
    );
  });
});
