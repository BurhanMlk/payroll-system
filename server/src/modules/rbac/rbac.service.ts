import { prisma } from "../../lib/prisma";
import { ALL_PERMISSIONS, DEFAULT_ROLES, PERMISSIONS } from "../../constants/permissions";
import { AppError } from "../../lib/errors";

/** Creates/updates the global permission catalog. */
export async function seedPermissions(): Promise<void> {
  for (const p of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { module: p.module, action: p.action, description: p.description },
      create: { key: p.key, module: p.module, action: p.action, description: p.description },
    });
  }
}

/** Seeds platform roles (tenantId = null). */
export async function seedPlatformRoles(): Promise<void> {
  await seedPermissions();
  for (const roleDef of DEFAULT_ROLES.filter((r) => r.scope === "PLATFORM")) {
    let role = await prisma.role.findFirst({ where: { tenantId: null, key: roleDef.key } });
    if (!role) {
      role = await prisma.role.create({
        data: {
          tenantId: null,
          scope: "PLATFORM",
          key: roleDef.key,
          name: roleDef.name,
          description: roleDef.description,
          isSystem: true,
        },
      });
    } else {
      role = await prisma.role.update({
        where: { id: role.id },
        data: { name: roleDef.name, description: roleDef.description },
      });
    }
    await syncRolePermissions(role.id, roleDef.permissions);
  }
}

/** Seeds tenant roles for a newly created tenant. */
export async function seedTenantRoles(tenantId: string): Promise<void> {
  await seedPermissions();
  for (const roleDef of DEFAULT_ROLES.filter((r) => r.scope === "TENANT")) {
    const role = await prisma.role.upsert({
      where: { tenantId_key: { tenantId, key: roleDef.key } },
      update: { name: roleDef.name, description: roleDef.description },
      create: {
        tenantId,
        scope: "TENANT",
        key: roleDef.key,
        name: roleDef.name,
        description: roleDef.description,
        isSystem: true,
      },
    });
    await syncRolePermissions(role.id, roleDef.permissions);
  }
}

export async function syncRolePermissions(roleId: string, permissionKeys: string[]): Promise<void> {
  const permissions = await prisma.permission.findMany({
    where: { key: { in: permissionKeys } },
  });
  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId } }),
    prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId, permissionId: p.id })),
      skipDuplicates: true,
    }),
  ]);
}

export async function getRoleByKey(tenantId: string, key: string) {
  return prisma.role.findUnique({ where: { tenantId_key: { tenantId, key } } });
}

export async function assignRole(userId: string, roleId: string): Promise<void> {
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId, roleId } },
    update: {},
    create: { userId, roleId },
  });
}

export async function assignRoleByKey(userId: string, tenantId: string, key: string): Promise<void> {
  const role = await getRoleByKey(tenantId, key);
  if (!role) throw AppError.notFound(`Role "${key}" not found.`);
  await assignRole(userId, role.id);
}

export async function listTenantRoles(tenantId: string) {
  return prisma.role.findMany({
    where: { tenantId },
    include: { permissions: { include: { permission: true } }, _count: { select: { userRoles: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function createRole(
  tenantId: string,
  data: { name: string; key: string; description?: string; permissionKeys: string[] },
) {
  const exists = await prisma.role.findUnique({ where: { tenantId_key: { tenantId, key: data.key } } });
  if (exists) throw AppError.conflict(`A role with key "${data.key}" already exists.`);

  const role = await prisma.role.create({
    data: {
      tenantId,
      scope: "TENANT",
      name: data.name,
      key: data.key,
      description: data.description,
      isSystem: false,
    },
  });
  await syncRolePermissions(role.id, data.permissionKeys);
  return role;
}

export async function updateRole(
  tenantId: string,
  roleId: string,
  data: { name?: string; description?: string; permissionKeys?: string[] },
) {
  const role = await prisma.role.findFirst({ where: { id: roleId, tenantId } });
  if (!role) throw AppError.notFound("Role not found.");
  if (role.isSystem && data.permissionKeys) {
    // System roles may be renamed but their permission set is protected.
    await prisma.role.update({ where: { id: roleId }, data: { name: data.name, description: data.description } });
    return prisma.role.findUnique({ where: { id: roleId } });
  }
  await prisma.role.update({
    where: { id: roleId },
    data: { name: data.name, description: data.description },
  });
  if (data.permissionKeys) {
    await syncRolePermissions(roleId, data.permissionKeys);
  }
  return prisma.role.findUnique({ where: { id: roleId } });
}

export async function deleteRole(tenantId: string, roleId: string): Promise<void> {
  const role = await prisma.role.findFirst({ where: { id: roleId, tenantId } });
  if (!role) throw AppError.notFound("Role not found.");
  if (role.isSystem) throw AppError.badRequest("System roles cannot be deleted.");
  const used = await prisma.userRole.count({ where: { roleId } });
  if (used > 0) throw AppError.badRequest("Cannot delete a role that is assigned to users.");
  await prisma.role.delete({ where: { id: roleId } });
}

export async function listPermissions() {
  return prisma.permission.findMany({ orderBy: { module: "asc" } });
}

export const ALL_TENANT_PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);
