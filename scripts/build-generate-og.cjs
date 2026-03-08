const { build } = require("esbuild");
const { cpSync, existsSync, mkdirSync, readdirSync } = require("node:fs");
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

function packageSourceDir(packageName) {
  return join(repoRoot, "node_modules", ...packageName.split("/"));
}

function copyPackage(packageName) {
  const sourceDir = packageSourceDir(packageName);

  if (!existsSync(sourceDir)) {
    return false;
  }

  const targetDir = join(artifactsDir, "node_modules", ...packageName.split("/"));
  mkdirSync(dirname(targetDir), { recursive: true });
  cpSync(sourceDir, targetDir, { recursive: true });

  return true;
}

function findInstalledBindingPackages() {
  const scopeDir = join(repoRoot, "node_modules", "@resvg");

  if (!existsSync(scopeDir)) {
    return [];
  }

  return readdirSync(scopeDir)
    .filter((entry) => entry !== "resvg-js" && entry.startsWith("resvg-js-"))
    .map((entry) => `@resvg/${entry}`);
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

  const resvgPackages = ["@resvg/resvg-js", ...findInstalledBindingPackages()];
  const copiedPackages = resvgPackages.filter(copyPackage);

  if (!copiedPackages.includes("@resvg/resvg-js")) {
    throw new Error("Missing @resvg/resvg-js in node_modules for GenerateOgFunction build.");
  }

  if (copiedPackages.length === 1) {
    throw new Error(
      "Missing resvg native binding in node_modules. Run npm ci --include=optional before sam build.",
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
