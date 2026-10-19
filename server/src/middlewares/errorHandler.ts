import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { AppError } from "../lib/errors";
import { logger } from "../config/logger";
import { env } from "../config/env";

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(new AppError("NOT_FOUND", `Route not found: ${req.method} ${req.originalUrl}`, 404));
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  let statusCode = 500;
  let code = "INTERNAL_ERROR";
  let message = "An unexpected error occurred.";
  let details: unknown;
  let expose = false;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
    expose = err.expose;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    statusCode = 400;
    code = "DATABASE_ERROR";
    expose = true;
    if (err.code === "P2002") {
      code = "DUPLICATE_ENTRY";
      message = "A record with the same unique value already exists.";
    } else if (err.code === "P2025") {
      statusCode = 404;
      code = "NOT_FOUND";
      message = "The requested record does not exist.";
    } else if (err.code === "P2003") {
      message = "The record cannot be modified because it is referenced by other records.";
    } else {
      message = "A database error occurred.";
    }
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = 422;
    code = "DATABASE_VALIDATION";
    message = "Invalid data provided.";
    expose = true;
  } else if (err instanceof SyntaxError && "body" in err) {
    statusCode = 400;
    code = "INVALID_JSON";
    message = "Malformed JSON payload.";
    expose = true;
  }

  if (!expose && env.NODE_ENV !== "production") {
    details = err instanceof Error ? { stack: err.stack, message: err.message } : undefined;
  }

  if (statusCode >= 500) {
    logger.error(
      {
        requestId: req.requestId,
        err: err instanceof Error ? err.stack : String(err),
        path: req.originalUrl,
      },
      "Unhandled error",
    );
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message: expose || env.NODE_ENV !== "production" ? message : "An unexpected error occurred.",
      ...(details ? { details } : {}),
    },
  });
}
