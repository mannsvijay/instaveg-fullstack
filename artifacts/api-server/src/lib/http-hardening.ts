import type { ErrorRequestHandler, RequestHandler } from "express";
import type { CorsOptions } from "cors";
import { rateLimit } from "express-rate-limit";
import { logger } from "./logger";

// CORS (M4): only origins listed in CORS_ORIGINS (comma-separated) get CORS
// headers. Unset = no cross-origin access; same-origin requests (the app
// itself) never depend on CORS headers, so they keep working.
const allowedOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => callback(null, origin !== undefined && allowedOrigins.includes(origin)),
};

// Auth rate limits (M4). In-memory store: limits are per process, so on
// serverless each instance counts separately (see docs/AUDIT.md).
function positiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

const windowMs = positiveInt("AUTH_RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000);
const limit = positiveInt("AUTH_RATE_LIMIT_MAX", 10);
const tooMany = { error: "Too many attempts, please try again later" };

// Only failed logins count, so successful (e.g. demo) logins never lock anyone out.
export const loginLimiter = rateLimit({
  windowMs, limit, skipSuccessfulRequests: true,
  standardHeaders: "draft-8", legacyHeaders: false, message: tooMany,
});

export const registerLimiter = rateLimit({
  windowMs, limit,
  standardHeaders: "draft-8", legacyHeaders: false, message: tooMany,
});

// JSON 404 for unknown /api routes (M4).
export const apiNotFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "Not found" });
};

// Global error handler (M4): always JSON, never a stack trace; the message of
// an unexpected error is only included outside production.
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const status = typeof err?.status === "number" && err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status === 500) logger.error({ err, url: req.url }, "Unhandled error");
  if (res.headersSent) return;
  if (status === 400 && err?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }
  if (status < 500) {
    res.status(status).json({ error: status === 413 ? "Request body too large" : "Bad request" });
    return;
  }
  res.status(500).json(
    process.env.NODE_ENV === "production"
      ? { error: "Internal server error" }
      : { error: "Internal server error", message: err instanceof Error ? err.message : String(err) },
  );
};
