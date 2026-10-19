import { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors";

/**
 * Requires a plan feature to be enabled for the tenant's current subscription.
 * Features are stored dynamically on the subscription plan.
 */
export function requireFeature(...featureKeys: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const tenant = req.tenant;
    if (!tenant?.subscription) {
      next(AppError.forbidden("Your subscription plan does not include this feature."));
      return;
    }
    const enabled = featureKeys.every((f) => tenant.subscription?.features[f] === true);
    if (!enabled) {
      next(
        new AppError(
          "FEATURE_NOT_AVAILABLE",
          "This feature is not available on your current plan. Please upgrade your subscription.",
          403,
        ),
      );
      return;
    }
    next();
  };
}
