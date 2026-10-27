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
import { cp, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { build as esbuild } from "esbuild";
import { sharedEsbuildOptions } from "./esbuild.shared.mjs";

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(artifactDir, "../..");
const outputDir = path.join(repoRoot, ".vercel/output");
const functionDir = path.join(outputDir, "functions/api.func");
const staticDir = path.join(outputDir, "static");
const webDist = path.join(repoRoot, "artifacts/instaveg/dist/public");

// Region of the Neon production database (AWS ap-southeast-1, Singapore), so
// every query stays in-region. See docs/DEPLOYMENT.md.
const FUNCTION_REGION = "sin1";

// Routing (Build Output API config.json). Header rules run first with
// `continue`; then the filesystem (static files and the /api function);
// then rewrites with `check: true`, which is what vercel.json "rewrites"
// compile to.
const routes = [
  // Vite's content-hashed bundles never change under the same name.
  { src: "^/assets/(.*)$", headers: { "Cache-Control": "public, max-age=31536000, immutable" }, continue: true },
  // Product/category photos keep their names when replaced, so a week in
  // browsers; Vercel's CDN cache is refreshed on every deployment.
  { src: "^/images/(.*)$", headers: { "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400" }, continue: true },
  // The app shell must always be revalidated so new deployments load.
  { src: "^/(index\\.html)?$", headers: { "Cache-Control": "no-cache" }, continue: true },
  { handle: "filesystem" },
  // Every /api path goes to the Express function, which routes it.
  { src: "^/api(?:/.*)?$", dest: "/api", check: true },
  // SPA fallback for client-side routes (/product/5, /admin/orders): only
  // paths without a file extension, so a missing asset is a real 404.
  { src: "^/[^.]*$", dest: "/index.html", headers: { "Cache-Control": "no-cache" }, check: true },
];

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
      regions: [FUNCTION_REGION],
    }, null, 2) + "\n",
  );
}

async function copyStatic() {
  // The SPA must already be built (pnpm run build); fail rather than deploy an empty site.
  await stat(path.join(webDist, "index.html")).catch(() => {
    throw new Error(`build-vercel: ${path.relative(repoRoot, webDist)}/index.html not found; run pnpm run build first`);
  });
  await cp(webDist, staticDir, { recursive: true });
}

async function main() {
  await rm(outputDir, { recursive: true, force: true });
  await buildFunction();
  await copyStatic();
  await writeFile(path.join(outputDir, "config.json"), JSON.stringify({ version: 3, routes }, null, 2) + "\n");
  console.log(`build-vercel: wrote ${path.relative(repoRoot, outputDir)} (static, functions/api.func, config.json)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
