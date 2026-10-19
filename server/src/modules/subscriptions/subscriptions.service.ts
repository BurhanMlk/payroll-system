import { Prisma, SubscriptionStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { addDays, addMonths, addYears } from "../../utils/dates";
import { recordAudit } from "../../services/audit.service";
import { notify } from "../notifications/notifications.service";
import { Request } from "express";

interface SubscriptionWithPlan {
  id: string;
  tenantId: string;
  status: string;
  billingPeriod: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  renewalDate: Date;
  gracePeriodEnd: Date | null;
  amount: Prisma.Decimal;
  currency: string;
  autoRenew: boolean;
  plan: { key: string; name: string; monthlyPrice: Prisma.Decimal; yearlyPrice: Prisma.Decimal };
}

export async function getSubscriptionByTenant(tenantId: string) {
  return prisma.subscription.findUnique({
    where: { tenantId },
    include: { plan: { include: { features: true } }, payments: { orderBy: { createdAt: "desc" }, take: 10 } },
  });
}

export async function getSubscription(id: string) {
  return prisma.subscription.findUnique({
    where: { id },
    include: { plan: { include: { features: true } }, tenant: true },
  });
}

/** Creates a subscription for a tenant (manual activation / super admin). */
export async function createSubscription(
  tenantId: string,
  planId: string,
  opts: { billingPeriod?: "MONTHLY" | "YEARLY"; trialDays?: number; currency?: string; autoRenew?: boolean },
) {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan) throw AppError.notFound("Plan not found.");

  const existing = await prisma.subscription.findUnique({ where: { tenantId } });
  if (existing) throw AppError.conflict("Tenant already has a subscription.");

  const now = new Date();
  const period = opts.billingPeriod ?? "MONTHLY";
  const trialDays = opts.trialDays ?? 0;
  const periodEnd = trialDays > 0 ? addDays(now, trialDays) : period === "YEARLY" ? addYears(now, 1) : addMonths(now, 1);
  const amount = period === "YEARLY" ? plan.yearlyPrice : plan.monthlyPrice;

  const subscription = await prisma.subscription.create({
    data: {
      tenantId,
      planId,
      status: trialDays > 0 ? "TRIALING" : "ACTIVE",
      billingPeriod: period,
      startDate: now,
      trialEndDate: trialDays > 0 ? periodEnd : null,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      renewalDate: periodEnd,
      amount,
      currency: opts.currency ?? plan.currency,
      autoRenew: opts.autoRenew ?? true,
      paymentProvider: "MANUAL",
    },
  });

  await prisma.tenant.update({ where: { id: tenantId }, data: { status: trialDays > 0 ? "TRIALING" : "ACTIVE" } });
  return subscription;
}

/** Activates a subscription (e.g., after payment verification). */
export async function activateSubscription(subscriptionId: string, req?: Request) {
  const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!sub) throw AppError.notFound("Subscription not found.");

  const now = new Date();
  const period = sub.billingPeriod;
  const nextEnd = period === "YEARLY" ? addYears(now, 1) : addMonths(now, 1);

  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: "ACTIVE",
      trialEndDate: null,
      currentPeriodStart: now,
      currentPeriodEnd: nextEnd,
      renewalDate: nextEnd,
      gracePeriodEnd: null,
    },
  });
  await prisma.tenant.update({ where: { id: sub.tenantId }, data: { status: "ACTIVE" } });

  if (req) {
    await recordAudit({
      req,
      action: "subscription.activated",
      module: "billing",
      recordId: subscriptionId,
      recordType: "Subscription",
      metadata: { tenantId: sub.tenantId },
    });
  }
  return updated;
}

/** Renews an existing subscription, restoring access and extending the term. */
export async function renewSubscription(subscriptionId: string, req?: Request) {
  const sub = (await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true },
  })) as SubscriptionWithPlan | null;
  if (!sub) throw AppError.notFound("Subscription not found.");

  const now = new Date();
  const base = sub.renewalDate > now ? sub.renewalDate : now;
  const nextEnd = sub.billingPeriod === "YEARLY" ? addYears(base, 1) : addMonths(base, 1);
  const amount = sub.billingPeriod === "YEARLY" ? sub.plan.yearlyPrice : sub.plan.monthlyPrice;

  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: "ACTIVE",
      currentPeriodStart: now,
      currentPeriodEnd: nextEnd,
      renewalDate: nextEnd,
      gracePeriodEnd: null,
      autoRenew: true,
      cancelAtPeriodEnd: false,
      amount,
    },
  });
  await prisma.tenant.update({ where: { id: sub.tenantId }, data: { status: "ACTIVE" } });

  if (req) {
    await recordAudit({
      req,
      action: "subscription.renewed",
      module: "billing",
      recordId: subscriptionId,
      recordType: "Subscription",
      metadata: { tenantId: sub.tenantId, nextEnd },
    });
  }
  return updated;
}

/** Cancels a subscription, optionally at the end of the current period. */
export async function cancelSubscription(subscriptionId: string, cancelAtPeriodEnd = true, req?: Request) {
  const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!sub) throw AppError.notFound("Subscription not found.");

  if (cancelAtPeriodEnd) {
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { cancelAtPeriodEnd: true, autoRenew: false },
    });
  } else {
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: "CANCELLED", autoRenew: false, cancelledAt: new Date() },
    });
    await prisma.tenant.update({ where: { id: sub.tenantId }, data: { status: "CANCELLED" } });
  }

  if (req) {
    await recordAudit({
      req,
      action: "subscription.cancelled",
      module: "billing",
      recordId: subscriptionId,
      recordType: "Subscription",
      metadata: { tenantId: sub.tenantId, cancelAtPeriodEnd },
    });
  }
}

/** Adds extra trial days to a trialing subscription. */
export async function extendTrial(subscriptionId: string, days: number, req?: Request) {
  const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!sub) throw AppError.notFound("Subscription not found.");
  const newEnd = addDays(sub.renewalDate > new Date() ? sub.renewalDate : new Date(), days);

  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { renewalDate: newEnd, currentPeriodEnd: newEnd, trialEndDate: newEnd },
  });

  if (req) {
    await recordAudit({
      req,
      action: "subscription.trial_extended",
      module: "billing",
      recordId: subscriptionId,
      recordType: "Subscription",
      metadata: { tenantId: sub.tenantId, days },
    });
  }
  return updated;
}

/** Manually extends an active subscription's expiry date. */
export async function extendSubscription(subscriptionId: string, days: number, req?: Request) {
  const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!sub) throw AppError.notFound("Subscription not found.");
  const base = sub.renewalDate > new Date() ? sub.renewalDate : new Date();
  const newEnd = addDays(base, days);

  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { renewalDate: newEnd, currentPeriodEnd: newEnd },
  });

  if (req) {
    await recordAudit({
      req,
      action: "subscription.extended",
      module: "billing",
      recordId: subscriptionId,
      recordType: "Subscription",
      metadata: { tenantId: sub.tenantId, days },
    });
  }
  return updated;
}

/** Changes a tenant's plan and recalculates the remaining amount. */
export async function changePlan(subscriptionId: string, planId: string, req?: Request) {
  const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!sub) throw AppError.notFound("Subscription not found.");
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan) throw AppError.notFound("Plan not found.");

  const amount = sub.billingPeriod === "YEARLY" ? plan.yearlyPrice : plan.monthlyPrice;
  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { planId, amount },
  });

  if (req) {
    await recordAudit({
      req,
      action: "subscription.plan_changed",
      module: "billing",
      recordId: subscriptionId,
      recordType: "Subscription",
      previous: { planId: sub.planId },
      next: { planId },
    });
  }
  return updated;
}

/** Gives a free subscription for a fixed number of days. */
export async function giveFreeSubscription(subscriptionId: string, days: number, req?: Request) {
  const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!sub) throw AppError.notFound("Subscription not found.");
  const newEnd = addDays(new Date(), days);
  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: "ACTIVE",
      amount: new Prisma.Decimal(0),
      renewalDate: newEnd,
      currentPeriodStart: new Date(),
      currentPeriodEnd: newEnd,
      gracePeriodEnd: null,
    },
  });
  await prisma.tenant.update({ where: { id: sub.tenantId }, data: { status: "ACTIVE" } });

  if (req) {
    await recordAudit({
      req,
      action: "subscription.free_granted",
      module: "billing",
      recordId: subscriptionId,
      recordType: "Subscription",
      metadata: { tenantId: sub.tenantId, days },
    });
  }
  return updated;
}

/** Suspends a subscription and the tenant. */
export async function suspendSubscription(subscriptionId: string, reason?: string, req?: Request) {
  const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!sub) throw AppError.notFound("Subscription not found.");
  await prisma.subscription.update({ where: { id: subscriptionId }, data: { status: "SUSPENDED" } });
  await prisma.tenant.update({ where: { id: sub.tenantId }, data: { status: "SUSPENDED", suspendedReason: reason } });
  if (req) {
    await recordAudit({
      req,
      action: "subscription.suspended",
      module: "billing",
      recordId: subscriptionId,
      recordType: "Subscription",
      metadata: { tenantId: sub.tenantId, reason },
    });
  }
}

/**
 * Batch job: transitions lapsed subscriptions.
 * ACTIVE/TRIALING/PAST_DUE past renewalDate -> GRACE_PERIOD (7 days) -> EXPIRED.
 * This NEVER deletes tenant data.
 */
export async function processSubscriptionExpiry(): Promise<number> {
  const now = new Date();
  const graceEnd = addDays(now, 7);

  // Move lapsed but not yet expired subs into grace period.
  const graceResult = await prisma.subscription.updateMany({
    where: {
      status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] },
      renewalDate: { lte: now },
      gracePeriodEnd: null,
    },
    data: { status: "GRACE_PERIOD", gracePeriodEnd: graceEnd },
  });

  // Expire subs past their grace period.
  const expiredResult = await prisma.subscription.updateMany({
    where: {
      status: { in: ["GRACE_PERIOD", "PAST_DUE"] },
      gracePeriodEnd: { lte: now },
    },
    data: { status: "EXPIRED" },
  });

  // Update tenant statuses for expired subs.
  const expiredSubs = await prisma.subscription.findMany({
    where: { status: "EXPIRED" },
    select: { tenantId: true, tenant: { select: { status: true } } },
  });
  for (const s of expiredSubs) {
    if (s.tenant.status !== "EXPIRED") {
      await prisma.tenant.update({ where: { id: s.tenantId }, data: { status: "EXPIRED" } }).catch(() => undefined);
    }
  }

  return graceResult.count + expiredResult.count;
}

export async function countByStatus() {
  const grouped = await prisma.subscription.groupBy({ by: ["status"], _count: { _all: true } });
  return grouped.map((g) => ({ status: g.status, count: g._count._all }));
}

/**
 * Sends expiry reminders at 14/7/3/1 days before expiry and on expiry day.
 * Idempotent: each reminder type/day is recorded once per subscription.
 */
export async function sendExpiryReminders(): Promise<number> {
  const now = new Date();
  const windows = [
    { days: 14, type: "EXPIRING" },
    { days: 7, type: "EXPIRING" },
    { days: 3, type: "EXPIRING" },
    { days: 1, type: "EXPIRING" },
    { days: 0, type: "EXPIRED" },
  ];

  let sent = 0;
  for (const window of windows) {
    const targetDate = addDays(now, window.days);
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        renewalDate: { gte: dayStart, lte: dayEnd },
      },
      include: { tenant: { include: { users: { where: { roles: { some: { role: { key: "owner" } } } }, take: 1 } } } },
    });

    for (const sub of subscriptions) {
      const already = await prisma.subscriptionReminder.findUnique({
        where: { subscriptionId_type_daysBefore: { subscriptionId: sub.id, type: window.type, daysBefore: window.days } },
      });
      if (already) continue;

      await prisma.subscriptionReminder.create({
        data: { tenantId: sub.tenantId, subscriptionId: sub.id, daysBefore: window.days, type: window.type },
      });

      const owner = sub.tenant.users[0];
      if (owner) {
        const title =
          window.days === 0
            ? "Your subscription has expired"
            : `Your subscription expires in ${window.days} day(s)`;
        const body =
          window.days === 0
            ? "Your subscription has expired. Renew your subscription to continue using payroll services."
            : `Your ${sub.tenant.name} subscription will expire on ${sub.renewalDate.toISOString().slice(0, 10)}. Renew to avoid service interruption.`;
        await notify({
          tenantId: sub.tenantId,
          userId: owner.id,
          event: window.days === 0 ? "subscription.expired" : "subscription.expiring",
          title,
          body,
          metadata: { renewalDate: sub.renewalDate.toISOString() },
        });
        sent++;
      }
    }
  }
  return sent;
}

export { SubscriptionStatus };
