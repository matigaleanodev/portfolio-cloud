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
  excerpt?: string;
  date?: string;
  tags?: string[];
};

export const handler = async (
  event: GenerateOgEvent,
): Promise<LambdaResponse> => {
  const title = readStringField(event.title);
  const slug = readStringField(event.slug);
  const excerpt = readStringField(event.excerpt);
  const date = readStringField(event.date);
  const tags = Array.isArray(event.tags)
    ? event.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
    : [];

  if (!title || !slug) {
    return jsonResponse(400, { error: "Title and slug are required" });
  }

  console.log("Generating OG image for:", slug);

  const ogInput = {
    title,
    tags,
    ...(excerpt ? { excerpt } : {}),
    ...(date ? { date } : {}),
  };

  const image = await generateOgImage(ogInput);

  const key = `${process.env.OG_OBJECT_PREFIX}/${slug}.png`;

  await uploadObject(key, image, "image/png");

  const url = `${process.env.MEDIA_BASE_URL}/${key}`;

  console.log("Uploaded to:", url);

  return jsonResponse(200, {
    message: "OG image generated",
    url,
  });
};
