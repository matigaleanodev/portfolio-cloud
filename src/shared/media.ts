import { getEnv, requireEnv } from "./env";

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/g, "");
}

export function getMediaBaseUrl(): string {
  return normalizeBaseUrl(requireEnv("MEDIA_BASE_URL"));
}

export function getOgObjectPrefix(): string {
  return trimSlashes(getEnv("OG_OBJECT_PREFIX") || "og");
}

export function buildOgObjectKey(slug: string): string {
  const normalizedSlug = trimSlashes(slug);

  return `${getOgObjectPrefix()}/${normalizedSlug}.png`;
}

export function buildOgPublicUrl(slug: string): string {
  return `${getMediaBaseUrl()}/${buildOgObjectKey(slug)}`;
}
