import { Router } from "express";
import { createRunSchema, type RunService } from "../runs/runService.js";

export function createRunsRouter(runService: RunService) {
  const router = Router();

  router.post("/", async (req, res, next) => {
    try {
      const run = await runService.createRun(createRunSchema.parse(req.body));
      res.status(202).json({ runId: run.runId, status: run.status });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:runId", async (req, res, next) => {
    try {
      const run = await runService.getRun(req.params.runId);
      res.json(serializeRun(run));
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function serializeRun(run: Awaited<ReturnType<RunService["getRun"]>>) {
  return {
    runId: run.runId,
    status: run.status,
    problemId: run.problemId,
    language: run.language,
    scope: run.scope,
    ...(run.result ? { result: run.result } : {}),
    ...(run.error ? { error: run.error } : {})
  };
}
