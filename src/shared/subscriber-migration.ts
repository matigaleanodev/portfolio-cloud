import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { createHash } from "node:crypto";
import { s3 } from "./s3";

type MigrationMode = "plan" | "copy" | "remove-public";

async function readObject(bucket: string, key: string): Promise<Buffer> {
  const result = await s3.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  if (!result.Body) throw new Error("Subscriber object has no body");
  return Buffer.from(await result.Body.transformToByteArray());
}

function sameContent(left: Buffer, right: Buffer): boolean {
  return (
    createHash("sha256").update(left).digest("hex") ===
    createHash("sha256").update(right).digest("hex")
  );
}

// Copia sin sobrescribir diferencias; el borrado exige una copia verificada y el corte de escrituras.
export async function migrateSubscribers(
  source: string,
  target: string,
  mode: MigrationMode,
): Promise<number> {
  if (!source || !target || source === target)
    throw new Error("Distinct source and private target buckets are required");
  let token: string | undefined;
  const keys: string[] = [];
  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: source,
        Prefix: "subscribers/",
        ContinuationToken: token,
      }),
    );
    for (const object of page.Contents ?? []) {
      if (object.Key?.endsWith(".json")) keys.push(object.Key);
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  if (mode === "plan") return keys.length;

  // Verifica el lote completo antes de retirar cualquier registro público.
  const verified: { key: string; body: Buffer }[] = [];
  for (const key of keys) {
    const body = await readObject(source, key);
    let destination: Buffer;
    try {
      destination = await readObject(target, key);
    } catch (error) {
      const missing =
        error instanceof Error &&
        ["NoSuchKey", "NotFound"].includes(error.name);
      if (mode !== "copy" || !missing) throw error;
      await s3.send(
        new PutObjectCommand({
          Bucket: target,
          Key: key,
          Body: body,
          ContentType: "application/json",
          IfNoneMatch: "*",
        }),
      );
      destination = await readObject(target, key);
    }
    if (!sameContent(body, destination))
      throw new Error("Subscriber copy differs; public source was preserved");
    verified.push({ key, body });
  }
  if (mode === "remove-public") {
    for (const { key, body } of verified) {
      if (!sameContent(body, await readObject(source, key)))
        throw new Error(
          "Subscriber changed during migration; stop writes and retry",
        );
      await s3.send(new DeleteObjectCommand({ Bucket: source, Key: key }));
    }
  }
  return keys.length;
}
