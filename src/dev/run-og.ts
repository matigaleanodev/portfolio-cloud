import "dotenv/config";

import { handler } from "../lambdas/generate-og/handler";

async function run() {
  const event = {
    title: "Arquitectura de Modo Playa",
    slug: "arquitectura-modo-playa",
  };

  const result = await handler(event);

  console.log("Lambda result:");
  console.log(result);
}

run().catch(console.error);
