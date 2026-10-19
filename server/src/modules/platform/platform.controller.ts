import { NextFunction, Request, Response } from "express";
import * as platform from "./platform.service";
import * as subscriptions from "../subscriptions/subscriptions.service";
import * as plans from "../plans/plans.service";
import { ok, created, noContent } from "../../lib/response";
import { prisma } from "../../lib/prisma";

export async function dashboard(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await platform.platformDashboard());
  } catch (e) {
    next(e);
  }
}

export async function listTenants(req: Request, res: Response, next: NextFunction) {
  try {
    const r = await platform.listTenants(req.query);
    ok(res, r.items, r.meta);
  } catch (e) {
    next(e);
  }
}

export async function getTenant(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await platform.getTenant(req.params.id));
  } catch (e) {
    next(e);
  }
}

export async function createTenant(req: Request, res: Response, next: NextFunction) {
  try {
    created(res, await platform.createTenant(req.body, req));
  } catch (e) {
    next(e);
  }
}

export async function updateTenant(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await platform.updateTenant(req.params.id, req.body, req));
  } catch (e) {
    next(e);
  }
}

export async function suspendTenant(req: Request, res: Response, next: NextFunction) {
  try {
    await platform.suspendTenant(req.params.id, req.body?.reason, req);
    noContent(res);
  } catch (e) {
    next(e);
  }
}

export async function reactivateTenant(req: Request, res: Response, next: NextFunction) {
  try {
    await platform.reactivateTenant(req.params.id, req);
    noContent(res);
  } catch (e) {
    next(e);
  }
}

export async function deleteTenant(req: Request, res: Response, next: NextFunction) {
  try {
    await platform.deleteTenant(req.params.id, req);
    noContent(res);
  } catch (e) {
    next(e);
  }
}

export async function tenantUsage(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await platform.tenantUsage(req.params.id));
  } catch (e) {
    next(e);
  }
}

export async function impersonate(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await platform.impersonateTenant(req.params.id, req));
  } catch (e) {
    next(e);
  }
}

export async function listTenantUsers(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await platform.listTenantUsers(req.params.id));
  } catch (e) {
    next(e);
  }
}

export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await platform.updateUser(req.params.id, req.body, req));
  } catch (e) {
    next(e);
  }
}

export async function deleteUser(req: Request, res: Response, next: NextFunction) {
  try {
    await platform.deleteUser(req.params.id, req);
    noContent(res);
  } catch (e) {
    next(e);
  }
}

export async function resetUserPassword(req: Request, res: Response, next: NextFunction) {
  try {
    await platform.resetUserPassword(req.params.id, req.body?.password, req);
    noContent(res);
  } catch (e) {
    next(e);
  }
}

export async function listLockedAccounts(req: Request, res: Response, next: NextFunction) {
  try {
    const r = await platform.listLockedAccounts(req.query as { page?: string; limit?: string });
    ok(res, r.items, r.meta);
  } catch (e) {
    next(e);
  }
}

export async function unlockUser(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await platform.unlockUser(req.params.id, req));
  } catch (e) {
    next(e);
  }
}

export async function lockUserUntil(req: Request, res: Response, next: NextFunction) {
  try {
    const until = new Date((req.body as { until: string }).until);
    ok(res, await platform.lockUserUntil(req.params.id, until, req));
  } catch (e) {
    next(e);
  }
}

// Subscriptions
export async function listSubscriptions(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
    const limit = Math.min(100, parseInt(String(req.query.limit ?? "20"), 10));
    const where: Record<string, unknown> = {};
    if (req.query.status) where.status = req.query.status;
    const [total, items] = await Promise.all([
      prisma.subscription.count({ where: where as never }),
      prisma.subscription.findMany({
        where: where as never,
        include: { tenant: { select: { id: true, name: true, slug: true } }, plan: { select: { id: true, name: true, key: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    ok(res, items, { page, limit, total, totalPages: Math.ceil(total / limit) || 1 });
  } catch (e) {
    next(e);
  }
}

export async function createSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    created(res, await subscriptions.createSubscription(req.body.tenantId, req.body.planId, req.body));
  } catch (e) {
    next(e);
  }
}

export async function activateSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await subscriptions.activateSubscription(req.params.id, req));
  } catch (e) {
    next(e);
  }
}

export async function renewSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await subscriptions.renewSubscription(req.params.id, req));
  } catch (e) {
    next(e);
  }
}

export async function cancelSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    await subscriptions.cancelSubscription(req.params.id, req.body?.cancelAtPeriodEnd ?? true, req);
    noContent(res);
  } catch (e) {
    next(e);
  }
}

export async function extendSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await subscriptions.extendSubscription(req.params.id, req.body.days, req));
  } catch (e) {
    next(e);
  }
}

export async function extendTrial(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await subscriptions.extendTrial(req.params.id, req.body.days, req));
  } catch (e) {
    next(e);
  }
}

export async function giveFree(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await subscriptions.giveFreeSubscription(req.params.id, req.body.days, req));
  } catch (e) {
    next(e);
  }
}

export async function changePlan(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await subscriptions.changePlan(req.params.id, req.body.planId, req));
  } catch (e) {
    next(e);
  }
}

// Plans
export async function listPlans(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await plans.listPlans());
  } catch (e) {
    next(e);
  }
}

export async function createPlan(req: Request, res: Response, next: NextFunction) {
  try {
    created(res, await plans.createPlan(req.body));
  } catch (e) {
    next(e);
  }
}

export async function updatePlan(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await plans.updatePlan(req.params.id, req.body));
  } catch (e) {
    next(e);
  }
}

export async function deletePlan(req: Request, res: Response, next: NextFunction) {
  try {
    await plans.deletePlan(req.params.id);
    noContent(res);
  } catch (e) {
    next(e);
  }
}

// Audit + jobs
export async function auditLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const r = await platform.listAuditLogs(req.query);
    ok(res, r.items, r.meta);
  } catch (e) {
    next(e);
  }
}

export async function backgroundJobs(req: Request, res: Response, next: NextFunction) {
  try {
    const r = await platform.listBackgroundJobs(req.query);
    ok(res, r.items, r.meta);
  } catch (e) {
    next(e);
  }
}

// System health
export async function systemHealth(_req: Request, res: Response, next: NextFunction) {
  try {
    const [tenants, employees, subscriptions] = await Promise.all([
      prisma.tenant.count(),
      prisma.employee.count(),
      prisma.subscription.count(),
    ]);
    ok(res, {
      status: "ok",
      uptimeSeconds: Math.round(process.uptime()),
      memory: process.memoryUsage(),
      counts: { tenants, employees, subscriptions },
      time: new Date().toISOString(),
    });
  } catch (e) {
    next(e);
  }
}

export async function listCurrencies(_req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await prisma.currency.findMany({ orderBy: { code: "asc" } }));
  } catch (e) {
    next(e);
  }
}

export async function createCurrency(req: Request, res: Response, next: NextFunction) {
  try {
    created(res, await prisma.currency.upsert({ where: { code: req.body.code }, update: req.body, create: req.body }));
  } catch (e) {
    next(e);
  }
}

export async function getSettings(_req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await prisma.globalSetting.findMany());
  } catch (e) {
    next(e);
  }
}

export async function updateSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const setting = await prisma.globalSetting.upsert({
      where: { key: req.body.key },
      update: { value: req.body.value as never },
      create: { key: req.body.key, value: req.body.value as never },
    });
    ok(res, setting);
  } catch (e) {
    next(e);
  }
}
