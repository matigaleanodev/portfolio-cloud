import { createRequire } from "node:module";
import type { OgGenerationInput } from "./types";

type SharpModule = typeof import("sharp");
const requireFromOgModule = createRequire(__filename);

function loadSharp(): SharpModule {
  return requireFromOgModule("sharp") as SharpModule;
}

const palette = {
  background: "#e5e7eb",
  text: "#1f2937",
  muted: "#4b5563",
  accent: "#5b5f8f",
  surface: "#f4f4f5",
  dark: "#111827",
};

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function formatDateLabel(date?: string): string {
  if (!date) {
    return "Blog post";
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Blog post";
  }

  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsedDate);
}

export async function generateOgImage({
  title,
  excerpt,
  tags = [],
  date,
}: Omit<OgGenerationInput, "slug">): Promise<Buffer> {
  const sharp = loadSharp();
  const width = 1200;
  const height = 630;
  const safeTitle = escapeXml(truncate(title, 96));
  const safeExcerpt = excerpt ? escapeXml(truncate(excerpt, 180)) : null;
  const displayTags = tags.slice(0, 3).map((tag) => escapeXml(tag.toUpperCase()));
  const metaLabel = escapeXml(formatDateLabel(date));
  const tagsMarkup = displayTags
    .map(
      (tag, index) => `
        <g transform="translate(${120 + index * 172}, 494)">
          <rect width="152" height="38" rx="19" fill="rgba(255,255,255,0.42)" stroke="rgba(31,41,55,0.1)" />
          <text x="76" y="24" text-anchor="middle" font-size="16" font-weight="600" fill="${palette.text}" font-family="'IBM Plex Sans', 'Segoe UI', sans-serif">${tag}</text>
        </g>
      `,
    )
    .join("");

  const svg = `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="pageWash" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${palette.background}" />
        <stop offset="100%" stop-color="#d7dae2" />
      </linearGradient>
      <radialGradient id="accentGlow" cx="82%" cy="14%" r="36%">
        <stop offset="0%" stop-color="rgba(91,95,143,0.28)" />
        <stop offset="100%" stop-color="rgba(91,95,143,0)" />
      </radialGradient>
      <linearGradient id="cardSurface" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="rgba(255,255,255,0.58)" />
        <stop offset="100%" stop-color="rgba(255,255,255,0.18)" />
      </linearGradient>
    </defs>

    <rect width="100%" height="100%" fill="url(#pageWash)" />
    <rect width="100%" height="100%" fill="url(#accentGlow)" />
    <circle cx="1060" cy="96" r="132" fill="rgba(91,95,143,0.12)" />
    <circle cx="1092" cy="122" r="34" fill="rgba(91,95,143,0.28)" />

    <rect x="68" y="68" width="1064" height="494" rx="34" fill="${palette.dark}" />
    <rect x="69" y="69" width="1062" height="492" rx="33" fill="url(#cardSurface)" opacity="0.22" />
    <rect x="92" y="96" width="1016" height="438" rx="28" fill="rgba(255,255,255,0.06)" stroke="rgba(229,231,235,0.12)" />

    <line x1="120" y1="144" x2="188" y2="144" stroke="${palette.background}" stroke-width="4" stroke-linecap="round" />
    <text x="120" y="182" font-size="18" letter-spacing="5" font-weight="600" fill="rgba(229,231,235,0.64)" font-family="'IBM Plex Sans', 'Segoe UI', sans-serif">POST TECNICO</text>
    <text x="120" y="220" font-size="18" letter-spacing="2.5" font-weight="500" fill="rgba(229,231,235,0.58)" font-family="'IBM Plex Mono', 'Courier New', monospace">${metaLabel}</text>

    <foreignObject x="118" y="246" width="760" height="174">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif; font-size: 74px; line-height: 0.94; font-weight: 650; letter-spacing: -0.04em; color: ${palette.background};">
        ${safeTitle}
      </div>
    </foreignObject>

    ${
      safeExcerpt
        ? `
    <foreignObject x="122" y="414" width="690" height="92">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif; font-size: 28px; line-height: 1.45; color: rgba(229,231,235,0.82);">
        ${safeExcerpt}
      </div>
    </foreignObject>`
        : ""
    }

    ${tagsMarkup}

    <g transform="translate(924 124)">
      <rect width="148" height="148" rx="28" fill="rgba(229,231,235,0.06)" stroke="rgba(229,231,235,0.12)" />
      <circle cx="74" cy="74" r="26" fill="rgba(91,95,143,0.92)" />
      <circle cx="74" cy="74" r="10" fill="${palette.background}" />
    </g>

    <text x="924" y="334" font-size="14" letter-spacing="3" font-weight="600" fill="rgba(229,231,235,0.58)" font-family="'IBM Plex Mono', 'Courier New', monospace">matiasgaleano.dev/blog</text>
  </svg>
  `;

  const buffer = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();

  return buffer;
}
