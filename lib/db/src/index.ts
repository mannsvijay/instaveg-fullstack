import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

function positiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

// On Vercel every function instance has its own pool, and Neon's pooled
// endpoint (PgBouncer) multiplexes them, so keep each pool small and let idle
// connections close quickly. Locally a normal pool is fine.
const onVercel = process.env.VERCEL === "1";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: positiveIntEnv("PG_POOL_MAX", onVercel ? 3 : 10),
  idleTimeoutMillis: positiveIntEnv("PG_IDLE_TIMEOUT_MS", onVercel ? 5_000 : 30_000),
  connectionTimeoutMillis: positiveIntEnv("PG_CONNECTION_TIMEOUT_MS", 10_000),
});
export const db = drizzle(pool, { schema });

// Serverless deployments should use Neon's pooled ("-pooler") connection string.
if (onVercel && !new URL(process.env.DATABASE_URL).hostname.includes("-pooler")) {
  console.warn("DATABASE_URL does not use Neon's pooled (-pooler) endpoint; use the pooled connection string on Vercel.");
}

export async function connectDB(): Promise<void> {
  await pool.query("select 1");
}

export * from "./schema";
