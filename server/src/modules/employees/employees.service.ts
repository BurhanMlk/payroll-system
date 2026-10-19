import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { parsePagination, paginationMeta } from "../../lib/response";
import { recordAudit } from "../../services/audit.service";
import { EmployeeCreateInput, EmployeeUpdateInput } from "./employees.validator";
import { Request } from "express";

export interface EmployeeListQuery {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
  branchId?: string;
  departmentId?: string;
  employmentType?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

const SORTABLE = new Set(["firstName", "lastName", "employeeNumber", "basicSalary", "joiningDate", "createdAt"]);

export async function listEmployees(tenantId: string, query: EmployeeListQuery) {
  const { page, limit, skip } = parsePagination({ page: query.page, limit: query.limit });

  const where: Prisma.EmployeeWhereInput = { tenantId };
  if (query.search) {
    const search = query.search.trim();
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { employeeNumber: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { nationalId: { contains: search, mode: "insensitive" } },
    ];
  }
  if (query.status) where.status = query.status as Prisma.EnumEmployeeStatusFilter["equals"];
  if (query.branchId) where.branchId = query.branchId;
  if (query.departmentId) where.departmentId = query.departmentId;
  if (query.employmentType) where.employmentType = query.employmentType as Prisma.EnumEmploymentTypeFilter["equals"];

  const sortBy = query.sortBy && SORTABLE.has(query.sortBy) ? query.sortBy : "createdAt";
  const orderBy: Prisma.EmployeeOrderByWithRelationInput = { [sortBy]: query.sortOrder ?? "asc" } as Prisma.EmployeeOrderByWithRelationInput;

  const [total, items] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      include: { branch: true, department: true, designation: true },
      orderBy,
      skip,
      take: limit,
    }),
  ]);

  return { items, meta: paginationMeta(total, page, limit) };
}

export async function getEmployee(tenantId: string, id: string) {
  const employee = await prisma.employee.findFirst({
    where: { id, tenantId },
    include: {
      branch: true,
      department: true,
      designation: true,
      user: { select: { id: true, email: true, fullName: true, status: true } },
      salaryStructures: { where: { isActive: true }, take: 1, orderBy: { effectiveFrom: "desc" } },
    },
  });
  if (!employee) throw AppError.notFound("Employee not found.");
  return employee;
}

/** Full employee profile by CNIC — personal info through payroll history. */
export async function getEmployeePortal(tenantId: string, cnic: string) {
  // Accept any CNIC format: with/without dashes or spaces.
  const digits = (cnic || "").replace(/\D/g, "");
  if (!digits) throw AppError.badRequest("Please provide a valid CNIC.");

  const candidates = Array.from(
    new Set([
      cnic.trim(),
      digits,
      digits.length === 13 ? `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12, 13)}` : null,
    ].filter((v): v is string => Boolean(v))),
  );

  const employee = await prisma.employee.findFirst({
    where: { tenantId, nationalId: { in: candidates } },
    include: {
      branch: true,
      department: true,
      designation: true,
      user: { select: { id: true, email: true, fullName: true, status: true } },
      salaryStructures: { where: { isActive: true }, take: 1, orderBy: { effectiveFrom: "desc" } },
      payslips: { orderBy: { createdAt: "desc" }, take: 12 },
      loans: { orderBy: { issueDate: "desc" }, take: 10 },
      advances: { orderBy: { issueDate: "desc" }, take: 10 },
      leaveRequests: { include: { leaveType: true }, orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!employee) throw AppError.notFound("No employee found with this CNIC.");

  const attendance = await prisma.attendance.findMany({
    where: { tenantId, employeeId: employee.id },
    orderBy: { date: "desc" },
    take: 30,
  });

  return { ...employee, attendance };
}

export async function createEmployee(tenantId: string, input: EmployeeCreateInput, req: Request) {
  const employeeNumber = input.employeeNumber?.trim() || (await generateEmployeeNumber(tenantId));

  const duplicate = await prisma.employee.findFirst({ where: { tenantId, employeeNumber } });
  if (duplicate) throw AppError.conflict(`Employee number "${employeeNumber}" already exists.`);

  // If a country/currency is selected on the form, update the tenant's currency
  // so salaries, payroll and payslips are shown in that currency.
  if (input.currency) {
    await prisma.tenant.update({ where: { id: tenantId }, data: { currency: input.currency } });
  }

  // Enforce plan employee limit.
  const subscription = await prisma.subscription.findUnique({
    where: { tenantId },
    include: { plan: true },
  });
  if (subscription) {
    const count = await prisma.employee.count({ where: { tenantId, status: "ACTIVE" } });
    if (count >= subscription.plan.employeeLimit) {
      throw new AppError(
        "EMPLOYEE_LIMIT_REACHED",
        `Your plan allows ${subscription.plan.employeeLimit} employees. Upgrade to add more.`,
        402,
      );
    }
  }

  if (input.branchId) await ensureTenantBranch(tenantId, input.branchId);
  const departmentId = await resolveDepartment(tenantId, input.departmentId, input.departmentName);
  const designationId = await resolveDesignation(tenantId, input.designationId, input.designationName);

  const employee = await prisma.employee.create({
    data: {
      tenantId,
      employeeNumber,
      firstName: input.firstName,
      lastName: input.lastName,
      fatherName: input.fatherName,
      nationalId: input.nationalId,
      dateOfBirth: input.dateOfBirth,
      gender: input.gender,
      phone: input.phone,
      alternatePhone: input.alternatePhone,
      email: input.email || null,
      address: input.address,
      emergencyContact: input.emergencyContact,
      branchId: input.branchId,
      departmentId,
      designationId,
      employmentType: input.employmentType,
      status: input.status,
      joiningDate: input.joiningDate,
      confirmationDate: input.confirmationDate,
      contractStart: input.contractStart,
      contractEnd: input.contractEnd,
      bankName: input.bankName,
      accountTitle: input.accountTitle,
      accountNumber: input.accountNumber,
      bankBranchName: input.bankBranchName,
      basicSalary: new Prisma.Decimal(input.basicSalary),
      salaryType: input.salaryType,
      paymentMethod: input.paymentMethod,
    },
    include: { branch: true, department: true, designation: true },
  });

  await recordAudit({
    req,
    action: "employee.created",
    module: "employee",
    recordId: employee.id,
    recordType: "Employee",
    next: { id: employee.id, employeeNumber: employee.employeeNumber },
  });

  return employee;
}

export async function updateEmployee(tenantId: string, id: string, input: EmployeeUpdateInput, req: Request) {
  const existing = await prisma.employee.findFirst({ where: { id, tenantId } });
  if (!existing) throw AppError.notFound("Employee not found.");

  if (input.branchId) await ensureTenantBranch(tenantId, input.branchId);

  const { departmentName, designationName, ...rest } = input;
  const data: Prisma.EmployeeUncheckedUpdateInput = { ...rest };
  if (departmentName) {
    data.departmentId = await resolveDepartment(tenantId, input.departmentId, departmentName);
  } else if (input.departmentId) {
    await ensureTenantDepartment(tenantId, input.departmentId);
  }
  if (designationName) {
    data.designationId = await resolveDesignation(tenantId, input.designationId, designationName);
  } else if (input.designationId) {
    await ensureTenantDesignation(tenantId, input.designationId);
  }

  if (input.email === "") data.email = null;
  if (input.basicSalary !== undefined) data.basicSalary = new Prisma.Decimal(input.basicSalary);

  const updated = await prisma.employee.update({
    where: { id },
    data,
    include: { branch: true, department: true, designation: true },
  });

  await recordAudit({
    req,
    action: "employee.updated",
    module: "employee",
    recordId: id,
    recordType: "Employee",
    previous: pick(existing, ["basicSalary", "status", "departmentId", "designationId"]),
    next: pick(updated, ["basicSalary", "status", "departmentId", "designationId"]),
  });

  return updated;
}

export async function archiveEmployee(tenantId: string, id: string, req: Request) {
  const existing = await prisma.employee.findFirst({ where: { id, tenantId } });
  if (!existing) throw AppError.notFound("Employee not found.");
  if (existing.status === "RESIGNED") throw AppError.badRequest("Employee is already archived.");

  const updated = await prisma.employee.update({
    where: { id },
    data: { status: "RESIGNED", contractEnd: new Date() },
  });

  await recordAudit({
    req,
    action: "employee.archived",
    module: "employee",
    recordId: id,
    recordType: "Employee",
    previous: { status: existing.status },
    next: { status: "RESIGNED" },
  });
  return updated;
}

export async function deleteEmployee(tenantId: string, id: string, req: Request) {
  const existing = await prisma.employee.findFirst({ where: { id, tenantId } });
  if (!existing) throw AppError.notFound("Employee not found.");

  await prisma.employee.delete({ where: { id } });

  await recordAudit({
    req,
    action: "employee.deleted",
    module: "employee",
    recordId: id,
    recordType: "Employee",
    previous: {
      employeeNumber: existing.employeeNumber,
      firstName: existing.firstName,
      lastName: existing.lastName,
    },
  });
}

export async function getEmployeeSalaryHistory(tenantId: string, id: string) {
  await getEmployee(tenantId, id);
  return prisma.employeeSalaryStructure.findMany({
    where: { tenantId, employeeId: id },
    orderBy: { effectiveFrom: "desc" },
  });
}

export async function listEmployeeDocuments(tenantId: string, employeeId: string) {
  await getEmployee(tenantId, employeeId);
  return prisma.employeeDocument.findMany({ where: { tenantId, employeeId }, orderBy: { createdAt: "desc" } });
}

async function ensureTenantBranch(tenantId: string, branchId: string) {
  const branch = await prisma.branch.findFirst({ where: { id: branchId, tenantId } });
  if (!branch) throw AppError.badRequest("Selected branch does not exist.");
}

async function ensureTenantDepartment(tenantId: string, departmentId: string) {
  const dept = await prisma.department.findFirst({ where: { id: departmentId, tenantId } });
  if (!dept) throw AppError.badRequest("Selected department does not exist.");
}

async function ensureTenantDesignation(tenantId: string, designationId: string) {
  const desig = await prisma.designation.findFirst({ where: { id: designationId, tenantId } });
  if (!desig) throw AppError.badRequest("Selected designation does not exist.");
}

async function generateEmployeeNumber(tenantId: string): Promise<string> {
  const count = await prisma.employee.count({ where: { tenantId } });
  let number = String(count + 1);
  while (await prisma.employee.findFirst({ where: { tenantId, employeeNumber: number } })) {
    number = String(parseInt(number, 10) + 1);
  }
  return number;
}

async function resolveDepartment(tenantId: string, departmentId?: string, departmentName?: string): Promise<string | undefined> {
  if (departmentId) {
    await ensureTenantDepartment(tenantId, departmentId);
    return departmentId;
  }
  const name = departmentName?.trim();
  if (!name) return undefined;
  const existing = await prisma.department.findFirst({ where: { tenantId, name } });
  if (existing) return existing.id;
  const created = await prisma.department.create({ data: { tenantId, name } });
  return created.id;
}

async function resolveDesignation(tenantId: string, designationId?: string, designationName?: string): Promise<string | undefined> {
  if (designationId) {
    await ensureTenantDesignation(tenantId, designationId);
    return designationId;
  }
  const name = designationName?.trim();
  if (!name) return undefined;
  const existing = await prisma.designation.findFirst({ where: { tenantId, name } });
  if (existing) return existing.id;
  const created = await prisma.designation.create({ data: { tenantId, name } });
  return created.id;
}

function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Partial<T> {
  const result: Partial<T> = {};
  for (const k of keys) result[k] = obj[k];
  return result;
}
