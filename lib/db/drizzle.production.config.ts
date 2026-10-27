// drizzle-kit config for the PRODUCTION database (docs/DEPLOYMENT.md).
// Reads DATABASE_URL only from .env.production.local at the repo root
// (gitignored), ignoring the shell environment, so it can never pick up the
// development database by accident (or the reverse).
//
// Use Neon's DIRECT (non-pooled) connection string here: schema changes should
// not go through the transaction-mode pooler.
//
// Run: pnpm --filter @workspace/db run push:production
import { defineConfig } from "drizzle-kit";
import fs from "fs";
import path from "path";
import { parseEnv } from "util";

const envFile = path.join(__dirname, "../../.env.production.local");
if (!fs.existsSync(envFile)) {
  throw new Error("Missing .env.production.local at the repo root (see docs/DEPLOYMENT.md)");
}
const url = parseEnv(fs.readFileSync(envFile, "utf8")).DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is missing from .env.production.local");
}

export default defineConfig({
  // drizzle-kit treats the path as a glob; backslashes (Windows) break it.
  schema: path.join(__dirname, "./src/schema/index.ts").split(path.sep).join("/"),
  dialect: "postgresql",
  dbCredentials: { url },
});
