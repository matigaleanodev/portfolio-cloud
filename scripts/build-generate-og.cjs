const { build } = require("esbuild");
const { cpSync, existsSync, mkdirSync } = require("node:fs");
const { dirname, join } = require("node:path");

const artifactsDir = process.argv[2];

if (!artifactsDir) {
  throw new Error("Missing artifacts directory for GenerateOgFunction build.");
}

const repoRoot = process.cwd();
const handlerOutfile = join(
  artifactsDir,
  "src",
  "lambdas",
  "generate-og",
  "handler.js",
);

function copyDirectoryIfPresent(sourceDir, targetDir) {
  if (!existsSync(sourceDir)) {
    return false;
  }

  mkdirSync(dirname(targetDir), { recursive: true });
  cpSync(sourceDir, targetDir, { recursive: true });

  return true;
}

async function main() {
  mkdirSync(dirname(handlerOutfile), { recursive: true });

  await build({
    entryPoints: [join(repoRoot, "src", "lambdas", "generate-og", "handler.ts")],
    outfile: handlerOutfile,
    bundle: true,
    format: "cjs",
    minify: true,
    platform: "node",
    sourcemap: true,
    target: "es2022",
    external: ["@resvg/resvg-js"],
  });

  const copiedResvgScope = copyDirectoryIfPresent(
    join(repoRoot, "node_modules", "@resvg"),
    join(artifactsDir, "node_modules", "@resvg"),
  );

  if (!copiedResvgScope) {
    throw new Error("Missing @resvg packages in node_modules for GenerateOgFunction build.");
  }

  const copiedFonts = copyDirectoryIfPresent(
    join(repoRoot, "assets", "og", "fonts"),
    join(artifactsDir, "assets", "og", "fonts"),
  );

  if (!copiedFonts) {
    throw new Error("Missing local OG font assets. Expected assets/og/fonts to exist.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
