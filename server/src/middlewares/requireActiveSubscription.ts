import { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors";
import { SubscriptionStatus } from "@prisma/client";

/** Statuses under which the tenant may continue to use the product. */
const ACTIVE_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING,
];

/** Statuses under which the tenant may keep read access but not write. */
const READ_ONLY_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.PAST_DUE,
  SubscriptionStatus.GRACE_PERIOD,
];

const BLOCKED_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.EXPIRED,
  SubscriptionStatus.CANCELLED,
  SubscriptionStatus.SUSPENDED,
];

export function isSubscriptionBlocked(status: string): boolean {
  return BLOCKED_STATUSES.includes(status as SubscriptionStatus);
}

/**
 * Requires an active (or trialing) subscription for full access.
 * Grace period / past-due tenants may still read.
 */
export function requireActiveSubscription(req: Request, _res: Response, next: NextFunction): void {
  const tenant = req.tenant;
  if (!tenant) {
    // Platform requests are not subscription-bound.
    next();
    return;
  }

  const status = tenant.subscription?.status;

  if (!status || isSubscriptionBlocked(status)) {
    next(
      AppError.subscriptionExpired(
        "Your subscription has expired. Renew your subscription to continue using payroll services.",
      ),
    );
    return;
  }

  next();
}

/**
 * Requires full (write-capable) subscription status. Blocks all tenant write
 * operations once the subscription has lapsed, but keeps read access available
 * during grace periods.
 */
export function requireWritableSubscription(req: Request, _res: Response, next: NextFunction): void {
  const tenant = req.tenant;
  if (!tenant) {
    next();
    return;
  }

  const status = tenant.subscription?.status;

  if (!status || isSubscriptionBlocked(status)) {
    next(
      AppError.subscriptionExpired(
        "Your subscription has expired. Renew your subscription to continue using payroll services.",
      ),
    );
    return;
  }

  if (!ACTIVE_STATUSES.includes(status as SubscriptionStatus)) {
    next(
      new AppError(
        "SUBSCRIPTION_PAST_DUE",
        "Your subscription requires attention. Please settle your payment to continue making changes.",
        402,
      ),
    );
    return;
  }

  next();
}
