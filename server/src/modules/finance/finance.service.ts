import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { parsePagination, paginationMeta } from "../../lib/response";
import { recordAudit } from "../../services/audit.service";
import { Request } from "express";

export interface LoanInput {
  loanNumber: string;
  employeeId: string;
  loanAmount: number;
  issueDate: Date;
  installments: number;
  startMonth: Date;
  notes?: string;
}

export async function listLoans(
  tenantId: string,
  query: { page?: string; limit?: string; status?: string; employeeId?: string; search?: string },
) {
  const { page, limit, skip } = parsePagination(query);
  const where: Prisma.EmployeeLoanWhereInput = { tenantId };
  if (query.status) where.status = query.status as Prisma.EnumLoanStatusFilter["equals"];
  if (query.employeeId) where.employeeId = query.employeeId;
  if (query.search) where.loanNumber = { contains: query.search.trim(), mode: "insensitive" };

  const [total, items] = await Promise.all([
    prisma.employeeLoan.count({ where }),
    prisma.employeeLoan.findMany({
      where,
      include: { employee: { select: { id: true, employeeNumber: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
  ]);
  return { items, meta: paginationMeta(total, page, limit) };
}

export async function getLoan(tenantId: string, id: string) {
  const loan = await prisma.employeeLoan.findFirst({
    where: { id, tenantId },
    include: {
      employee: true,
      installments: { orderBy: { dueDate: "asc" } },
    },
  });
  if (!loan) throw AppError.notFound("Loan not found.");
  return loan;
}

export async function createLoan(tenantId: string, input: LoanInput, req: Request) {
  const employee = await prisma.employee.findFirst({ where: { id: input.employeeId, tenantId } });
  if (!employee) throw AppError.notFound("Employee not found.");
  if (input.loanAmount <= 0) throw AppError.badRequest("Loan amount must be positive.");
  if (input.installments <= 0) throw AppError.badRequest("Installments must be at least 1.");

  const installmentAmount = Math.round((input.loanAmount / input.installments) * 100) / 100;
  const loan = await prisma.employeeLoan.create({
    data: {
      tenantId,
      loanNumber: input.loanNumber,
      employeeId: input.employeeId,
      loanAmount: new Prisma.Decimal(input.loanAmount),
      approvedAmount: new Prisma.Decimal(input.loanAmount),
      issueDate: input.issueDate,
      installmentCount: input.installments,
      installmentAmount: new Prisma.Decimal(installmentAmount),
      remainingBalance: new Prisma.Decimal(input.loanAmount),
      startMonth: input.startMonth,
      status: "PENDING",
      notes: input.notes,
    },
  });

  await recordAudit({ req, action: "loan.created", module: "finance", recordId: loan.id, recordType: "EmployeeLoan", next: input });
  return loan;
}

export async function approveLoan(tenantId: string, id: string, req: Request) {
  const loan = await prisma.employeeLoan.findFirst({ where: { id, tenantId } });
  if (!loan) throw AppError.notFound("Loan not found.");
  if (loan.status !== "PENDING") throw AppError.badRequest("Loan is not pending approval.");

  const updated = await prisma.employeeLoan.update({
    where: { id },
    data: { status: "ACTIVE", approvedById: req.user!.id },
  });

  await recordAudit({ req, action: "loan.approved", module: "finance", recordId: id, recordType: "EmployeeLoan", previous: { status: loan.status }, next: { status: "ACTIVE" } });
  return updated;
}

export async function cancelLoan(tenantId: string, id: string, req: Request) {
  const loan = await prisma.employeeLoan.findFirst({ where: { id, tenantId } });
  if (!loan) throw AppError.notFound("Loan not found.");
  const updated = await prisma.employeeLoan.update({ where: { id }, data: { status: "CANCELLED" } });
  await recordAudit({ req, action: "loan.cancelled", module: "finance", recordId: id, recordType: "EmployeeLoan", previous: { status: loan.status }, next: { status: "CANCELLED" } });
  return updated;
}

export async function getLoanRepaymentHistory(tenantId: string, id: string) {
  await getLoan(tenantId, id);
  return prisma.loanInstallment.findMany({ where: { tenantId, loanId: id }, orderBy: { dueDate: "asc" } });
}

// ---- Salary advances ------------------------------------------------------

export interface AdvanceInput {
  employeeId: string;
  amount: number;
  issueDate: Date;
  installments: number;
  notes?: string;
}

export async function listAdvances(
  tenantId: string,
  query: { page?: string; limit?: string; status?: string; employeeId?: string },
) {
  const { page, limit, skip } = parsePagination(query);
  const where: Prisma.SalaryAdvanceWhereInput = { tenantId };
  if (query.status) where.status = query.status as Prisma.EnumAdvanceStatusFilter["equals"];
  if (query.employeeId) where.employeeId = query.employeeId;

  const [total, items] = await Promise.all([
    prisma.salaryAdvance.count({ where }),
    prisma.salaryAdvance.findMany({
      where,
      include: { employee: { select: { id: true, employeeNumber: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
  ]);
  return { items, meta: paginationMeta(total, page, limit) };
}

export async function createAdvance(tenantId: string, input: AdvanceInput, req: Request) {
  const employee = await prisma.employee.findFirst({ where: { id: input.employeeId, tenantId } });
  if (!employee) throw AppError.notFound("Employee not found.");
  if (input.amount <= 0) throw AppError.badRequest("Advance amount must be positive.");

  const installments = Math.max(1, input.installments);
  const installmentAmount = Math.round((input.amount / installments) * 100) / 100;
  const advance = await prisma.salaryAdvance.create({
    data: {
      tenantId,
      employeeId: input.employeeId,
      amount: new Prisma.Decimal(input.amount),
      remaining: new Prisma.Decimal(input.amount),
      issueDate: input.issueDate,
      installments,
      installmentAmount: new Prisma.Decimal(installmentAmount),
      status: "PENDING",
      notes: input.notes,
    },
  });

  await recordAudit({ req, action: "advance.created", module: "finance", recordId: advance.id, recordType: "SalaryAdvance", next: input });
  return advance;
}

export async function approveAdvance(tenantId: string, id: string, req: Request) {
  const advance = await prisma.salaryAdvance.findFirst({ where: { id, tenantId } });
  if (!advance) throw AppError.notFound("Advance not found.");
  if (advance.status !== "PENDING") throw AppError.badRequest("Advance is not pending approval.");
  const updated = await prisma.salaryAdvance.update({
    where: { id },
    data: { status: "ACTIVE", approvedById: req.user!.id },
  });
  await recordAudit({ req, action: "advance.approved", module: "finance", recordId: id, recordType: "SalaryAdvance", previous: { status: advance.status }, next: { status: "ACTIVE" } });
  return updated;
}
