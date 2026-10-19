import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";

export interface CreatePlanInput {
  name: string;
  key: string;
  description?: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency?: string;
  employeeLimit: number;
  branchLimit: number;
  userLimit: number;
  storageLimitMb: number;
  trialDays: number;
  features: { key: string; label: string; enabled: boolean; limitValue?: number }[];
  sortOrder?: number;
  isActive?: boolean;
}

export async function listPlans() {
  return prisma.subscriptionPlan.findMany({
    include: { features: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getPlan(id: string) {
  return prisma.subscriptionPlan.findUnique({ where: { id }, include: { features: true } });
}

export async function createPlan(input: CreatePlanInput) {
  const exists = await prisma.subscriptionPlan.findUnique({ where: { key: input.key } });
  if (exists) throw AppError.conflict(`A plan with key "${input.key}" already exists.`);

  return prisma.subscriptionPlan.create({
    data: {
      name: input.name,
      key: input.key,
      description: input.description,
      monthlyPrice: new Prisma.Decimal(input.monthlyPrice),
      yearlyPrice: new Prisma.Decimal(input.yearlyPrice),
      currency: input.currency ?? "USD",
      employeeLimit: input.employeeLimit,
      branchLimit: input.branchLimit,
      userLimit: input.userLimit,
      storageLimitMb: input.storageLimitMb,
      trialDays: input.trialDays,
      sortOrder: input.sortOrder ?? 0,
      features: {
        create: input.features.map((f) => ({
          key: f.key,
          label: f.label,
          enabled: f.enabled,
          limitValue: f.limitValue,
        })),
      },
    },
    include: { features: true },
  });
}

export async function updatePlan(id: string, input: Partial<CreatePlanInput>) {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id } });
  if (!plan) throw AppError.notFound("Plan not found.");

  await prisma.subscriptionPlan.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description,
      monthlyPrice: input.monthlyPrice !== undefined ? new Prisma.Decimal(input.monthlyPrice) : undefined,
      yearlyPrice: input.yearlyPrice !== undefined ? new Prisma.Decimal(input.yearlyPrice) : undefined,
      currency: input.currency,
      employeeLimit: input.employeeLimit,
      branchLimit: input.branchLimit,
      userLimit: input.userLimit,
      storageLimitMb: input.storageLimitMb,
      trialDays: input.trialDays,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    },
  });

  if (input.features) {
    await prisma.$transaction([
      prisma.planFeature.deleteMany({ where: { planId: id } }),
      prisma.planFeature.createMany({
        data: input.features.map((f) => ({
          planId: id,
          key: f.key,
          label: f.label,
          enabled: f.enabled,
          limitValue: f.limitValue,
        })),
      }),
    ]);
  }

  return getPlan(id);
}

export async function togglePlanActive(id: string, isActive: boolean) {
  return prisma.subscriptionPlan.update({ where: { id }, data: { isActive } });
}

export async function deletePlan(id: string) {
  const used = await prisma.subscription.count({ where: { planId: id } });
  if (used > 0) throw AppError.badRequest("Cannot delete a plan with active subscriptions.");
  await prisma.subscriptionPlan.delete({ where: { id } });
}
