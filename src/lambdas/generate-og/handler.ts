import { generateOgImage } from "../../shared/og";
import { uploadObject } from "../../shared/s3";

export const handler = async (event: any) => {
  const { title, slug } = event;

  console.log("Generating OG image for:", slug);

  const image = await generateOgImage(title);

  const key = `${process.env.OG_OBJECT_PREFIX}/${slug}.png`;

  await uploadObject(key, image, "image/png");

  const url = `${process.env.MEDIA_BASE_URL}/${key}`;

  console.log("Uploaded to:", url);

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "OG image generated",
      url,
    }),
  };
};
