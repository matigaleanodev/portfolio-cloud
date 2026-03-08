import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { generateOgImage } from "../shared/og";

async function run() {
  const image = await generateOgImage({
    title: "Test flujo completo de Resend y OG",
    excerpt:
      "Pipeline editorial serverless con AWS Lambda, R2 y Resend alineado visualmente con el portfolio.",
    tags: ["aws", "serverless", "blog"],
  });

  const outputPath = join(process.cwd(), "og-preview.png");
  await writeFile(outputPath, image);

  console.log(`OG preview written to ${outputPath}`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
