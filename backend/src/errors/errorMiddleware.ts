import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { HttpError } from "./httpError.js";

export const errorMiddleware: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "BAD_REQUEST",
        message: error.issues.map((issue) => issue.message).join("; ")
      }
    });
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }

  console.error(error);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal server error." } });
};
