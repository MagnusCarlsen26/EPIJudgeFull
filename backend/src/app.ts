import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { errorMiddleware } from "./errors/errorMiddleware.js";
import { createHealthRouter } from "./routes/health.routes.js";
import { createRunsRouter } from "./routes/runs.routes.js";
import { createLanguagesRouter } from "./routes/languages.routes.js";
import type { Judge0Client } from "./judge0/judge0Client.js";
import type { RunService } from "./runs/runService.js";

export function createApp(deps: { judge0Client: Judge0Client; runService: RunService }) {
  const app = express();

  app.use(cors({ origin: config.frontendOrigins, credentials: false }));
  app.use(express.json({ limit: "256kb" }));

  app.use("/api/health", createHealthRouter(deps.judge0Client));
  app.use("/api/languages", createLanguagesRouter());
  app.use("/api/runs", createRunsRouter(deps.runService));

  app.use(errorMiddleware);
  return app;
}
