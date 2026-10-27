// Builds the Vercel deployment as Build Output API v3 (.vercel/output) at the
// repository root. See docs/DEPLOYMENT.md.
//
// The API is bundled with esbuild into one self-contained ESM file because the
// workspace packages (@workspace/db, @workspace/api-zod) export TypeScript
// source, which Node cannot load at runtime and which Vercel's own Express
// support does not bundle.
//
// Run from the repo root after `pnpm run build`: pnpm run build:vercel
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { build as esbuild } from "esbuild";
import { sharedEsbuildOptions } from "./esbuild.shared.mjs";

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(artifactDir, "../..");
const outputDir = path.join(repoRoot, ".vercel/output");
const functionDir = path.join(outputDir, "functions/api.func");

async function buildFunction() {
  await mkdir(functionDir, { recursive: true });
  // No pino worker plugin: production logs are plain JSON to stdout, so the
  // bundle needs no transport or worker files.
  await esbuild({
    ...sharedEsbuildOptions,
    entryPoints: [path.join(artifactDir, "src/vercel.ts")],
    outfile: path.join(functionDir, "index.mjs"),
    sourcemap: "linked",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  await writeFile(
    path.join(functionDir, ".vc-config.json"),
    JSON.stringify({
      runtime: "nodejs24.x",
      handler: "index.mjs",
      launcherType: "Nodejs",
      shouldAddHelpers: false,
      shouldAddSourcemapSupport: true,
      environment: { NODE_ENV: "production" },
    }, null, 2) + "\n",
  );
}

async function main() {
  await rm(outputDir, { recursive: true, force: true });
  await buildFunction();
  console.log(`build-vercel: wrote ${path.relative(repoRoot, functionDir)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
