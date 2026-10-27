import { defineConfig } from "drizzle-kit";
import fs from "fs";
import path from "path";

const rootEnv = path.join(__dirname, "../../.env");
if (!process.env.DATABASE_URL && fs.existsSync(rootEnv)) {
  process.loadEnvFile(rootEnv);
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  // drizzle-kit treats the path as a glob; backslashes (Windows) break it.
  schema: path.join(__dirname, "./src/schema/index.ts").split(path.sep).join("/"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
