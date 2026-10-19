import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { parsePagination, paginationMeta } from "../../lib/response";
import { hashPassword } from "../../services/auth.service";
import { recordAudit } from "../../services/audit.service";
import { Request } from "express";

export async function listUsers(
  tenantId: string,
  query: { page?: string; limit?: string; search?: string; status?: string },
) {
  const { page, limit, skip } = parsePagination(query);
  const where: Record<string, unknown> = { tenantId };
  if (query.search) {
    where.OR = [
      { fullName: { contains: query.search.trim(), mode: "insensitive" } },
      { email: { contains: query.search.trim(), mode: "insensitive" } },
    ];
  }
  if (query.status) where.status = query.status;

  const [total, items] = await Promise.all([
    prisma.user.count({ where: where as never }),
    prisma.user.findMany({
      where: where as never,
      include: { roles: { include: { role: true } }, employee: { select: { id: true, employeeNumber: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
  ]);
  return { items, meta: paginationMeta(total, page, limit) };
}

export async function createUser(
  tenantId: string,
  input: { fullName: string; email: string; password: string; roleIds: string[]; branchIds?: string[] },
  req: Request,
) {
  const exists = await prisma.user.findUnique({ where: { email: input.email.toLowerCase().trim() } });
  if (exists) throw AppError.conflict("A user with this email already exists.");

  // Validate roles belong to the tenant.
  const roles = await prisma.role.findMany({ where: { id: { in: input.roleIds }, tenantId } });
  if (roles.length !== input.roleIds.length) throw AppError.badRequest("One or more roles are invalid.");

  const user = await prisma.user.create({
    data: {
      tenantId,
      fullName: input.fullName,
      email: input.email.toLowerCase().trim(),
      passwordHash: await hashPassword(input.password),
      branchIds: (input.branchIds ?? null) as Prisma.InputJsonValue,
      status: "ACTIVE",
      roles: { create: input.roleIds.map((roleId) => ({ roleId })) },
    },
    include: { roles: { include: { role: true } } },
  });

  await recordAudit({ req, action: "user.created", module: "settings", recordId: user.id, recordType: "User", next: { email: user.email } });
  return user;
}

export async function updateUser(
  tenantId: string,
  id: string,
  input: { fullName?: string; roleIds?: string[]; branchIds?: string[]; status?: string },
  req: Request,
) {
  const user = await prisma.user.findFirst({ where: { id, tenantId } });
  if (!user) throw AppError.notFound("User not found.");

  if (input.roleIds) {
    const roles = await prisma.role.findMany({ where: { id: { in: input.roleIds }, tenantId } });
    if (roles.length !== input.roleIds.length) throw AppError.badRequest("One or more roles are invalid.");
    await prisma.userRole.deleteMany({ where: { userId: id } });
    await prisma.userRole.createMany({ data: input.roleIds.map((roleId) => ({ userId: id, roleId })) });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      fullName: input.fullName,
      branchIds: input.branchIds !== undefined ? input.branchIds : undefined,
      status: (input.status as never) ?? undefined,
    },
    include: { roles: { include: { role: true } } },
  });

  await recordAudit({ req, action: "user.updated", module: "settings", recordId: id, recordType: "User", previous: { email: user.email }, next: input });
  return updated;
}

export async function deleteUser(tenantId: string, id: string, req: Request) {
  const user = await prisma.user.findFirst({ where: { id, tenantId } });
  if (!user) throw AppError.notFound("User not found.");
  await prisma.user.delete({ where: { id } });
  await recordAudit({ req, action: "user.deleted", module: "settings", recordId: id, recordType: "User", previous: { email: user.email } });
}

// ---- Tenant settings ------------------------------------------------------

export async function getSettings(tenantId: string) {
  return prisma.tenantSetting.findMany({ where: { tenantId } });
}

export async function updateSettings(tenantId: string, key: string, value: unknown, req: Request) {
  const setting = await prisma.tenantSetting.upsert({
    where: { tenantId_key: { tenantId, key } },
    update: { value: value as never },
    create: { tenantId, key, value: value as never },
  });
  await recordAudit({ req, action: "settings.updated", module: "settings", recordId: setting.id, recordType: "TenantSetting", metadata: { key } });
  return setting;
}
