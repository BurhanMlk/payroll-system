import { rateLimit } from "express-rate-limit";
import { AppError } from "../lib/errors";
import { env } from "../config/env";

export const authLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(AppError.tooManyRequests("Too many attempts. Please try again later."));
  },
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(AppError.tooManyRequests("Rate limit exceeded."));
  },
});
