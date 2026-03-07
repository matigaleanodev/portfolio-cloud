import { generateOgImage } from "../../shared/og";
import {
  jsonResponse,
  readStringField,
  type LambdaResponse,
} from "../../shared/lambda";
import { uploadObject } from "../../shared/s3";

type GenerateOgEvent = {
  title?: string;
  slug?: string;
};

export const handler = async (
  event: GenerateOgEvent,
): Promise<LambdaResponse> => {
  const title = readStringField(event.title);
  const slug = readStringField(event.slug);

  if (!title || !slug) {
    return jsonResponse(400, { error: "Title and slug are required" });
  }

  console.log("Generating OG image for:", slug);

  const image = await generateOgImage(title);

  const key = `${process.env.OG_OBJECT_PREFIX}/${slug}.png`;

  await uploadObject(key, image, "image/png");

  const url = `${process.env.MEDIA_BASE_URL}/${key}`;

  console.log("Uploaded to:", url);

  return jsonResponse(200, {
    message: "OG image generated",
    url,
  });
};
