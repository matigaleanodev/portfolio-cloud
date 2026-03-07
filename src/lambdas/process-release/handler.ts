import type {
  LambdaResponse,
  ProcessReleaseEvent,
  ProcessReleaseInvocation,
  ReleaseManifest,
} from "../../shared/types";
import { processRelease } from "./release.service";

function isReleaseManifest(value: unknown): value is ReleaseManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const content = candidate.content;

  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return false;
  }

  return (
    typeof candidate.generatedAt === "string" &&
    typeof candidate.siteUrl === "string" &&
    Array.isArray((content as Record<string, unknown>).posts)
  );
}

function normalizeProcessReleaseEvent(
  event: ProcessReleaseInvocation,
): ProcessReleaseEvent {
  return isReleaseManifest(event) ? { manifest: event } : event;
}

export const handler = async (
  event: ProcessReleaseInvocation,
): Promise<LambdaResponse> => processRelease(normalizeProcessReleaseEvent(event));
