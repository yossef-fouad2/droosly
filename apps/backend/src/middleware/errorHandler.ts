import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { logger } from "../lib/logger.js";
import { AppError, toErrorBody, type ErrorBody } from "../lib/errors.js";

/**
 * The single funnel for every failure path. Register LAST, after all routes
 * and middleware: `app.use(errorHandler)`. Nothing else writes an error
 * response by hand — a failure `throw`s (routes; Express 5 catches async
 * throws) or calls `next(err)` (middleware), and this is the only place an
 * `ErrorBody` is ever serialized.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response<ErrorBody>,
  _next: NextFunction,
) {
  // 1. Expected, classified failures carry their own status/code/message.
  if (err instanceof AppError) {
    if (err.status >= 500) {
      logger.error({ err, method: req.method, url: req.url }, err.message);
    } else {
      logger.debug({ code: err.code, method: req.method, url: req.url }, err.message);
    }
    res.status(err.status).json(toErrorBody(err.code, err.message, err.details));
    return;
  }

  // 2. A Zod error that reached here unwrapped is a validation failure.
  if (err instanceof ZodError) {
    const details: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "_root";
      (details[key] ??= []).push(issue.message);
    }
    res
      .status(400)
      .json(toErrorBody("VALIDATION_FAILED", "Validation failed", details));
    return;
  }

  // 3. Anything else is unexpected: log it, and never leak internals in prod.
  logger.error(
    { err, method: req.method, url: req.url },
    "Unhandled error in request pipeline",
  );
  const message =
    process.env.NODE_ENV === "production"
      ? "Internal Server Error"
      : err instanceof Error && err.message
        ? err.message
        : "Unknown error";
  res.status(500).json(toErrorBody("INTERNAL", message));
}
