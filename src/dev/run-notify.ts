import "../shared/env";
import { handler } from "../lambdas/notify-post/handler";

async function run() {
  const event = {
    title: "Arquitectura de Modo Playa",
    url: "https://matiasgaleano.dev/blog/arquitectura-modo-playa",
    excerpt:
      "Una arquitectura multi-tenant real con NestJS, MongoDB, limites claros entre catalogo publico y admin.",
    date: "2026-03-07",
    tags: ["nestjs", "architecture", "backend"],
  };

  const result = await handler(event);

  console.log(result);
}

run().catch(console.error);
