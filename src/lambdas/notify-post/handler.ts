import type { LambdaResponse, NotifyPostEvent } from "../../shared/types";
import { notifyPost } from "./notify.service";

export const handler = async (
  event: NotifyPostEvent,
): Promise<LambdaResponse> => {
  return notifyPost(event);
};
