import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";
import { jsonResponse } from "../../shared/lambda";
import { logError, logInfo } from "../../shared/logger";
import { getEnv, requireEnv } from "../../shared/env";
import { assertLambdaSuccess, invokeLambda } from "../../shared/invoke-lambda";
import { s3 } from "../../shared/s3";
import type {
  GenerateOgEvent,
  LambdaResponse,
  NotifyPostEvent,
  ProcessReleaseEvent,
  ReleaseManifest,
  ReleasePost,
} from "../../shared/types";

const bucket = requireEnv("R2_BUCKET");
const generateOgFunctionName = requireEnv("GENERATE_OG_FUNCTION_NAME");
const notifyPostFunctionName = requireEnv("NOTIFY_POST_FUNCTION_NAME");
const processedPostsStateKey = "state/posts.json";
const legacyProcessedAt = new Date(0).toISOString();

type ReleaseStage = "generate-og" | "notify-post";

type ProcessedPostFailure = {
  stage: ReleaseStage;
  failedAt: string;
  attempts: number;
  message: string;
};

type ProcessedPostStateEntry = {
  ogGeneratedAt?: string;
  notifiedAt?: string;
  updatedAt: string;
  lastFailure?: ProcessedPostFailure | undefined;
};

type ProcessedPostsState = Record<string, ProcessedPostStateEntry>;

type PostProcessingFailure = {
  slug: string;
  stage: ReleaseStage;
  attempts: number;
  message: string;
  state?: ProcessedPostStateEntry;
};

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

function getReleaseStageMaxAttempts(): number {
  const configuredAttempts = Number(getEnv("RELEASE_STAGE_MAX_ATTEMPTS"));

  if (Number.isInteger(configuredAttempts) && configuredAttempts >= 1) {
    return configuredAttempts;
  }

  return 2;
}

function isProcessedPostStateEntry(value: unknown): value is ProcessedPostStateEntry {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.updatedAt === "string" &&
    (candidate.ogGeneratedAt === undefined || typeof candidate.ogGeneratedAt === "string") &&
    (candidate.notifiedAt === undefined || typeof candidate.notifiedAt === "string")
  );
}

function normalizeLegacyProcessedPostsState(slugs: string[]): ProcessedPostsState {
  return Object.fromEntries(
    slugs.map((slug) => [
      slug,
      {
        ogGeneratedAt: legacyProcessedAt,
        notifiedAt: legacyProcessedAt,
        updatedAt: legacyProcessedAt,
      },
    ]),
  );
}

function normalizeProcessedPostsState(value: unknown): ProcessedPostsState {
  if (Array.isArray(value)) {
    const slugs = value.filter(
      (slug): slug is string => typeof slug === "string" && slug.trim().length > 0,
    );

    return normalizeLegacyProcessedPostsState(slugs);
  }

  if (!value || typeof value !== "object") {
    return {};
  }

  const candidate = value as Record<string, unknown>;
  const entries = Object.entries(candidate).filter(
    ([slug, state]) => slug.trim().length > 0 && isProcessedPostStateEntry(state),
  );

  return Object.fromEntries(entries) as ProcessedPostsState;
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
  const state = await loadProcessedPostsState();

  return Object.entries(state)
    .filter(([, entry]) => typeof entry.notifiedAt === "string")
    .map(([slug]) => slug);
}

export async function loadProcessedPostsState(): Promise<ProcessedPostsState> {
  try {
    const response = await s3.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: processedPostsStateKey,
      }),
    );

    if (!response.Body) {
      return {};
    }

    const rawBody = await streamToString(response.Body);
    const parsed: unknown = JSON.parse(rawBody);

    return normalizeProcessedPostsState(parsed);
  } catch (error) {
    if (isObjectNotFoundError(error)) {
      return {};
    }

    throw error;
  }
}

export async function saveProcessedPosts(slugs: string[]): Promise<void> {
  const uniqueSlugs = [...new Set(slugs)];
  const state = normalizeLegacyProcessedPostsState(uniqueSlugs);

  await saveProcessedPostsState(state);
}

export async function saveProcessedPostsState(state: ProcessedPostsState): Promise<void> {
  const normalizedState = Object.fromEntries(
    Object.entries(state)
      .filter(([slug, entry]) => slug.trim().length > 0 && isProcessedPostStateEntry(entry))
      .sort(([leftSlug], [rightSlug]) => leftSlug.localeCompare(rightSlug)),
  );

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: processedPostsStateKey,
      Body: JSON.stringify(normalizedState, null, 2),
      ContentType: "application/json",
    }),
  );
}

export function detectNewPosts(
  manifestPosts: ReleasePost[],
  processedState: string[] | ProcessedPostsState,
): ReleasePost[] {
  const processedSet = Array.isArray(processedState)
    ? new Set(processedState)
    : new Set(
        Object.entries(processedState)
          .filter(([, entry]) => typeof entry.notifiedAt === "string")
          .map(([slug]) => slug),
      );

  return manifestPosts.filter((post) => !processedSet.has(post.slug));
}

async function invokeWithRetry<TPayload>(
  functionName: string,
  payload: TPayload,
  stage: ReleaseStage,
  slug: string,
): Promise<void> {
  const maxAttempts = getReleaseStageMaxAttempts();
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await invokeLambda(functionName, payload);

      assertLambdaSuccess(functionName, response);

      if (attempt > 1) {
        logInfo("Stage succeeded after retry", {
          slug,
          stage,
          attempt,
        });
      }

      return;
    } catch (error) {
      lastError = error;

      logError("Stage invocation failed", {
        slug,
        stage,
        attempt,
        maxAttempts,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  throw {
    slug,
    stage,
    attempts: maxAttempts,
    message:
      lastError instanceof Error ? lastError.message : `Stage ${stage} failed for post ${slug}`,
  } satisfies PostProcessingFailure;
}

function buildFailureEntry(error: PostProcessingFailure): ProcessedPostFailure {
  return {
    stage: error.stage,
    failedAt: new Date().toISOString(),
    attempts: error.attempts,
    message: error.message,
  };
}

function isPostProcessingFailure(error: unknown): error is PostProcessingFailure {
  if (!error || typeof error !== "object" || Array.isArray(error)) {
    return false;
  }

  const candidate = error as Record<string, unknown>;

  return (
    typeof candidate.slug === "string" &&
    (candidate.stage === "generate-og" || candidate.stage === "notify-post") &&
    typeof candidate.attempts === "number" &&
    typeof candidate.message === "string"
  );
}

function buildStateEntryUpdate(
  currentEntry: ProcessedPostStateEntry | undefined,
  updates: Partial<ProcessedPostStateEntry>,
): ProcessedPostStateEntry {
  const nextEntry: ProcessedPostStateEntry = {
    ...currentEntry,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  if (updates.lastFailure === undefined) {
    delete nextEntry.lastFailure;
  }

  return nextEntry;
}

export async function processPost(
  post: ReleasePost,
  siteUrl: string,
  currentState?: ProcessedPostStateEntry,
): Promise<ProcessedPostStateEntry> {
  const postUrl = buildCanonicalUrl(siteUrl, post.canonicalPath);
  let nextState = currentState ?? { updatedAt: new Date().toISOString() };

  if (!nextState.ogGeneratedAt) {
    try {
      await invokeWithRetry<GenerateOgEvent>(
        generateOgFunctionName,
        {
          slug: post.slug,
          title: post.title,
          date: post.date,
        },
        "generate-og",
        post.slug,
      );
    } catch (error) {
      if (isPostProcessingFailure(error)) {
        throw {
          ...error,
          state: nextState,
        } satisfies PostProcessingFailure;
      }

      throw error;
    }
    nextState = buildStateEntryUpdate(nextState, {
      ogGeneratedAt: new Date().toISOString(),
      lastFailure: undefined,
    });
  }

  if (!nextState.notifiedAt) {
    try {
      await invokeWithRetry<NotifyPostEvent>(
        notifyPostFunctionName,
        {
          title: post.title,
          url: postUrl,
          date: post.date,
        },
        "notify-post",
        post.slug,
      );
    } catch (error) {
      if (isPostProcessingFailure(error)) {
        throw {
          ...error,
          state: nextState,
        } satisfies PostProcessingFailure;
      }

      throw error;
    }
    nextState = buildStateEntryUpdate(nextState, {
      notifiedAt: new Date().toISOString(),
      lastFailure: undefined,
    });
  }

  return nextState;
}

export async function processRelease(
  event: ProcessReleaseEvent,
): Promise<LambdaResponse> {
  const manifest = event.manifest;

  if (!isReleaseManifest(manifest)) {
    return jsonResponse(400, { error: "Valid manifest is required" });
  }

  const processedState = await loadProcessedPostsState();
  const newPosts = detectNewPosts(manifest.content.posts, processedState);

  if (newPosts.length === 0) {
    return jsonResponse(200, { message: "No new posts" });
  }

  const processedPosts: string[] = [];
  const failedPosts: PostProcessingFailure[] = [];

  for (const post of newPosts) {
    logInfo("Processing release post", { slug: post.slug });

    try {
      processedState[post.slug] = await processPost(post, manifest.siteUrl, processedState[post.slug]);
      await saveProcessedPostsState(processedState);
      processedPosts.push(post.slug);
    } catch (error) {
      const failure: PostProcessingFailure = isPostProcessingFailure(error)
        ? error
        : {
            slug: post.slug,
            stage: "notify-post",
            attempts: getReleaseStageMaxAttempts(),
            message: error instanceof Error ? error.message : "Unknown post processing failure",
          };

      processedState[post.slug] = buildStateEntryUpdate(failure.state ?? processedState[post.slug], {
        lastFailure: buildFailureEntry(failure),
      });
      await saveProcessedPostsState(processedState);
      failedPosts.push(failure);
    }
  }

  if (failedPosts.length > 0) {
    return jsonResponse(500, {
      message: "Release processed with partial failures",
      processedPosts,
      failedPosts,
    });
  }

  return jsonResponse(200, {
    processedPosts,
  });
}
