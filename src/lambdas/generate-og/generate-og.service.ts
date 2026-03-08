import { uploadObject } from "../../shared/s3";
import { logInfo } from "../../shared/logger";
import { buildOgObjectKey, buildOgPublicUrl } from "../../shared/media";
import { generateOgImage } from "../../shared/og";
import { jsonResponse } from "../../shared/lambda";
import type { GenerateOgEvent, LambdaResponse, OgGenerationInput } from "../../shared/types";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeGenerateOgInput(event: GenerateOgEvent): OgGenerationInput | null {
  const title = isNonEmptyString(event.title) ? event.title : null;
  const slug = isNonEmptyString(event.slug) ? event.slug : null;
  const excerpt = isNonEmptyString(event.excerpt) ? event.excerpt : undefined;
  const date = isNonEmptyString(event.date) ? event.date : undefined;
  const tags = Array.isArray(event.tags)
    ? event.tags.filter((tag): tag is string => isNonEmptyString(tag))
    : [];

  if (!title || !slug) {
    return null;
  }

  return {
    title,
    slug,
    tags,
    ...(excerpt ? { excerpt } : {}),
    ...(date ? { date } : {}),
  };
}

export async function generateOg(event: GenerateOgEvent): Promise<LambdaResponse> {
  const input = normalizeGenerateOgInput(event);

  if (!input) {
    return jsonResponse(400, { error: "Title and slug are required" });
  }

  logInfo("Generating OG image", { slug: input.slug });

  const ogImageInput = {
    title: input.title,
    ...(input.tags ? { tags: input.tags } : {}),
    ...(input.excerpt ? { excerpt: input.excerpt } : {}),
    ...(input.date ? { date: input.date } : {}),
  };

  const image = await generateOgImage(ogImageInput);
  const key = buildOgObjectKey(input.slug);

  await uploadObject(key, image, "image/png");

  const url = buildOgPublicUrl(input.slug);

  logInfo("OG image uploaded", { slug: input.slug, url });

  return jsonResponse(200, {
    message: "OG image generated",
    url,
  });
}
