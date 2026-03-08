import {
  isEditorialKnowledgeArtifact,
} from "../../shared/editorial-knowledge";
import type {
  LambdaResponse,
  PublishChatKnowledgeEvent,
  PublishChatKnowledgeInvocation,
} from "../../shared/types";
import { publishChatKnowledge } from "./publish-chat-knowledge.service";

function normalizePublishChatKnowledgeEvent(
  event: PublishChatKnowledgeInvocation,
): PublishChatKnowledgeEvent {
  return isEditorialKnowledgeArtifact(event) ? { artifact: event } : event;
}

export const handler = async (
  event: PublishChatKnowledgeInvocation,
): Promise<LambdaResponse> => publishChatKnowledge(normalizePublishChatKnowledgeEvent(event));
