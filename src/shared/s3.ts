import "dotenv/config";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export async function uploadObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const bucket = process.env.R2_BUCKET!;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

const s3Config: ConstructorParameters<typeof S3Client>[0] = {
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
};

if (process.env.R2_REGION) {
  s3Config.region = process.env.R2_REGION;
}

if (process.env.R2_ENDPOINT) {
  s3Config.endpoint = process.env.R2_ENDPOINT;
}

export const s3 = new S3Client(s3Config);
