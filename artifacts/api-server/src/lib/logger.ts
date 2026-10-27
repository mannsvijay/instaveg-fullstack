import pino from "pino";

// Pretty, colourised logs only for local development (pino-pretty runs in a
// worker thread). Everywhere else, including production on Vercel, logs are
// one JSON object per line on stdout with no transport or worker.
const isDevelopment = process.env.NODE_ENV === "development";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
  ...(isDevelopment
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }
    : {}),
});
