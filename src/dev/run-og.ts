import "dotenv/config";

import { handler } from "../lambdas/generate-og/handler";

async function run() {
  const event = {
    title: "Arquitectura de Modo Playa",
    slug: "arquitectura-modo-playa",
    excerpt:
      "API NestJS, MongoDB, aislamiento por ownerId y un pipeline backend para media e imagenes.",
    date: "2026-03-07",
    tags: ["nestjs", "mongodb", "architecture"],
  };

  const result = await handler(event);

  console.log("Lambda result:");
  console.log(result);
}

run().catch(console.error);
