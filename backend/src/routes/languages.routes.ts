import { Router } from "express";
import { languageConfigs } from "../judge0/languageIds.js";

export function createLanguagesRouter() {
  const router = Router();
  router.get("/", (_req, res) => {
    res.json({
      languages: Object.entries(languageConfigs).map(([key, config]) => ({
        key,
        label: config.label,
        enabled: true
      }))
    });
  });
  return router;
}
