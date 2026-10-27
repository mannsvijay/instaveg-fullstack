import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { apiNotFound, corsOptions, errorHandler } from "./lib/http-hardening";

const app: Express = express();

// M15: on Vercel the request reaches Express through exactly one proxy that
// overwrites X-Forwarded-For with the real client IP ("we currently overwrite
// the X-Forwarded-For header and do not forward external IPs ... to prevent IP
// spoofing", vercel.com/docs/headers/request-headers). Trusting one hop makes
// req.ip (and so the auth rate limiter) that client IP. Elsewhere (local dev,
// tests) nothing is trusted, so a client-sent X-Forwarded-For is ignored.
if (process.env.VERCEL === "1") {
  app.set("trust proxy", 1);
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);
app.use("/api", apiNotFound);
app.use(errorHandler);

export default app;
