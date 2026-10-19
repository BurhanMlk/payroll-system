import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { parsePagination, paginationMeta } from "../../lib/response";
import { recordAudit } from "../../services/audit.service";
import { Request } from "express";

type OrgModel = "department" | "designation" | "branch";

function modelDelegate(model: OrgModel) {
  if (model === "department") return prisma.department;
  if (model === "designation") return prisma.designation;
  return prisma.branch;
}

async function generateBranchCode(tenantId: string, name: string): Promise<string> {
  const base = (name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase() || "BR").slice(0, 6);
  let code = base;
  let i = 2;
  while (await prisma.branch.findFirst({ where: { tenantId, code } })) {
    code = `${base}-${i++}`;
  }
  return code;
}

export async function listOrg(model: OrgModel, tenantId: string, query: { page?: string; limit?: string; search?: string }) {
  const { page, limit, skip } = parsePagination(query);
  const where: Record<string, unknown> = { tenantId };
  if (query.search) {
    where.name = { contains: query.search.trim(), mode: "insensitive" };
  }
  const delegate = modelDelegate(model) as unknown as {
    count: (a: object) => Promise<number>;
    findMany: (a: object) => Promise<unknown[]>;
  };
  const [total, items] = await Promise.all([
    delegate.count({ where }),
    delegate.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: limit,
      include: model === "branch" ? { manager: { select: { id: true, fullName: true } } } : undefined,
    }),
  ]);
  return { items, meta: paginationMeta(total, page, limit) };
}

export async function createOrg(
  model: OrgModel,
  tenantId: string,
  input: Record<string, unknown>,
  req: Request,
) {
  const delegate = modelDelegate(model) as unknown as {
    findFirst: (a: object) => Promise<unknown>;
    create: (a: object) => Promise<{ id: string }>;
  };

  const name = String(input.name ?? "");
  if (model !== "designation") {
    const existing = await delegate.findFirst({ where: { tenantId, name } });
    if (existing) throw AppError.conflict(`A ${model} named "${name}" already exists.`);
  }

  const data: Record<string, unknown> = { tenantId };
  for (const k of Object.keys(input)) data[k] = input[k];

  // Branches require a unique code; auto-generate one when not provided.
  if (model === "branch" && !data.code) {
    data.code = await generateBranchCode(tenantId, name);
  }

  const created = (await delegate.create({ data })) as { id: string };

  await recordAudit({
    req,
    action: `${model}.created`,
    module: "organization",
    recordId: created.id,
    recordType: model,
    next: { name },
  });
  return created;
}

export async function updateOrg(
  model: OrgModel,
  tenantId: string,
  id: string,
  input: Record<string, unknown>,
  req: Request,
) {
  const delegate = modelDelegate(model) as unknown as {
    findFirst: (a: object) => Promise<unknown>;
    update: (a: object) => Promise<unknown>;
  };
  const existing = await delegate.findFirst({ where: { id, tenantId } });
  if (!existing) throw AppError.notFound(`${model} not found.`);

  const updated = await delegate.update({ where: { id }, data: input });

  await recordAudit({
    req,
    action: `${model}.updated`,
    module: "organization",
    recordId: id,
    recordType: model,
    previous: existing,
    next: input,
  });
  return updated;
}

export async function deleteOrg(model: OrgModel, tenantId: string, id: string, req: Request) {
  const delegate = modelDelegate(model) as unknown as {
    findFirst: (a: object) => Promise<unknown>;
    delete: (a: object) => Promise<unknown>;
  };
  const existing = await delegate.findFirst({ where: { id, tenantId } });
  if (!existing) throw AppError.notFound(`${model} not found.`);

  await delegate.delete({ where: { id } });

  await recordAudit({
    req,
    action: `${model}.deleted`,
    module: "organization",
    recordId: id,
    recordType: model,
    previous: existing,
  });
}
