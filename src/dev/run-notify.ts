import "dotenv/config";
import { handler } from "../lambdas/notify-post/handler";

async function run() {
  const event = {
    title: "Arquitectura de Modo Playa",
    url: "https://matiasgaleano.dev/blog/arquitectura-modo-playa",
  };

  const result = await handler(event);

  console.log(result);
}

run().catch(console.error);
