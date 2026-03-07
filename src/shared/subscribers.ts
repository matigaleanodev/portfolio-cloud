import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";
import { s3 } from "./s3";

const bucket = process.env.R2_BUCKET!;
const key = "subscribers/subscribers.json";

type StringReadable =
  | Readable
  | {
      transformToString?: (encoding?: string) => Promise<string>;
    };

function hasTransformToString(
  stream: StringReadable,
): stream is { transformToString: (encoding?: string) => Promise<string> } {
  return "transformToString" in stream && typeof stream.transformToString === "function";
}

async function streamToString(stream: StringReadable): Promise<string> {
  if (hasTransformToString(stream)) {
    return stream.transformToString("utf-8");
  }

  const chunks: Buffer[] = [];
  const readableStream = stream as Readable;

  for await (const chunk of readableStream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf-8");
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export async function getSubscribers(): Promise<string[]> {
  try {
    const res = await s3.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    if (!res.Body) {
      return [];
    }

    const body = await streamToString(res.Body);
    const parsed: unknown = JSON.parse(body);

    return isStringArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveSubscribers(list: string[]): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(list, null, 2),
      ContentType: "application/json",
    }),
  );
}
