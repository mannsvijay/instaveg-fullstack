// Runs the seed with the production profile against the database in
// .env.production.local (repo root, gitignored). Values from that file
// override the shell, so a stray DATABASE_URL in your terminal can never
// redirect a production seed. See docs/DEPLOYMENT.md.
//
// Run: pnpm --filter @workspace/scripts run seed:production
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const here = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.resolve(here, "../../.env.production.local");

if (!fs.existsSync(envFile)) {
  console.error(`Missing ${path.relative(process.cwd(), envFile)}. Create it from docs/DEPLOYMENT.md (DATABASE_URL and SEED_ADMIN_PASSWORD).`);
  process.exit(1);
}
const values = parseEnv(fs.readFileSync(envFile, "utf8"));
for (const key of ["DATABASE_URL", "SEED_ADMIN_PASSWORD"]) {
  if (!values[key]) {
    console.error(`${key} is missing from .env.production.local`);
    process.exit(1);
  }
  process.env[key] = values[key];
}
process.env.SEED_PROFILE = "production";

// Import only now: @workspace/db reads DATABASE_URL when it is first loaded.
await import("./seed");
