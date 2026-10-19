/**
 * Centralized application error with machine-readable error codes.
 * The error handler middleware serializes these into the standard response shape.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly expose: boolean;

  constructor(
    code: string,
    message: string,
    statusCode = 400,
    options: { details?: unknown; expose?: boolean } = {},
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = options.details;
    this.expose = options.expose ?? true;
    Error.captureStackTrace?.(this, AppError);
  }

  static badRequest(message = "Bad request", code = "BAD_REQUEST") {
    return new AppError(code, message, 400);
  }

  static unauthorized(message = "Authentication required", code = "UNAUTHORIZED") {
    return new AppError(code, message, 401);
  }

  static forbidden(message = "You do not have permission to perform this action", code = "FORBIDDEN") {
    return new AppError(code, message, 403);
  }

  static notFound(message = "Resource not found", code = "NOT_FOUND") {
    return new AppError(code, message, 404);
  }

  static conflict(message = "Conflict", code = "CONFLICT") {
    return new AppError(code, message, 409);
  }

  static tooManyRequests(message = "Too many requests", code = "RATE_LIMITED") {
    return new AppError(code, message, 429);
  }

  static validation(details?: unknown) {
    return new AppError("VALIDATION_ERROR", "Validation failed", 422, { details });
  }

  static subscriptionExpired(message = "Your subscription has expired.") {
    return new AppError("SUBSCRIPTION_EXPIRED", message, 402);
  }

  static subscriptionSuspended(message = "Your subscription is suspended.") {
    return new AppError("SUBSCRIPTION_SUSPENDED", message, 402);
  }

  static internal(message = "Internal server error") {
    return new AppError("INTERNAL_ERROR", message, 500, { expose: false });
  }
}
