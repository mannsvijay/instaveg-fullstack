import "./lib/env"; // must stay first: validates configuration before anything connects
import { connectDB } from "@workspace/db";
import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env.PORT ?? "8080";
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

connectDB()
  .then(() => {
    logger.info("Connected to PostgreSQL");
    app.listen(port, (err?: Error) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");
    });
  })
  .catch((err: unknown) => {
    logger.error({ err }, "Failed to connect to PostgreSQL");
    process.exit(1);
  });