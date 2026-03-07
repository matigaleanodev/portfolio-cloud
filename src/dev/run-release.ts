import "../shared/env";
import { handler } from "../lambdas/process-release/handler";

async function run() {
  const result = await handler({
    manifest: {
      generatedAt: "2026-03-07T15:00:00Z",
      siteUrl: "https://matiasgaleano.dev",
      content: {
        posts: [
          {
            slug: "arquitectura-modo-playa",
            title: "Como disene la arquitectura de Modo Playa",
            date: "2026-03-07",
            canonicalPath: "/blog/arquitectura-modo-playa",
          },
        ],
      },
    },
  });

  console.log(result);
}

run().catch(console.error);
