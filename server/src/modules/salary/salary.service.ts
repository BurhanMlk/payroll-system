import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { recordAudit } from "../../services/audit.service";
import { Request } from "express";

export interface SalaryComponentInput {
  name: string;
  type: "EARNING" | "DEDUCTION";
  calculation: "FIXED" | "PERCENTAGE" | "FORMULA";
  value: number;
  formula?: string;
  taxable?: boolean;
  sortOrder?: number;
}

export interface TemplateInput {
  name: string;
  description?: string;
  isDefault?: boolean;
  components: SalaryComponentInput[];
}

export async function listTemplates(tenantId: string) {
  return prisma.salaryTemplate.findMany({
    where: { tenantId },
    include: { components: { orderBy: { sortOrder: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getTemplate(tenantId: string, id: string) {
  const template = await prisma.salaryTemplate.findFirst({
    where: { id, tenantId },
    include: { components: { orderBy: { sortOrder: "asc" } } },
  });
  if (!template) throw AppError.notFound("Salary template not found.");
  return template;
}

export async function createTemplate(tenantId: string, input: TemplateInput, req: Request) {
  if (input.isDefault) {
    await prisma.salaryTemplate.updateMany({ where: { tenantId }, data: { isDefault: false } });
  }
  const template = await prisma.salaryTemplate.create({
    data: {
      tenantId,
      name: input.name,
      description: input.description,
      isDefault: input.isDefault ?? false,
      components: {
        create: input.components.map((c, i) => ({
          tenantId,
          name: c.name,
          type: c.type,
          calculation: c.calculation,
          value: new Prisma.Decimal(c.value),
          formula: c.formula,
          taxable: c.taxable ?? false,
          sortOrder: c.sortOrder ?? i,
        })),
      },
    },
    include: { components: true },
  });
  await recordAudit({ req, action: "template.created", module: "salary", recordId: template.id, recordType: "SalaryTemplate", next: input });
  return template;
}

export async function updateTemplate(tenantId: string, id: string, input: Partial<TemplateInput>, req: Request) {
  await getTemplate(tenantId, id);
  if (input.isDefault) {
    await prisma.salaryTemplate.updateMany({ where: { tenantId }, data: { isDefault: false } });
  }
  await prisma.salaryTemplate.update({
    where: { id },
    data: { name: input.name, description: input.description, isDefault: input.isDefault },
  });
  if (input.components) {
    await prisma.$transaction([
      prisma.salaryComponent.deleteMany({ where: { templateId: id } }),
      prisma.salaryComponent.createMany({
        data: input.components.map((c, i) => ({
          tenantId,
          templateId: id,
          name: c.name,
          type: c.type,
          calculation: c.calculation,
          value: new Prisma.Decimal(c.value),
          formula: c.formula,
          taxable: c.taxable ?? false,
          sortOrder: c.sortOrder ?? i,
        })),
      }),
    ]);
  }
  const updated = await getTemplate(tenantId, id);
  await recordAudit({ req, action: "template.updated", module: "salary", recordId: id, recordType: "SalaryTemplate", next: input });
  return updated;
}

export async function deleteTemplate(tenantId: string, id: string, req: Request) {
  await getTemplate(tenantId, id);
  await prisma.salaryTemplate.delete({ where: { id } });
  await recordAudit({ req, action: "template.deleted", module: "salary", recordId: id, recordType: "SalaryTemplate" });
}

/** Assigns a salary structure (from template or custom components) to an employee. */
export async function assignSalaryStructure(
  tenantId: string,
  employeeId: string,
  input: { basicSalary: number; templateId?: string; components?: SalaryComponentInput[]; effectiveFrom?: Date },
  req: Request,
) {
  const employee = await prisma.employee.findFirst({ where: { id: employeeId, tenantId } });
  if (!employee) throw AppError.notFound("Employee not found.");

  let components: SalaryComponentInput[];
  let templateId: string | null = input.templateId ?? null;

  if (input.templateId) {
    const template = await getTemplate(tenantId, input.templateId);
    components = template.components.map((c) => ({
      name: c.name,
      type: c.type as "EARNING" | "DEDUCTION",
      calculation: c.calculation as "FIXED" | "PERCENTAGE" | "FORMULA",
      value: c.value.toNumber(),
      formula: c.formula ?? undefined,
      taxable: c.taxable,
      sortOrder: c.sortOrder,
    }));
  } else {
    components = input.components ?? [];
  }

  // Deactivate previous structures.
  await prisma.employeeSalaryStructure.updateMany({
    where: { tenantId, employeeId, isActive: true },
    data: { isActive: false, effectiveTo: input.effectiveFrom ?? new Date() },
  });

  const structure = await prisma.employeeSalaryStructure.create({
    data: {
      tenantId,
      employeeId,
      templateId,
      basicSalary: new Prisma.Decimal(input.basicSalary),
      components: components as unknown as Prisma.InputJsonValue,
      effectiveFrom: input.effectiveFrom ?? new Date(),
      isActive: true,
    },
  });

  await prisma.employee.update({
    where: { id: employeeId },
    data: { basicSalary: new Prisma.Decimal(input.basicSalary) },
  });

  await recordAudit({
    req,
    action: "salary.structure_assigned",
    module: "salary",
    recordId: structure.id,
    recordType: "EmployeeSalaryStructure",
    next: { employeeId, basicSalary: input.basicSalary },
  });
  return structure;
}

export async function getEmployeeStructure(tenantId: string, employeeId: string) {
  return prisma.employeeSalaryStructure.findMany({
    where: { tenantId, employeeId },
    orderBy: { effectiveFrom: "desc" },
    include: { template: { select: { id: true, name: true } } },
  });
}
