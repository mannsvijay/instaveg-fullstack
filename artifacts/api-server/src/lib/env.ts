// Fail fast on missing configuration (Batch 8). Imported first by both entry
// points (index.ts, vercel.ts) so a misconfigured deployment stops at startup
// with one message naming every problem, instead of failing on a later import.
// Values are never printed.
const problems: string[] = [];

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  problems.push("DATABASE_URL is not set");
} else if (!/^postgres(ql)?:\/\//.test(databaseUrl)) {
  problems.push("DATABASE_URL must be a postgres:// or postgresql:// connection string");
}

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || sessionSecret.length < 32) {
  problems.push("SESSION_SECRET must be set and at least 32 characters long");
}

if (problems.length > 0) {
  const where = process.env.NODE_ENV === "production" ? "production" : "this environment";
  throw new Error(`Invalid configuration for ${where}: ${problems.join("; ")}`);
}

export {};
