import { jsonResponse } from "../../shared/lambda";
import { logInfo } from "../../shared/logger";
import {
  buildPublishedEditorialKnowledgeArtifact,
  isEditorialKnowledgeArtifact,
  publishEditorialKnowledgeArtifact,
} from "../../shared/editorial-knowledge";
import type {
  EditorialKnowledgeArtifact,
  LambdaResponse,
  PublishChatKnowledgeEvent,
} from "../../shared/types";

function getArtifact(
  event: PublishChatKnowledgeEvent,
): EditorialKnowledgeArtifact | undefined {
  return event.artifact;
}

export async function publishChatKnowledge(
  event: PublishChatKnowledgeEvent,
): Promise<LambdaResponse> {
  const artifact = getArtifact(event);

  if (!isEditorialKnowledgeArtifact(artifact)) {
    return jsonResponse(400, { error: "Valid chat knowledge artifact is required" });
  }

  const publishedArtifact = buildPublishedEditorialKnowledgeArtifact(artifact, {
    ...(event.release ? { release: event.release } : {}),
    ...(event.source ? { source: event.source } : {}),
  });
  const key = await publishEditorialKnowledgeArtifact(publishedArtifact);

  logInfo("Published chat knowledge artifact", {
    key,
    generatedAt: publishedArtifact.generatedAt,
    contentHash: publishedArtifact.contentHash,
  });

  return jsonResponse(200, {
    message: "Knowledge artifact published",
    key,
    generatedAt: publishedArtifact.generatedAt,
    contentHash: publishedArtifact.contentHash,
  });
}
