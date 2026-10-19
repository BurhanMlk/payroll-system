import { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors";
import { prisma } from "../lib/prisma";

/**
 * Resolves the tenant from the authenticated user's session — NEVER from
 * request body, query string, or headers. This is the core guarantee of
 * multi-tenant isolation: a client cannot forge its tenant identity.
 *
 * Attaches `req.tenant` with subscription context for downstream middleware.
 */
export async function resolveTenant(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      throw AppError.unauthorized();
    }

    // Platform (super admin) requests do not carry a tenant context.
    if (!user.tenantId) {
      next();
      return;
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      include: {
        subscription: {
          include: { plan: { include: { features: true } } },
        },
      },
    });

    if (!tenant) {
      throw AppError.unauthorized("Your organization no longer exists.", "TENANT_NOT_FOUND");
    }

    const subscription = tenant.subscription;
    const features: Record<string, boolean> = {};
    for (const f of subscription?.plan.features ?? []) {
      features[f.key] = f.enabled;
    }

    req.tenant = {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      currency: tenant.currency,
      timezone: tenant.timezone,
      subscription: subscription
        ? {
            id: subscription.id,
            planKey: subscription.plan.key,
            planName: subscription.plan.name,
            status: subscription.status,
            renewalDate: subscription.renewalDate,
            gracePeriodEnd: subscription.gracePeriodEnd,
            features,
            employeeLimit: subscription.plan.employeeLimit,
            branchLimit: subscription.plan.branchLimit,
            userLimit: subscription.plan.userLimit,
          }
        : undefined,
    };

    next();
  } catch (err) {
    next(err);
  }
}
