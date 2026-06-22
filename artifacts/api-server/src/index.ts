import { connectDB } from "@workspace/db";
import app from "./app";
import { logger } from "./lib/logger";
import { seedIfEmpty } from "./lib/startup-seed";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

connectDB()
  .then(() => {
    logger.info("Connected to MongoDB");

    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }

      logger.info({ port }, "Server listening");

      seedIfEmpty().catch((e) => {
        logger.error({ err: e }, "Startup seed failed");
      });
    });
  })
  .catch((err) => {
    logger.error({ err }, "Failed to connect to MongoDB");
    process.exit(1);
  });
