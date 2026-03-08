import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createHash } from "node:crypto";
import { getEnv, requireEnv } from "./env";
import { s3 } from "./s3";
import type {
  EditorialKnowledgeArtifact,
  EditorialKnowledgeLink,
  EditorialKnowledgeRelease,
  EditorialKnowledgeSource,
  EditorialPostEntry,
  EditorialProjectEntry,
  PublishedEditorialKnowledgeArtifact,
} from "./types";

const bucket = requireEnv("R2_BUCKET");

export const DEFAULT_CHAT_KNOWLEDGE_OBJECT_KEY = "artifacts/chat/knowledge.json";
export const DEFAULT_CHAT_KNOWLEDGE_SOURCE: EditorialKnowledgeSource = {
  repository: "portfolio",
  artifactPath: ".generated/chat/knowledge.json",
};

export function getChatKnowledgeObjectKey(): string {
  return getEnv("CHAT_KNOWLEDGE_OBJECT_KEY") ?? DEFAULT_CHAT_KNOWLEDGE_OBJECT_KEY;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => isNonEmptyString(item));
}

function isKnowledgeLink(value: unknown): value is EditorialKnowledgeLink {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    isNonEmptyString(candidate.label) &&
    isNonEmptyString(candidate.url) &&
    (candidate.icon === undefined || isNonEmptyString(candidate.icon))
  );
}

function isProjectEntry(value: unknown): value is EditorialProjectEntry {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    isNonEmptyString(candidate.slug) &&
    isNonEmptyString(candidate.title) &&
    isNonEmptyString(candidate.excerpt) &&
    (candidate.stack === undefined || isStringArray(candidate.stack)) &&
    (candidate.links === undefined ||
      (Array.isArray(candidate.links) && candidate.links.every((link) => isKnowledgeLink(link)))) &&
    (candidate.highlights === undefined || isStringArray(candidate.highlights)) &&
    (candidate.searchText === undefined || isNonEmptyString(candidate.searchText))
  );
}

function isPostEntry(value: unknown): value is EditorialPostEntry {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    isNonEmptyString(candidate.slug) &&
    isNonEmptyString(candidate.title) &&
    isNonEmptyString(candidate.excerpt) &&
    isNonEmptyString(candidate.date) &&
    (candidate.tags === undefined || isStringArray(candidate.tags)) &&
    (candidate.canonicalUrl === undefined || isNonEmptyString(candidate.canonicalUrl)) &&
    (candidate.summary === undefined || isNonEmptyString(candidate.summary)) &&
    (candidate.searchText === undefined || isNonEmptyString(candidate.searchText))
  );
}

export function isEditorialKnowledgeArtifact(
  value: unknown,
): value is EditorialKnowledgeArtifact {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    isNonEmptyString(candidate.generatedAt) &&
    (candidate.projects === undefined ||
      (Array.isArray(candidate.projects) &&
        candidate.projects.every((entry) => isProjectEntry(entry)))) &&
    (candidate.posts === undefined ||
      (Array.isArray(candidate.posts) && candidate.posts.every((entry) => isPostEntry(entry))))
  );
}

function normalizeArtifact(
  artifact: EditorialKnowledgeArtifact,
): EditorialKnowledgeArtifact {
  return {
    generatedAt: artifact.generatedAt,
    ...(artifact.projects ? { projects: artifact.projects } : {}),
    ...(artifact.posts ? { posts: artifact.posts } : {}),
  };
}

export function buildEditorialKnowledgeHash(
  artifact: EditorialKnowledgeArtifact,
): string {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(normalizeArtifact(artifact)))
    .digest("hex")}`;
}

export function buildPublishedEditorialKnowledgeArtifact(
  artifact: EditorialKnowledgeArtifact,
  options?: {
    source?: Partial<EditorialKnowledgeSource>;
    release?: EditorialKnowledgeRelease;
  },
): PublishedEditorialKnowledgeArtifact {
  return {
    version: 1,
    generatedAt: artifact.generatedAt,
    source: {
      repository:
        options?.source?.repository ?? DEFAULT_CHAT_KNOWLEDGE_SOURCE.repository,
      artifactPath:
        options?.source?.artifactPath ?? DEFAULT_CHAT_KNOWLEDGE_SOURCE.artifactPath,
    },
    ...(options?.release ? { release: options.release } : {}),
    contentHash: buildEditorialKnowledgeHash(artifact),
    knowledge: normalizeArtifact(artifact),
  };
}

export async function publishEditorialKnowledgeArtifact(
  artifact: PublishedEditorialKnowledgeArtifact,
): Promise<string> {
  const key = getChatKnowledgeObjectKey();

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(artifact, null, 2),
      ContentType: "application/json",
    }),
  );

  return key;
}
