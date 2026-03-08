import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { OgGenerationInput } from "./types";

type ResvgModule = typeof import("@resvg/resvg-js");
const requireFromOgModule = createRequire(__filename);

function loadResvg(): ResvgModule {
  return requireFromOgModule("@resvg/resvg-js") as ResvgModule;
}

const theme = {
  background: "#e5e7eb",
  text: "#1f2937",
  muted: "#4b5563",
  accent: "#5b5f8f",
  dark: "#111827",
};

const ogFontFiles = [
  "IBMPlexSans-Regular.ttf",
  "IBMPlexSans-SemiBold.ttf",
  "IBMPlexMono-Regular.ttf",
  "IBMPlexMono-Medium.ttf",
].map((fileName) => join(process.cwd(), "assets", "og", "fonts", fileName));

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

function wrapText(value: string, maxCharactersPerLine: number, maxLines: number): string[] {
  const words = value.trim().split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;

    if (candidate.length <= maxCharactersPerLine) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      lines.push(word);
      currentLine = "";
    }

    if (lines.length === maxLines) {
      break;
    }
  }

  if (lines.length < maxLines && currentLine) {
    lines.push(currentLine);
  }

  if (lines.length > maxLines) {
    lines.length = maxLines;
  }

  const hasOverflow = words.join(" ").length > lines.join(" ").length;

  if (hasOverflow && lines.length > 0) {
    const lastLineIndex = lines.length - 1;
    const lastLine = lines[lastLineIndex];

    if (lastLine) {
      lines[lastLineIndex] = truncate(lastLine, maxCharactersPerLine);
    }
  }

  return lines;
}

function renderTextLines({
  lines,
  x,
  y,
  fontSize,
  lineHeight,
  fill,
  fontFamily,
  fontWeight,
  letterSpacing,
}: {
  lines: string[];
  x: number;
  y: number;
  fontSize: number;
  lineHeight: number;
  fill: string;
  fontFamily: string;
  fontWeight: number;
  letterSpacing?: string;
}): string {
  const safeLines = lines.map((line) => escapeXml(line));

  return `
    <text x="${x}" y="${y}" fill="${fill}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}"${
      letterSpacing ? ` letter-spacing="${letterSpacing}"` : ""
    }>
      ${safeLines
        .map((line, index) => {
          const dy = index === 0 ? 0 : lineHeight;
          return `<tspan x="${x}" dy="${dy}">${line}</tspan>`;
        })
        .join("")}
    </text>
  `;
}

export async function generateOgImage({
  title,
  excerpt,
  tags = [],
}: Omit<OgGenerationInput, "slug">): Promise<Buffer> {
  const { Resvg } = loadResvg();
  const width = 1200;
  const height = 630;
  const titleLines = wrapText(truncate(title, 96), 25, 3);
  const excerptLines = excerpt ? wrapText(truncate(excerpt, 150), 52, 2) : [];
  const displayTags = tags.slice(0, 3).map((tag) => escapeXml(tag.toUpperCase()));
  const titleMarkup = renderTextLines({
    lines: titleLines,
    x: 118,
    y: 252,
    fontSize: 64,
    lineHeight: 68,
    fill: theme.background,
    fontFamily: "IBM Plex Sans",
    fontWeight: 600,
    letterSpacing: "-2px",
  });
  const titleBottom = 252 + (titleLines.length - 1) * 68;
  const excerptY = titleBottom + 62;
  const excerptMarkup = excerptLines.length
    ? renderTextLines({
        lines: excerptLines,
        x: 122,
        y: excerptY,
        fontSize: 26,
        lineHeight: 38,
        fill: "rgba(229,231,235,0.82)",
        fontFamily: "IBM Plex Sans",
        fontWeight: 400,
      })
    : "";
  const tagsY = Math.min(492, excerptLines.length ? excerptY + excerptLines.length * 38 + 24 : 454);
  const tagsMarkup = displayTags
    .map(
      (tag, index) => `
        <g transform="translate(${120 + index * 172}, ${tagsY})">
          <rect width="152" height="38" rx="19" fill="rgba(255,255,255,0.42)" stroke="rgba(31,41,55,0.1)" />
          <text x="76" y="24" text-anchor="middle" font-size="16" font-weight="600" fill="${theme.text}" font-family="IBM Plex Sans">${tag}</text>
        </g>
      `,
    )
    .join("");

  const svg = `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="pageWash" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${theme.background}" />
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
    <circle cx="138" cy="96" r="86" fill="rgba(255,255,255,0.22)" />

    <rect x="68" y="68" width="1064" height="494" rx="34" fill="${theme.dark}" />
    <rect x="69" y="69" width="1062" height="492" rx="33" fill="url(#cardSurface)" opacity="0.22" />
    <rect x="92" y="96" width="1016" height="438" rx="28" fill="rgba(255,255,255,0.06)" stroke="rgba(229,231,235,0.12)" />
    <rect x="94" y="98" width="1012" height="46" rx="22" fill="rgba(255,255,255,0.03)" />

    <line x1="120" y1="144" x2="188" y2="144" stroke="${theme.background}" stroke-width="4" stroke-linecap="round" />
    <text x="120" y="182" font-size="18" letter-spacing="5" font-weight="600" fill="rgba(229,231,235,0.64)" font-family="IBM Plex Sans">POST TECNICO</text>

    ${titleMarkup}
    ${excerptMarkup}

    ${tagsMarkup}

    <g transform="translate(924 124)">
      <rect width="148" height="148" rx="28" fill="rgba(229,231,235,0.06)" stroke="rgba(229,231,235,0.12)" />
      <circle cx="74" cy="74" r="26" fill="rgba(91,95,143,0.92)" />
      <circle cx="74" cy="74" r="10" fill="${theme.background}" />
    </g>

    <text x="900" y="334" font-size="14" letter-spacing="3" font-weight="600" fill="rgba(229,231,235,0.58)" font-family="IBM Plex Mono">matiasgaleano.dev/blog</text>
    <text x="900" y="378" font-size="28" font-weight="600" fill="${theme.background}" font-family="IBM Plex Sans">portfolio cloud</text>
    <text x="900" y="414" font-size="28" font-weight="600" fill="${theme.background}" font-family="IBM Plex Sans">og automation</text>
    <text x="900" y="464" font-size="18" font-weight="400" fill="rgba(229,231,235,0.78)" font-family="IBM Plex Sans">mismo lenguaje visual del front</text>
  </svg>
  `;

  const resvg = new Resvg(svg, {
    fitTo: {
      mode: "width",
      value: width,
    },
    font: {
      fontFiles: ogFontFiles.filter((fontFile) => existsSync(fontFile)),
      defaultFontFamily: "IBM Plex Sans",
      loadSystemFonts: false,
    },
  });

  const buffer = Buffer.from(resvg.render().asPng());

  return buffer;
}
