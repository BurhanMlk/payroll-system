import { Prisma, PayrollStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { parsePagination, paginationMeta } from "../../lib/response";
import { recordAudit } from "../../services/audit.service";
import { calculatePayroll, PayrollCalculationResult, SalaryComponentInput } from "./payroll.calculator";
import { endOfDay, startOfDay, startOfMonth, endOfMonth } from "../../utils/dates";
import { toCsv } from "../../utils/csv";
import { Request } from "express";

interface PayrollException {
  employeeId: string;
  employeeNumber: string;
  type: string;
  message: string;
}

interface GenerateOptions {
  cycleId?: string;
  periodStart?: Date;
  periodEnd?: Date;
  name?: string;
}

export async function generatePayroll(tenantId: string, opts: GenerateOptions, req: Request) {
  const cycle = opts.cycleId
    ? await prisma.payrollCycle.findFirst({ where: { id: opts.cycleId, tenantId } })
    : await prisma.payrollCycle.findFirst({ where: { tenantId, isActive: true } });
  if (!cycle) throw AppError.badRequest("No active payroll cycle configured.", "NO_PAYROLL_CYCLE");

  const periodStart = startOfDay(opts.periodStart ?? startOfMonth(new Date()));
  const periodEnd = endOfDay(opts.periodEnd ?? endOfMonth(new Date()));
  const name = opts.name ?? `${periodStart.toLocaleString("en", { month: "long", year: "numeric" })} Payroll`;

  // Duplicate prevention: one run per period.
  const duplicate = await prisma.payrollRun.findFirst({
    where: {
      tenantId,
      periodStart,
      periodEnd,
      status: { notIn: ["CANCELLED"] },
    },
  });
  if (duplicate) throw AppError.conflict(`A payroll run for this period already exists (status: ${duplicate.status}).`);

  const taxSetting = await prisma.tenantSetting.findUnique({ where: { tenantId_key: { tenantId, key: "tax" } } });
  const taxConfig = (taxSetting?.value as unknown as { enabled?: boolean; mode?: string; slabs?: unknown; percentage?: number; fixedAmount?: number; exemption?: number }) ?? {};

  const employees = await prisma.employee.findMany({
    where: { tenantId, status: { in: ["ACTIVE", "INACTIVE"] } },
    include: { salaryStructures: { where: { isActive: true }, take: 1, orderBy: { effectiveFrom: "desc" } } },
  });

  const workingDays = cycle.workingDaysPerMonth || 22;
  const exceptions: PayrollException[] = [];
  const computed: Array<{
    employee: (typeof employees)[number];
    result: PayrollCalculationResult;
    attendance: {
      presentDays: number;
      absentDays: number;
      lateMinutes: number;
      overtimeHours: number;
      paidLeaveDays: number;
      unpaidLeaveDays: number;
      workingDays: number;
    };
    loanInstallment: number;
    advanceDeduction: number;
    loanId: string | null;
    advanceId: string | null;
  }> = [];

  for (const employee of employees) {
    const structure = employee.salaryStructures[0];
    if (!structure) {
      exceptions.push({
        employeeId: employee.id,
        employeeNumber: employee.employeeNumber,
        type: "MISSING_SALARY",
        message: "No active salary structure assigned.",
      });
      continue;
    }
    if (!employee.accountNumber) {
      exceptions.push({
        employeeId: employee.id,
        employeeNumber: employee.employeeNumber,
        type: "MISSING_BANK_DETAILS",
        message: "Bank account details are missing.",
      });
    }

    const attendance = await summarizeAttendance(tenantId, employee.id, periodStart, periodEnd);
    attendance.workingDays = workingDays;
    const hourlyRate = structure.basicSalary.toNumber() / workingDays / 8;
    const overtimeRatePerHour = hourlyRate * cycle.overtimeRate.toNumber();

    // Active loan installment.
    const loan = await prisma.employeeLoan.findFirst({
      where: { tenantId, employeeId: employee.id, status: "ACTIVE" },
      orderBy: { issueDate: "asc" },
    });
    const loanInstallment = loan
      ? Math.min(loan.installmentAmount.toNumber(), loan.remainingBalance.toNumber())
      : 0;

    // Active salary advance.
    const advance = await prisma.salaryAdvance.findFirst({
      where: { tenantId, employeeId: employee.id, status: "ACTIVE" },
      orderBy: { issueDate: "asc" },
    });
    const advanceDeduction = advance
      ? Math.min(advance.installmentAmount.toNumber(), advance.remaining.toNumber())
      : 0;

    const components = (structure.components as unknown as SalaryComponentInput[]) ?? [];
    const result = calculatePayroll({
      basicSalary: structure.basicSalary.toNumber(),
      components,
      attendance,
      overtimeRatePerHour,
      hourlyRate,
      loanInstallment,
      advanceDeduction,
      taxConfig: {
        enabled: taxConfig.enabled ?? false,
        mode: (taxConfig.mode as "FIXED" | "PERCENTAGE" | "SLAB" | "NONE") ?? "NONE",
        fixedAmount: taxConfig.fixedAmount,
        percentage: taxConfig.percentage,
        slabs: (taxConfig.slabs as Array<{ min: number; max: number | null; rate: number; fixedAmount?: number }>) ?? [],
        exemption: taxConfig.exemption,
      },
      currency: req.tenant?.currency ?? "USD",
    });

    if (result.netSalary < 0) {
      exceptions.push({
        employeeId: employee.id,
        employeeNumber: employee.employeeNumber,
        type: "NEGATIVE_NET",
        message: `Net salary is negative (${result.netSalary}).`,
      });
    }

    computed.push({
      employee,
      result,
      attendance,
      loanInstallment,
      advanceDeduction,
      loanId: loan?.id ?? null,
      advanceId: advance?.id ?? null,
    });
  }

  if (computed.length === 0) {
    throw AppError.badRequest("No employees with valid salary structures were found.", "NO_EMPLOYEES");
  }

  const totalGross = computed.reduce((s, c) => s + c.result.grossSalary, 0);
  const totalDeductions = computed.reduce((s, c) => s + c.result.totalDeductions, 0);
  const totalNet = computed.reduce((s, c) => s + c.result.netSalary, 0);

  const run = await prisma.$transaction(async (tx) => {
    const payrollRun = await tx.payrollRun.create({
      data: {
        tenantId,
        cycleId: cycle.id,
        name,
        periodStart,
        periodEnd,
        payDate: new Date(periodEnd.getFullYear(), periodEnd.getMonth() + 1, cycle.payDay),
        status: "CALCULATED",
        totalGross: new Prisma.Decimal(totalGross),
        totalDeductions: new Prisma.Decimal(totalDeductions),
        totalNet: new Prisma.Decimal(totalNet),
        employeeCount: computed.length,
        exceptions: exceptions as unknown as Prisma.InputJsonValue,
      },
    });

    for (const c of computed) {
      const item = await tx.payrollItem.create({
        data: {
          tenantId,
          payrollRunId: payrollRun.id,
          employeeId: c.employee.id,
          basicSalary: new Prisma.Decimal(c.result.basicSalary),
          grossSalary: new Prisma.Decimal(c.result.grossSalary),
          totalEarnings: new Prisma.Decimal(c.result.totalEarnings),
          totalDeductions: new Prisma.Decimal(c.result.totalDeductions),
          netSalary: new Prisma.Decimal(c.result.netSalary),
          presentDays: new Prisma.Decimal(c.attendance.presentDays),
          absentDays: new Prisma.Decimal(c.attendance.absentDays),
          lateMinutes: c.attendance.lateMinutes,
          overtimeHours: new Prisma.Decimal(c.attendance.overtimeHours),
          paidLeaveDays: new Prisma.Decimal(c.attendance.paidLeaveDays),
          unpaidLeaveDays: new Prisma.Decimal(c.attendance.unpaidLeaveDays),
          loanDeduction: new Prisma.Decimal(c.loanInstallment),
          advanceDeduction: new Prisma.Decimal(c.advanceDeduction),
          taxAmount: new Prisma.Decimal(c.result.taxAmount),
          snapshot: {
            basicSalary: c.result.basicSalary,
            components: c.employee.salaryStructures[0]?.components ?? [],
            trace: c.result.trace,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      await tx.payrollEarning.createMany({
        data: c.result.earnings.map((e) => ({
          tenantId,
          payrollItemId: item.id,
          name: e.name,
          type: "EARNING",
          amount: new Prisma.Decimal(e.amount),
          taxable: false,
        })),
      });
      await tx.payrollDeduction.createMany({
        data: c.result.deductions.map((d) => ({
          tenantId,
          payrollItemId: item.id,
          name: d.name,
          type: "DEDUCTION",
          amount: new Prisma.Decimal(d.amount),
        })),
      });

      // Record loan installment deduction and reduce balance.
      if (c.loanId && c.loanInstallment > 0) {
        await tx.loanInstallment.create({
          data: {
            tenantId,
            loanId: c.loanId,
            payrollRunId: payrollRun.id,
            payrollItemId: item.id,
            dueDate: payrollRun.payDate,
            amount: new Prisma.Decimal(c.loanInstallment),
            status: "PENDING",
          },
        });
        const loan = await tx.employeeLoan.findUniqueOrThrow({ where: { id: c.loanId } });
        const newBalance = loan.remainingBalance.minus(c.loanInstallment);
        await tx.employeeLoan.update({
          where: { id: c.loanId },
          data: { remainingBalance: newBalance, status: newBalance.lte(0) ? "COMPLETED" : "ACTIVE" },
        });
      }

      // Record advance deduction and reduce remaining.
      if (c.advanceId && c.advanceDeduction > 0) {
        const advance = await tx.salaryAdvance.findUniqueOrThrow({ where: { id: c.advanceId } });
        const newRemaining = advance.remaining.minus(c.advanceDeduction);
        await tx.salaryAdvance.update({
          where: { id: c.advanceId },
          data: { remaining: newRemaining, status: newRemaining.lte(0) ? "DEDUCTED" : "ACTIVE" },
        });
      }
    }

    return payrollRun;
  });

  await recordAudit({
    req,
    action: "payroll.generated",
    module: "payroll",
    recordId: run.id,
    recordType: "PayrollRun",
    metadata: { employees: computed.length, totalNet, exceptions: exceptions.length },
  });

  return getPayrollRun(tenantId, run.id);
}

export async function listPayrollRuns(
  tenantId: string,
  query: { page?: string; limit?: string; status?: string; search?: string },
) {
  const { page, limit, skip } = parsePagination(query);
  const where: Prisma.PayrollRunWhereInput = { tenantId };
  if (query.status) where.status = query.status as Prisma.EnumPayrollStatusFilter["equals"];
  if (query.search) where.name = { contains: query.search.trim(), mode: "insensitive" };

  const [total, items] = await Promise.all([
    prisma.payrollRun.count({ where }),
    prisma.payrollRun.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
  ]);
  return { items, meta: paginationMeta(total, page, limit) };
}

export async function getPayrollRun(tenantId: string, id: string) {
  const run = await prisma.payrollRun.findFirst({
    where: { id, tenantId },
    include: {
      cycle: true,
      items: {
        include: {
          employee: { select: { id: true, employeeNumber: true, firstName: true, lastName: true, department: { select: { name: true } } } },
          earnings: true,
          deductions: true,
        },
      },
      approvals: { include: { approver: { select: { id: true, fullName: true } } }, orderBy: { level: "asc" } },
    },
  });
  if (!run) throw AppError.notFound("Payroll run not found.");
  return run;
}

export async function updatePayrollRun(
  tenantId: string,
  id: string,
  input: { name?: string; payDate?: Date },
  req: Request,
) {
  const run = await prisma.payrollRun.findFirst({ where: { id, tenantId } });
  if (!run) throw AppError.notFound("Payroll run not found.");
  if (run.status === "LOCKED") throw AppError.badRequest("Locked payroll cannot be edited.");

  const data: Prisma.PayrollRunUncheckedUpdateInput = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw AppError.badRequest("Name cannot be empty.");
    data.name = name;
  }
  if (input.payDate !== undefined) data.payDate = new Date(input.payDate);

  const updated = await prisma.payrollRun.update({ where: { id }, data });

  await recordAudit({
    req,
    action: "payroll.updated",
    module: "payroll",
    recordId: id,
    recordType: "PayrollRun",
    previous: { name: run.name, payDate: run.payDate },
    next: { name: updated.name, payDate: updated.payDate },
  });
  return updated;
}

export async function deletePayrollRun(tenantId: string, id: string, req: Request) {
  const run = await prisma.payrollRun.findFirst({ where: { id, tenantId } });
  if (!run) throw AppError.notFound("Payroll run not found.");
  if (run.status === "LOCKED") {
    throw AppError.badRequest("Locked payroll runs cannot be deleted.");
  }

  // Reverse loan/advance balances before deletion.
  const installments = await prisma.loanInstallment.findMany({ where: { tenantId, payrollRunId: id } });
  for (const inst of installments) {
    await prisma.employeeLoan.update({
      where: { id: inst.loanId },
      data: { remainingBalance: { increment: inst.amount }, status: "ACTIVE" },
    });
  }

  await prisma.payrollRun.delete({ where: { id } });

  await recordAudit({ req, action: "payroll.deleted", module: "payroll", recordId: id, recordType: "PayrollRun", previous: { name: run.name } });
}

export async function reviewPayroll(tenantId: string, id: string, req: Request) {
  const run = await getPayrollRun(tenantId, id);
  if (!["DRAFT", "CALCULATED"].includes(run.status)) throw AppError.badRequest("Payroll is not in a reviewable state.");
  const updated = await prisma.payrollRun.update({ where: { id }, data: { status: "PENDING_REVIEW" } });
  await recordAudit({ req, action: "payroll.review_requested", module: "payroll", recordId: id, recordType: "PayrollRun", previous: { status: run.status }, next: { status: "PENDING_REVIEW" } });
  return updated;
}

export async function approvePayroll(tenantId: string, id: string, remarks: string | undefined, req: Request) {
  const run = await getPayrollRun(tenantId, id);
  if (run.status !== "PENDING_REVIEW") throw AppError.badRequest("Payroll must be pending review before approval.");

  const updated = await prisma.$transaction(async (tx) => {
    await tx.payrollRun.update({
      where: { id },
      data: { status: "APPROVED" },
    });
    await tx.payrollApproval.create({
      data: {
        tenantId,
        payrollRunId: id,
        level: 1,
        approverId: req.user!.id,
        decision: "APPROVED",
        remarks,
        previousStatus: run.status,
        newStatus: "APPROVED",
        decidedAt: new Date(),
      },
    });
    return tx.payrollRun.findUniqueOrThrow({ where: { id } });
  });

  await recordAudit({ req, action: "payroll.approved", module: "payroll", recordId: id, recordType: "PayrollRun", previous: { status: run.status }, next: { status: "APPROVED" } });
  return updated;
}

export async function markPayrollPaid(tenantId: string, id: string, req: Request) {
  const run = await getPayrollRun(tenantId, id);
  if (run.status !== "APPROVED" && run.status !== "PROCESSING") {
    throw AppError.badRequest("Payroll must be approved before marking as paid.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.payrollRun.update({ where: { id }, data: { status: "PAID" } });
    await tx.payslip.updateMany({
      where: { payrollRunId: id, tenantId },
      data: { paymentStatus: "PAID", paymentDate: new Date() },
    });
    await tx.loanInstallment.updateMany({
      where: { payrollRunId: id, tenantId },
      data: { status: "PAID", paidDate: new Date() },
    });
  });

  await recordAudit({ req, action: "payroll.marked_paid", module: "payroll", recordId: id, recordType: "PayrollRun", previous: { status: run.status }, next: { status: "PAID" } });
  return getPayrollRun(tenantId, id);
}

export async function lockPayroll(tenantId: string, id: string, req: Request) {
  const run = await getPayrollRun(tenantId, id);
  if (run.status !== "PAID") throw AppError.badRequest("Only paid payroll can be locked.");
  const updated = await prisma.payrollRun.update({
    where: { id },
    data: { status: "LOCKED", lockedAt: new Date(), lockedById: req.user!.id },
  });
  await recordAudit({ req, action: "payroll.locked", module: "payroll", recordId: id, recordType: "PayrollRun", previous: { status: run.status }, next: { status: "LOCKED" } });
  return updated;
}

export async function unlockPayroll(tenantId: string, id: string, reason: string, req: Request) {
  const run = await getPayrollRun(tenantId, id);
  if (run.status !== "LOCKED") throw AppError.badRequest("Only locked payroll can be unlocked.");
  if (!reason?.trim()) throw AppError.badRequest("A reason is required to unlock payroll.");
  const updated = await prisma.payrollRun.update({
    where: { id },
    data: { status: "PAID", unlockReason: reason, lockedAt: null, lockedById: null },
  });
  await recordAudit({ req, action: "payroll.unlocked", module: "payroll", recordId: id, recordType: "PayrollRun", previous: { status: run.status }, next: { status: "PAID", reason } });
  return updated;
}

// ---- Payslips --------------------------------------------------------------

export async function generatePayslips(tenantId: string, payrollRunId: string, req: Request) {
  const run = await getPayrollRun(tenantId, payrollRunId);
  if (run.status !== "PAID") throw AppError.badRequest("Payslips can only be generated for paid payroll.");

  const items = await prisma.payrollItem.findMany({
    where: { tenantId, payrollRunId },
    include: { employee: true },
  });

  const payslips = [];
  for (const item of items) {
    const existing = await prisma.payslip.findUnique({ where: { payrollItemId: item.id } });
    if (existing) {
      payslips.push(existing);
      continue;
    }
    const payslip = await prisma.payslip.create({
      data: {
        tenantId,
        payrollItemId: item.id,
        payrollRunId,
        employeeId: item.employeeId,
        periodStart: run.periodStart,
        periodEnd: run.periodEnd,
        grossSalary: item.grossSalary,
        totalDeductions: item.totalDeductions,
        netSalary: item.netSalary,
        paymentStatus: "PAID",
        paymentDate: new Date(),
      },
    });
    payslips.push(payslip);
  }

  await recordAudit({ req, action: "payslips.generated", module: "payroll", recordId: payrollRunId, recordType: "PayrollRun", metadata: { count: payslips.length } });
  return payslips;
}

export async function listPayslips(
  tenantId: string,
  query: { page?: string; limit?: string; employeeId?: string; payrollRunId?: string },
) {
  const { page, limit, skip } = parsePagination(query);
  const where: Prisma.PayslipWhereInput = { tenantId };
  if (query.employeeId) where.employeeId = query.employeeId;
  if (query.payrollRunId) where.payrollRunId = query.payrollRunId;
  const [total, items] = await Promise.all([
    prisma.payslip.count({ where }),
    prisma.payslip.findMany({
      where,
      include: { employee: { select: { id: true, employeeNumber: true, firstName: true, lastName: true, department: { select: { name: true } }, designation: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
  ]);
  return { items, meta: paginationMeta(total, page, limit) };
}

export async function getPayslip(tenantId: string, id: string) {
  const payslip = await prisma.payslip.findFirst({
    where: { id, tenantId },
    include: {
      employee: { include: { department: true, designation: true, branch: true } },
      payrollItem: { include: { earnings: true, deductions: true } },
      payrollRun: true,
    },
  });
  if (!payslip) throw AppError.notFound("Payslip not found.");
  return payslip;
}

// ---- Helpers ---------------------------------------------------------------

async function summarizeAttendance(tenantId: string, employeeId: string, from: Date, to: Date) {
  const records = await prisma.attendance.findMany({
    where: { tenantId, employeeId, date: { gte: from, lte: to } },
    select: { status: true, lateMinutes: true, overtimeHours: true },
  });

  const summary = {
    presentDays: 0,
    absentDays: 0,
    lateMinutes: 0,
    overtimeHours: 0,
    paidLeaveDays: 0,
    unpaidLeaveDays: 0,
    workingDays: 22,
  };
  for (const r of records) {
    if (["PRESENT", "LATE", "HALF_DAY", "WORK_FROM_HOME"].includes(r.status)) summary.presentDays++;
    if (r.status === "ABSENT") summary.absentDays++;
    if (r.status === "PAID_LEAVE") summary.paidLeaveDays++;
    if (r.status === "UNPAID_LEAVE") summary.unpaidLeaveDays++;
    summary.lateMinutes += r.lateMinutes;
    summary.overtimeHours += r.overtimeHours.toNumber();
  }
  return summary;
}

// ---- Auto payslips (attendance-driven, no approval flow) ------------------
// Leave rule: no leave = full salary; more than 1 leave day = 500/day deducted.

export async function autoGeneratePayslips(tenantId: string, periodStart: Date, periodEnd: Date, req: Request) {
  const employees = await prisma.employee.findMany({
    where: { tenantId, status: { in: ["ACTIVE", "INACTIVE"] } },
    include: { salaryStructures: { where: { isActive: true }, take: 1, orderBy: { effectiveFrom: "desc" } } },
  });

  const monthLabel = `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, "0")}`;
  const name = `Auto ${monthLabel} Payslips`;

  // Remove a previous auto run for the same period so it can regenerate cleanly.
  const existing = await prisma.payrollRun.findFirst({ where: { tenantId, periodStart, periodEnd, name } });
  if (existing) {
    await prisma.payrollRun.delete({ where: { id: existing.id } });
  }

  const perDay = await getDeductionSetting(tenantId);

  const rows: Array<{
    employee: (typeof employees)[number];
    presentDays: number;
    absentDays: number;
    leaveDays: number;
    basic: number;
    leaveDeduction: number;
    net: number;
  }> = [];

  for (const emp of employees) {
    const structure = emp.salaryStructures[0];
    const att = await summarizeAttendance(tenantId, emp.id, periodStart, periodEnd);
    const leaveDays = att.absentDays + att.unpaidLeaveDays;
    const leaveDeduction = leaveDays * perDay;
    const basic = structure ? structure.basicSalary.toNumber() : emp.basicSalary.toNumber();
    const net = Math.max(0, basic - leaveDeduction);
    rows.push({
      employee: emp,
      presentDays: att.presentDays,
      absentDays: att.absentDays,
      leaveDays,
      basic,
      leaveDeduction,
      net,
    });
  }

  if (rows.length === 0) {
    throw AppError.badRequest("No employees with salary structures found.", "NO_EMPLOYEES");
  }

  const totalGross = rows.reduce((s, r) => s + r.basic, 0);
  const totalDeductions = rows.reduce((s, r) => s + r.leaveDeduction, 0);
  const totalNet = rows.reduce((s, r) => s + r.net, 0);

  const run = await prisma.$transaction(async (tx) => {
    const payrollRun = await tx.payrollRun.create({
      data: {
        tenantId,
        name,
        periodStart,
        periodEnd,
        payDate: new Date(),
        status: "PAID",
        totalGross: new Prisma.Decimal(totalGross),
        totalDeductions: new Prisma.Decimal(totalDeductions),
        totalNet: new Prisma.Decimal(totalNet),
        employeeCount: rows.length,
      },
    });

    for (const r of rows) {
      const item = await tx.payrollItem.create({
        data: {
          tenantId,
          payrollRunId: payrollRun.id,
          employeeId: r.employee.id,
          basicSalary: new Prisma.Decimal(r.basic),
          grossSalary: new Prisma.Decimal(r.basic),
          totalEarnings: new Prisma.Decimal(r.basic),
          totalDeductions: new Prisma.Decimal(r.leaveDeduction),
          netSalary: new Prisma.Decimal(r.net),
          presentDays: new Prisma.Decimal(r.presentDays),
          absentDays: new Prisma.Decimal(r.absentDays),
          unpaidLeaveDays: new Prisma.Decimal(r.leaveDays),
          snapshot: {},
        },
      });

      await tx.payslip.create({
        data: {
          tenantId,
          payrollItemId: item.id,
          payrollRunId: payrollRun.id,
          employeeId: r.employee.id,
          periodStart,
          periodEnd,
          grossSalary: new Prisma.Decimal(r.basic),
          totalDeductions: new Prisma.Decimal(r.leaveDeduction),
          netSalary: new Prisma.Decimal(r.net),
          paymentStatus: "PAID",
          paymentDate: new Date(),
        },
      });
    }

    return payrollRun;
  });

  await recordAudit({
    req,
    action: "payslips.auto_generated",
    module: "payroll",
    recordId: run.id,
    recordType: "PayrollRun",
    metadata: { employees: rows.length, totalNet },
  });

  return run;
}

export async function salaryOverview(tenantId: string) {
  const employees = await prisma.employee.findMany({
    where: { tenantId },
    include: { salaryStructures: { where: { isActive: true }, take: 1, orderBy: { effectiveFrom: "desc" } } },
    orderBy: { createdAt: "asc" },
  });

  const [totalPayslips, paidPayslips, pendingPayslips, netAgg] = await Promise.all([
    prisma.payslip.count({ where: { tenantId } }),
    prisma.payslip.count({ where: { tenantId, paymentStatus: "PAID" } }),
    prisma.payslip.count({ where: { tenantId, paymentStatus: { not: "PAID" } } }),
    prisma.payslip.aggregate({ where: { tenantId, paymentStatus: "PAID" }, _sum: { netSalary: true } }),
  ]);

  const items = employees.map((e) => ({
    id: e.id,
    employeeNumber: e.employeeNumber,
    firstName: e.firstName,
    lastName: e.lastName,
    nationalId: e.nationalId,
    basicSalary: e.salaryStructures[0]?.basicSalary ?? e.basicSalary,
    status: e.status,
  }));

  return {
    items,
    stats: {
      totalEmployees: employees.length,
      totalPayslips,
      paidPayslips,
      pendingPayslips,
      totalNetPaid: netAgg._sum.netSalary ?? 0,
    },
  };
}

export function salaryCsv(overview: Awaited<ReturnType<typeof salaryOverview>>): string {
  return toCsv(
    ["Employee Number", "First Name", "Last Name", "CNIC", "Basic Salary", "Status"],
    overview.items.map((e) => [
      e.employeeNumber,
      e.firstName,
      e.lastName,
      e.nationalId ?? "",
      e.basicSalary.toString(),
      e.status,
    ]),
  );
}

// ---- Attendance deduction setting ------------------------------------------

const DEDUCTION_KEY = "attendance.deduction_per_day";

export async function getDeductionSetting(tenantId: string): Promise<number> {
  const s = await prisma.tenantSetting.findUnique({ where: { tenantId_key: { tenantId, key: DEDUCTION_KEY } } });
  const amount = (s?.value as { amount?: number } | null)?.amount;
  return typeof amount === "number" ? amount : 500;
}

export async function setDeductionSetting(tenantId: string, amount: number): Promise<void> {
  await prisma.tenantSetting.upsert({
    where: { tenantId_key: { tenantId, key: DEDUCTION_KEY } },
    update: { value: { amount } },
    create: { tenantId, key: DEDUCTION_KEY, value: { amount } },
  });
}

export { PayrollStatus };
