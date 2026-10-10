import { requireEnv } from "../shared/env";
import { migrateSubscribers } from "../shared/subscriber-migration";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (
    args.some((arg) => !["--copy", "--remove-public"].includes(arg)) ||
    args.length > 1
  ) {
    throw new Error(
      "Use no arguments to plan, --copy to copy, or --remove-public after runtime cutover",
    );
  }
  const mode =
    args[0] === "--copy"
      ? "copy"
      : args[0] === "--remove-public"
        ? "remove-public"
        : "plan";
  if (
    mode === "remove-public" &&
    process.env.SUBSCRIBERS_MIGRATION_CUTOVER_CONFIRMED !== "true"
  ) {
    throw new Error(
      "Pause subscription writes and confirm private runtime cutover before removing public copies",
    );
  }
  const count = await migrateSubscribers(
    requireEnv("R2_BUCKET"),
    requireEnv("SUBSCRIBERS_BUCKET"),
    mode,
  );
  console.log(JSON.stringify({ mode, subscribers: count }));
}

main().catch(() => {
  // No imprime errores del proveedor que puedan incluir claves con emails.
  console.error(
    "Subscriber migration failed; inspect configuration and keep subscription writes paused.",
  );
  process.exitCode = 1;
});
