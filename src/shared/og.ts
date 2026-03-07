import sharp from "sharp";

export async function generateOgImage(title: string): Promise<Buffer> {
  const width = 1200;
  const height = 630;

  const svg = `
  <svg width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="#0f172a" />
    <text
      x="50%"
      y="50%"
      font-size="64"
      fill="white"
      text-anchor="middle"
      font-family="Inter, sans-serif"
    >
      ${title}
    </text>
  </svg>
  `;

  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();

  return buffer;
}
