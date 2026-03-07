import type { GenerateOgEvent, LambdaResponse } from "../../shared/types";
import { generateOg } from "./generate-og.service";

export const handler = async (
  event: GenerateOgEvent,
): Promise<LambdaResponse> => {
  return generateOg(event);
};
