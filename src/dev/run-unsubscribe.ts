import "../shared/env";
import { handler } from "../lambdas/unsubscribe/handler";

async function run() {
  const result = await handler({
    email: "contacto@matiasgaleano.dev",
  });

  console.log(result);
}

run().catch(console.error);
