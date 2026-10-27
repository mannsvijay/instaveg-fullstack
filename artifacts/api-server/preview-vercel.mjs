// Local stand-in for Vercel serving .vercel/output (Batch 8). Not used in
// production; it lets you exercise the exact build that would be deployed.
//
// It follows the Build Output API routing used by build-vercel.mjs:
// header routes with `continue` -> filesystem (static files, the /api
// function) -> routes with `check: true` (rewrite, then re-check the
// filesystem). Like Vercel, it overwrites X-Forwarded-For with the client
// address and runs the function with its .vc-config.json environment plus
// VERCEL=1. Assumption, still to be confirmed on a real preview (smoke check 3
// in docs/DEPLOYMENT.md): the function receives the original request URL after
// a rewrite.
//
// Run after `pnpm run build:vercel`:
//   pnpm run preview:vercel            (port 3100, DATABASE_URL etc. from .env)
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outputDir = path.join(repoRoot, ".vercel/output");
const staticDir = path.join(outputDir, "static");
const config = JSON.parse(fs.readFileSync(path.join(outputDir, "config.json"), "utf8"));

// Functions: <name>.func directories, served at /<name>.
const functions = new Map();
const functionsDir = path.join(outputDir, "functions");
for (const entry of fs.readdirSync(functionsDir)) {
  if (!entry.endsWith(".func")) continue;
  const dir = path.join(functionsDir, entry);
  const vc = JSON.parse(fs.readFileSync(path.join(dir, ".vc-config.json"), "utf8"));
  Object.assign(process.env, vc.environment ?? {}, { VERCEL: "1" });
  functions.set(`/${entry.slice(0, -".func".length)}`, { file: path.join(dir, vc.handler) });
}
for (const fn of functions.values()) {
  fn.handler = (await import(pathToFileURL(fn.file).href)).default;
}

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".webp": "image/webp", ".jpg": "image/jpeg", ".png": "image/png",
  ".json": "application/json", ".txt": "text/plain; charset=utf-8", ".md": "text/markdown; charset=utf-8",
  ".map": "application/json",
};

function staticFile(pathname) {
  const rel = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  const file = path.join(staticDir, rel);
  if (!file.startsWith(staticDir)) return null;
  return fs.existsSync(file) && fs.statSync(file).isFile() ? file : null;
}

// Filesystem phase: a static file or a function at this path.
function filesystem(pathname) {
  const file = staticFile(pathname);
  if (file) return { kind: "static", file };
  if (functions.has(pathname)) return { kind: "function", fn: functions.get(pathname) };
  return null;
}

const handleIndex = config.routes.findIndex((r) => r.handle === "filesystem");
const beforeFs = config.routes.slice(0, handleIndex);
const afterFs = config.routes.slice(handleIndex + 1);

function resolve(pathname) {
  const headers = {};
  for (const route of beforeFs) {
    if (new RegExp(route.src).test(pathname)) Object.assign(headers, route.headers);
  }
  let target = filesystem(pathname);
  if (!target) {
    for (const route of afterFs) {
      if (!new RegExp(route.src).test(pathname)) continue;
      Object.assign(headers, route.headers);
      target = route.check ? filesystem(route.dest) : null;
      break;
    }
  }
  return { headers, target };
}

const server = http.createServer(async (req, res) => {
  // Like Vercel: X-Forwarded-For is replaced with the real client address.
  const clientIp = (req.socket.remoteAddress ?? "").replace(/^::ffff:/, "");
  req.headers["x-forwarded-for"] = clientIp;
  req.headers["x-real-ip"] = clientIp;

  const url = new URL(req.url, "http://localhost");
  const { headers, target } = resolve(url.pathname);
  if (!target) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("404: NOT_FOUND");
    return;
  }
  if (target.kind === "static") {
    res.writeHead(200, { "content-type": TYPES[path.extname(target.file)] ?? "application/octet-stream", ...headers });
    fs.createReadStream(target.file).pipe(res);
    return;
  }
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  target.fn.handler(req, res);
});

const port = Number(process.env.PREVIEW_PORT ?? 3100);
server.listen(port, "127.0.0.1", () => {
  console.log(`preview-vercel: serving .vercel/output on http://localhost:${port} (functions: ${[...functions.keys()].join(", ")})`);
});
