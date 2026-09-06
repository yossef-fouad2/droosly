import type { Request, Response, NextFunction } from "express";
import type { ZodType } from "zod";
import { AppError } from "../lib/errors.js";

/**
 * Express middleware that validates req[source] against a Zod schema.
 * On success: replaces req[source] with the parsed (coerced + defaulted) data and calls next().
 * On failure: hands an AppError to the error funnel (single response shape).
 */
export function validate(schema: ZodType, source: "body" | "query" | "params" = "body") {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      // Build field-level error map from issues
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join(".") || "_root";
        (fieldErrors[key] ??= []).push(issue.message);
      }

      next(new AppError("VALIDATION_FAILED", "Validation failed", fieldErrors));
      return;
    }

    req.validated = result.data;
    next();
  };
}
