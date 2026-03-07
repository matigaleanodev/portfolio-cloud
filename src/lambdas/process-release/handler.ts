import type { LambdaResponse, ProcessReleaseEvent } from "../../shared/types";
import { processRelease } from "./release.service";

export const handler = async (event: ProcessReleaseEvent): Promise<LambdaResponse> =>
  processRelease(event);
