import { Router } from "express";
import type { Judge0Client } from "../judge0/judge0Client.js";

export function createHealthRouter(judge0Client: Judge0Client) {
  const router = Router();
  router.get("/", async (_req, res) => {
    res.json({
      ok: true,
      service: "epijudge-backend",
      judge0: {
        reachable: await judge0Client.isReachable()
      }
    });
  });
  return router;
}
