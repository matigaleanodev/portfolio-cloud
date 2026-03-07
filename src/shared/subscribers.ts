import {
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { s3 } from "./s3";

const bucket = process.env.R2_BUCKET!;
const subscribersPrefix = "subscribers/";
const subscriberFileSuffix = ".json";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SubscriberRecord = {
  email: string;
  createdAt: string;
};

type SubscriberDeleteResult = "deleted" | "missing";
type SubscriberCreateResult = "created" | "exists";

export function normalizeSubscriberEmail(email: string): string {
  return decodeURIComponent(email).trim().toLowerCase();
}

export function isValidSubscriberEmail(email: string): boolean {
  return emailPattern.test(email);
}

export function buildSubscriberKey(email: string): string {
  return `${subscribersPrefix}${normalizeSubscriberEmail(email)}${subscriberFileSuffix}`;
}

function isObjectNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.name === "NotFound" || error.name === "NoSuchKey";
}

export async function subscriberExists(email: string): Promise<boolean> {
  try {
    await s3.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: buildSubscriberKey(email),
      }),
    );

    return true;
  } catch (error) {
    if (isObjectNotFoundError(error)) {
      return false;
    }

    throw error;
  }
}

export async function createSubscriber(
  email: string,
): Promise<SubscriberCreateResult> {
  const normalizedEmail = normalizeSubscriberEmail(email);

  if (await subscriberExists(normalizedEmail)) {
    return "exists";
  }

  const subscriber: SubscriberRecord = {
    email: normalizedEmail,
    createdAt: new Date().toISOString(),
  };

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: buildSubscriberKey(normalizedEmail),
      Body: JSON.stringify(subscriber, null, 2),
      ContentType: "application/json",
    }),
  );

  return "created";
}

export async function deleteSubscriber(
  email: string,
): Promise<SubscriberDeleteResult> {
  const normalizedEmail = normalizeSubscriberEmail(email);

  if (!(await subscriberExists(normalizedEmail))) {
    return "missing";
  }

  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: buildSubscriberKey(normalizedEmail),
    }),
  );

  return "deleted";
}

function parseSubscriberEmailFromKey(key: string): string | null {
  if (!key.startsWith(subscribersPrefix) || !key.endsWith(subscriberFileSuffix)) {
    return null;
  }

  const email = key.slice(
    subscribersPrefix.length,
    key.length - subscriberFileSuffix.length,
  );

  return email || null;
}

export async function listSubscriberEmails(): Promise<string[]> {
  const emails = new Set<string>();
  let continuationToken: string | undefined;

  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: subscribersPrefix,
        ContinuationToken: continuationToken,
      }),
    );

    for (const object of response.Contents ?? []) {
      const key = object.Key;

      if (!key) {
        continue;
      }

      const email = parseSubscriberEmailFromKey(key);

      if (email) {
        emails.add(email);
      }
    }

    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return [...emails];
}
