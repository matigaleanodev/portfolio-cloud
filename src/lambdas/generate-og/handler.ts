import { generateOgImage } from "../../shared/og";
import fs from "fs";

export const handler = async (event: any) => {
  const { title, slug } = event;

  console.log("Generating OG image for:", slug);

  const image = await generateOgImage(title);

  fs.writeFileSync(`og-${slug}.png`, image);

  console.log("Image generated:", image.length, "bytes");

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "OG image generated",
      slug,
    }),
  };
};
