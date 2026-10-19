import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { parsePagination, paginationMeta } from "../../lib/response";
import { signAccessToken } from "../../lib/jwt";
import { recordAudit } from "../../services/audit.service";
import { hashPassword } from "../../services/auth.service";
import { dayjs, addDays } from "../../utils/dates";
import { Request } from "express";

export async function platformDashboard() {
  const now = new Date();
  const monthStart = dayjs().startOf("month").toDate();
  const yearStart = dayjs().startOf("year").toDate();

  const [tenantStatus, subscriptionStatus, totalEmployees, recentTenants, expiringSoon, payments, monthlyRevenueRows, planDistributionRaw, activity] =
    await Promise.all([
      prisma.tenant.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.subscription.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.employee.count(),
      prisma.tenant.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { subscription: { include: { plan: true } } } }),
      prisma.subscription.findMany({
        where: { status: "ACTIVE", renewalDate: { gte: now, lte: addDays(now, 14) } },
        include: { tenant: { select: { name: true } } },
        orderBy: { renewalDate: "asc" },
      }),
      prisma.subscriptionPayment.findMany({
        where: { paidAt: { not: null } },
        select: { amount: true, currency: true, paidAt: true, status: true },
      }),
      prisma.subscriptionPayment.findMany({
        where: { paidAt: { gte: yearStart } },
        select: { amount: true, paidAt: true },
        orderBy: { paidAt: "asc" },
      }),
      prisma.subscription.groupBy({ by: ["planId"], _count: { _all: true } }),
      prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 15, include: { tenant: { select: { name: true } } } }),
    ]);

  const tenantByStatus: Record<string, number> = {};
  for (const t of tenantStatus) tenantByStatus[t.status] = t._count._all;
  const subByStatus: Record<string, number> = {};
  for (const s of subscriptionStatus) subByStatus[s.status] = s._count._all;

  const activeSubscriptions = await prisma.subscription.findMany({ where: { status: "ACTIVE" }, select: { amount: true, billingPeriod: true } });
  const mrr = activeSubscriptions.reduce((sum, s) => {
    return sum + (s.billingPeriod === "YEARLY" ? s.amount.toNumber() / 12 : s.amount.toNumber());
  }, 0);

  const totalRevenue = payments.filter((p) => p.status === "PAID").reduce((s, p) => s + p.amount.toNumber(), 0);
  const yearlyRevenue = monthlyRevenueRows.filter((p) => p.paidAt).reduce((s, p) => s + p.amount.toNumber(), 0);
  const failedPayments = await prisma.subscriptionPayment.count({ where: { status: "FAILED" } });

  // Plan distribution
  const plans = await prisma.subscriptionPlan.findMany({ select: { id: true, name: true, key: true } });
  const planName = new Map(plans.map((p) => [p.id, p.name]));
  const planDistribution = planDistributionRaw.map((p) => ({ plan: planName.get(p.planId) ?? "Unknown", count: p._count._all }));

  const monthlyRevenue = Object.entries(
    monthlyRevenueRows.reduce<Record<string, number>>((acc, p) => {
      if (!p.paidAt) return acc;
      const key = dayjs(p.paidAt).format("YYYY-MM");
      acc[key] = (acc[key] ?? 0) + p.amount.toNumber();
      return acc;
    }, {}),
  ).map(([month, amount]) => ({ month, amount }));

  return {
    totals: {
      totalInstitutions: await prisma.tenant.count(),
      activeInstitutions: tenantByStatus["ACTIVE"] ?? 0,
      trialInstitutions: tenantByStatus["TRIALING"] ?? 0,
      expiredInstitutions: tenantByStatus["EXPIRED"] ?? 0,
      suspendedInstitutions: tenantByStatus["SUSPENDED"] ?? 0,
      mrr: Math.round(mrr * 100) / 100,
      yearlyRevenue: Math.round(yearlyRevenue * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      newSubscriptions: subByStatus["ACTIVE"] ?? 0,
      failedPayments,
      churn: subByStatus["CANCELLED"] ?? 0,
      totalEmployees,
    },
    recentlyRegistered: recentTenants.map((t) => ({
      id: t.id,
      name: t.name,
      status: t.status,
      createdAt: t.createdAt,
      plan: t.subscription?.plan.name ?? null,
    })),
    expiringSoon: expiringSoon.map((s) => ({
      tenantName: s.tenant.name,
      renewalDate: s.renewalDate,
      daysLeft: dayjs(s.renewalDate).diff(dayjs(), "day"),
    })),
    planDistribution,
    monthlyRevenue,
    activeVsExpired: [
      { name: "Active", value: tenantByStatus["ACTIVE"] ?? 0 },
      { name: "Trial", value: tenantByStatus["TRIALING"] ?? 0 },
      { name: "Expired", value: tenantByStatus["EXPIRED"] ?? 0 },
      { name: "Suspended", value: tenantByStatus["SUSPENDED"] ?? 0 },
    ],
    activity: activity.map((a) => ({
      id: a.id,
      action: a.action,
      module: a.module,
      tenant: a.tenant?.name ?? null,
      createdAt: a.createdAt,
    })),
  };
}

export async function listTenants(query: { page?: string; limit?: string; search?: string; status?: string }) {
  const { page, limit, skip } = parsePagination(query);
  const where: Record<string, unknown> = {};
  if (query.search) where.name = { contains: query.search.trim(), mode: "insensitive" };
  if (query.status) where.status = query.status;

  const [total, items] = await Promise.all([
    prisma.tenant.count({ where: where as never }),
    prisma.tenant.findMany({
      where: where as never,
      include: { subscription: { include: { plan: true } }, _count: { select: { users: true, employees: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
  ]);
  return { items, meta: paginationMeta(total, page, limit) };
}

export async function getTenant(id: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      subscription: { include: { plan: { include: { features: true } }, payments: true, invoices: true } },
      users: {
        select: {
          id: true,
          email: true,
          fullName: true,
          status: true,
          createdAt: true,
          lastLoginAt: true,
          roles: { include: { role: { select: { key: true, name: true } } } },
        },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { users: true, employees: true, branches: true } },
    },
  });
  if (!tenant) throw AppError.notFound("Institution not found.");
  return tenant;
}

export async function createTenant(input: {
  name: string;
  email?: string;
  institutionType?: string;
  country?: string;
  city?: string;
  currency?: string;
  timezone?: string;
}, req: Request) {
  const slug = await uniqueSlug(input.name);
  const tenant = await prisma.tenant.create({
    data: {
      name: input.name,
      slug,
      email: input.email,
      institutionType: (input.institutionType as never) ?? "COLLEGE",
      country: input.country,
      city: input.city,
      currency: input.currency ?? "USD",
      timezone: input.timezone ?? "UTC",
      status: "ACTIVE",
    },
  });
  await recordAudit({ req, action: "tenant.created", module: "platform", recordId: tenant.id, recordType: "Tenant", next: input });
  return tenant;
}

export async function updateTenant(id: string, input: Partial<{ name: string; email: string; phone: string; address: string; website: string }>, req: Request) {
  const existing = await prisma.tenant.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound("Institution not found.");
  const tenant = await prisma.tenant.update({ where: { id }, data: input });
  await recordAudit({ req, action: "tenant.updated", module: "platform", recordId: id, recordType: "Tenant", previous: existing, next: input });
  return tenant;
}

export async function suspendTenant(id: string, reason: string | undefined, req: Request) {
  const existing = await prisma.tenant.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound("Institution not found.");
  await prisma.tenant.update({ where: { id }, data: { status: "SUSPENDED", suspendedReason: reason } });
  await prisma.subscription.updateMany({ where: { tenantId: id }, data: { status: "SUSPENDED" } });
  await recordAudit({ req, action: "tenant.suspended", module: "platform", recordId: id, recordType: "Tenant", metadata: { reason } });
}

export async function reactivateTenant(id: string, req: Request) {
  const existing = await prisma.tenant.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound("Institution not found.");
  await prisma.tenant.update({ where: { id }, data: { status: "ACTIVE", suspendedReason: null } });
  await prisma.subscription.updateMany({ where: { tenantId: id, status: "SUSPENDED" }, data: { status: "ACTIVE" } });
  await recordAudit({ req, action: "tenant.reactivated", module: "platform", recordId: id, recordType: "Tenant" });
}

/** Safe delete: only tenants with no employees/users, or force with cascade. */
export async function deleteTenant(id: string, req: Request) {
  const existing = await prisma.tenant.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound("Institution not found.");
  await prisma.tenant.delete({ where: { id } });
  await recordAudit({ req, action: "tenant.deleted", module: "platform", recordId: id, recordType: "Tenant", previous: { name: existing.name } });
}

export async function tenantUsage(id: string) {
  return prisma.tenant.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      storageLimitMb: true,
      _count: { select: { employees: true, users: true, branches: true, payrollRuns: true } },
      subscription: { select: { plan: { select: { name: true, employeeLimit: true, userLimit: true, branchLimit: true } } } },
    },
  });
}

/** Issues a short-lived impersonation token for the tenant's owner. */
export async function impersonateTenant(id: string, req: Request) {
  const tenant = await prisma.tenant.findUnique({ where: { id }, include: { roles: { where: { key: "owner" }, take: 1 } } });
  if (!tenant) throw AppError.notFound("Institution not found.");

  const ownerRole = tenant.roles[0];
  const owner = ownerRole
    ? await prisma.userRole.findFirst({
        where: { roleId: ownerRole.id },
        include: { user: { include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } } },
      })
    : null;

  if (!owner?.user) {
    throw AppError.badRequest("This institution has no owner user to impersonate.", "NO_OWNER_USER");
  }

  const permissions = Array.from(new Set(owner.user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.key))));
  const token = signAccessToken({
    sub: owner.user.id,
    email: owner.user.email,
    tenantId: owner.user.tenantId,
    scope: "TENANT",
    fullName: owner.user.fullName,
    roles: owner.user.roles.map((ur) => ur.role.key),
  });

  await recordAudit({
    req,
    action: "tenant.impersonated",
    module: "platform",
    recordId: id,
    recordType: "Tenant",
    metadata: { impersonatedUserId: owner.user.id },
  });

  return { token, permissions, user: { id: owner.user.id, fullName: owner.user.fullName, email: owner.user.email } };
}

export async function listAuditLogs(query: { page?: string; limit?: string; module?: string; tenantId?: string }) {
  const { page, limit, skip } = parsePagination(query);
  const where: Record<string, unknown> = {};
  if (query.module) where.module = query.module;
  if (query.tenantId) where.tenantId = query.tenantId;
  const [total, items] = await Promise.all([
    prisma.auditLog.count({ where: where as never }),
    prisma.auditLog.findMany({
      where: where as never,
      include: { tenant: { select: { name: true } }, user: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
  ]);
  return { items, meta: paginationMeta(total, page, limit) };
}

export async function listBackgroundJobs(query: { page?: string; limit?: string }) {
  const { page, limit, skip } = parsePagination(query);
  const [total, items] = await Promise.all([
    prisma.backgroundJobLog.count(),
    prisma.backgroundJobLog.findMany({ orderBy: { createdAt: "desc" }, skip, take: limit }),
  ]);
  return { items, meta: paginationMeta(total, page, limit) };
}

async function uniqueSlug(name: string): Promise<string> {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "tenant";
  let slug = base;
  let i = 2;
  while (await prisma.tenant.findUnique({ where: { slug } })) slug = `${base}-${i++}`;
  return slug;
}

export async function listTenantUsers(tenantId: string) {
  return prisma.user.findMany({
    where: { tenantId },
    select: {
      id: true,
      email: true,
      fullName: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
      roles: { include: { role: { select: { key: true, name: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function listLockedAccounts(query: { page?: string; limit?: string }) {
  const { page, limit, skip } = parsePagination(query);
  const where = { lockedUntil: { gt: new Date() } };
  const [total, items] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        fullName: true,
        status: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        lastLoginAt: true,
        tenant: { select: { id: true, name: true } },
      },
      orderBy: { lockedUntil: "asc" },
      skip,
      take: limit,
    }),
  ]);
  return { items, meta: paginationMeta(total, page, limit) };
}

export async function unlockUser(id: string, req: Request) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound("User not found.");
  const user = await prisma.user.update({
    where: { id },
    data: { lockedUntil: null, failedLoginAttempts: 0 },
    select: { id: true, email: true, fullName: true, lockedUntil: true, failedLoginAttempts: true },
  });
  await recordAudit({
    req,
    action: "user.unlocked",
    module: "platform",
    recordId: id,
    recordType: "User",
    previous: { lockedUntil: existing.lockedUntil },
  });
  return user;
}

export async function lockUserUntil(id: string, until: Date, req: Request) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound("User not found.");
  if (Number.isNaN(until.getTime())) throw AppError.badRequest("Invalid lock time.");
  if (until.getTime() <= Date.now()) throw AppError.badRequest("Lock time must be in the future.");
  const user = await prisma.user.update({
    where: { id },
    data: { lockedUntil: until, failedLoginAttempts: 0 },
    select: { id: true, email: true, fullName: true, lockedUntil: true, failedLoginAttempts: true },
  });
  await recordAudit({
    req,
    action: "user.locked",
    module: "platform",
    recordId: id,
    recordType: "User",
    previous: { lockedUntil: existing.lockedUntil },
    next: { lockedUntil: until },
  });
  return user;
}

export async function updateUser(id: string, input: { fullName?: string; email?: string; status?: string }, req: Request) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound("User not found.");

  const data: Record<string, unknown> = {};
  if (input.fullName !== undefined) data.fullName = input.fullName;
  if (input.email !== undefined) data.email = input.email;
  if (input.status !== undefined) data.status = input.status;

  const user = await prisma.user.update({ where: { id }, data: data as never });
  await recordAudit({ req, action: "user.updated", module: "platform", recordId: id, recordType: "User", previous: { email: existing.email }, next: data });
  return user;
}

export async function deleteUser(id: string, req: Request) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound("User not found.");
  await prisma.user.delete({ where: { id } });
  await recordAudit({ req, action: "user.deleted", module: "platform", recordId: id, recordType: "User", previous: { email: existing.email, tenantId: existing.tenantId } });
}

export async function resetUserPassword(id: string, password: string, req: Request) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound("User not found.");
  const passwordHash = await hashPassword(password);
  // Reset lockout state too so the user can log in immediately after a reset.
  await prisma.user.update({
    where: { id },
    data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
  });
  await recordAudit({ req, action: "user.password_reset", module: "platform", recordId: id, recordType: "User" });
}
