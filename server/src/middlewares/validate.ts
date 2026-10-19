import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";
import { AppError } from "../lib/errors";

export type ValidationSource = "body" | "query" | "params";

/**
 * Validates request data with a Zod schema and replaces the request value with
 * the parsed/coerced output.
 */
export function validate(schema: ZodSchema, source: ValidationSource = "body") {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(AppError.validation(result.error.flatten()));
      return;
    }
    (req as unknown as Record<string, unknown>)[source] = result.data;
    next();
  };
}

export const validateBody = (schema: ZodSchema) => validate(schema, "body");
export const validateQuery = (schema: ZodSchema) => validate(schema, "query");
export const validateParams = (schema: ZodSchema) => validate(schema, "params");
