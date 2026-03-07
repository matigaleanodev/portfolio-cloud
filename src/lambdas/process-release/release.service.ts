import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";
import { handler as generateOgHandler } from "../generate-og/handler";
import { handler as notifyPostHandler } from "../notify-post/handler";
import { jsonResponse } from "../../shared/lambda";
import { logInfo } from "../../shared/logger";
import { requireEnv } from "../../shared/env";
import { s3 } from "../../shared/s3";
import type {
  LambdaResponse,
  ProcessReleaseEvent,
  ReleaseManifest,
  ReleasePost,
} from "../../shared/types";

const bucket = requireEnv("R2_BUCKET");
const processedPostsStateKey = "state/posts.json";

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

function isObjectNotFoundError(error: unknown): boolean {
  return error instanceof Error && (error.name === "NotFound" || error.name === "NoSuchKey");
}

function isReleasePost(value: unknown): value is ReleasePost {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.slug === "string" &&
    candidate.slug.trim().length > 0 &&
    typeof candidate.title === "string" &&
    candidate.title.trim().length > 0 &&
    typeof candidate.date === "string" &&
    candidate.date.trim().length > 0 &&
    typeof candidate.canonicalPath === "string" &&
    candidate.canonicalPath.trim().length > 0
  );
}

function isReleaseManifest(value: unknown): value is ReleaseManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const content = candidate.content;

  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return false;
  }

  const posts = (content as Record<string, unknown>).posts;

  return (
    typeof candidate.generatedAt === "string" &&
    typeof candidate.siteUrl === "string" &&
    Array.isArray(posts) &&
    posts.every((post) => isReleasePost(post))
  );
}

function normalizeSiteUrl(siteUrl: string): string {
  return siteUrl.endsWith("/") ? siteUrl.slice(0, -1) : siteUrl;
}

function buildCanonicalUrl(siteUrl: string, canonicalPath: string): string {
  const normalizedSiteUrl = normalizeSiteUrl(siteUrl);
  const normalizedPath = canonicalPath.startsWith("/") ? canonicalPath : `/${canonicalPath}`;

  return `${normalizedSiteUrl}${normalizedPath}`;
}

export async function loadProcessedPosts(): Promise<string[]> {
  try {
    const response = await s3.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: processedPostsStateKey,
      }),
    );

    if (!response.Body) {
      return [];
    }

    const rawBody = await streamToString(response.Body);
    const parsed: unknown = JSON.parse(rawBody);

    return Array.isArray(parsed)
      ? parsed.filter((slug): slug is string => typeof slug === "string" && slug.trim().length > 0)
      : [];
  } catch (error) {
    if (isObjectNotFoundError(error)) {
      return [];
    }

    throw error;
  }
}

export async function saveProcessedPosts(slugs: string[]): Promise<void> {
  const uniqueSlugs = [...new Set(slugs)];

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: processedPostsStateKey,
      Body: JSON.stringify(uniqueSlugs, null, 2),
      ContentType: "application/json",
    }),
  );
}

export function detectNewPosts(
  manifestPosts: ReleasePost[],
  processedSlugs: string[],
): ReleasePost[] {
  const processedSet = new Set(processedSlugs);

  return manifestPosts.filter((post) => !processedSet.has(post.slug));
}

export async function processPost(post: ReleasePost, siteUrl: string): Promise<void> {
  const postUrl = buildCanonicalUrl(siteUrl, post.canonicalPath);

  await generateOgHandler({
    slug: post.slug,
    title: post.title,
    date: post.date,
  });

  await notifyPostHandler({
    title: post.title,
    url: postUrl,
    date: post.date,
  });
}

export async function processRelease(
  event: ProcessReleaseEvent,
): Promise<LambdaResponse> {
  const manifest = event.manifest;

  if (!isReleaseManifest(manifest)) {
    return jsonResponse(400, { error: "Valid manifest is required" });
  }

  const processedSlugs = await loadProcessedPosts();
  const newPosts = detectNewPosts(manifest.content.posts, processedSlugs);

  if (newPosts.length === 0) {
    return jsonResponse(200, { message: "No new posts" });
  }

  for (const post of newPosts) {
    logInfo("Processing release post", { slug: post.slug });
    await processPost(post, manifest.siteUrl);
  }

  const updatedState = [...processedSlugs, ...newPosts.map((post) => post.slug)];

  await saveProcessedPosts(updatedState);

  return jsonResponse(200, {
    processedPosts: newPosts.map((post) => post.slug),
  });
}
