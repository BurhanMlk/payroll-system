import { prisma } from "../../lib/prisma";
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from "../../utils/dates";
import { parsePagination, paginationMeta } from "../../lib/response";

export interface ReportFilters {
  from?: string;
  to?: string;
  branchId?: string;
  departmentId?: string;
  employeeId?: string;
  status?: string;
  year?: number;
  month?: number;
}

function dateRange(filters: ReportFilters, fallback = new Date()) {
  if (filters.year !== undefined && filters.month !== undefined) {
    const d = new Date(filters.year, filters.month - 1, 1);
    return { from: startOfMonth(d), to: endOfMonth(d) };
  }
  if (filters.from || filters.to) {
    return {
      from: filters.from ? startOfDay(new Date(filters.from)) : startOfDay(new Date(2000, 0, 1)),
      to: filters.to ? endOfDay(new Date(filters.to)) : endOfDay(fallback),
    };
  }
  return { from: startOfMonth(fallback), to: endOfMonth(fallback) };
}

export async function monthlyPayrollReport(tenantId: string, filters: ReportFilters) {
  const { from, to } = dateRange(filters);
  const where = {
    tenantId,
    payrollRun: { periodStart: { gte: from }, periodEnd: { lte: to } },
  };
  const items = await prisma.payrollItem.findMany({
    where,
    include: {
      employee: {
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          branchId: true,
          departmentId: true,
          branch: { select: { name: true } },
          department: { select: { name: true } },
        },
      },
      payrollRun: { select: { name: true, status: true, periodStart: true, periodEnd: true } },
    },
    orderBy: { employeeId: "asc" },
  });

  if (filters.branchId) return items.filter((i) => i.employee.branchId === filters.branchId);
  if (filters.departmentId) return items.filter((i) => i.employee.departmentId === filters.departmentId);
  return items;
}

export async function attendanceReport(tenantId: string, filters: ReportFilters, query: { page?: string; limit?: string }) {
  const { from, to } = dateRange(filters);
  const { page, limit, skip } = parsePagination(query);
  const where = {
    tenantId,
    date: { gte: from, lte: to },
    ...(filters.status ? { status: filters.status as never } : {}),
    ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
  };
  const [total, items] = await Promise.all([
    prisma.attendance.count({ where }),
    prisma.attendance.findMany({
      where,
      include: { employee: { select: { id: true, employeeNumber: true, firstName: true, lastName: true } } },
      orderBy: { date: "desc" },
      skip,
      take: limit,
    }),
  ]);
  return { items, meta: paginationMeta(total, page, limit) };
}

export async function leaveReport(tenantId: string, filters: ReportFilters, query: { page?: string; limit?: string }) {
  const { from, to } = dateRange(filters);
  const { page, limit, skip } = parsePagination(query);
  const where = {
    tenantId,
    startDate: { gte: from },
    endDate: { lte: to },
    ...(filters.status ? { status: filters.status as never } : {}),
  };
  const [total, items] = await Promise.all([
    prisma.leaveRequest.count({ where }),
    prisma.leaveRequest.findMany({
      where,
      include: {
        employee: { select: { id: true, employeeNumber: true, firstName: true, lastName: true } },
        leaveType: { select: { name: true, isPaid: true } },
      },
      orderBy: { startDate: "desc" },
      skip,
      take: limit,
    }),
  ]);
  return { items, meta: paginationMeta(total, page, limit) };
}

export async function loanReport(tenantId: string, filters: ReportFilters) {
  const loans = await prisma.employeeLoan.findMany({
    where: {
      tenantId,
      ...(filters.status ? { status: filters.status as never } : {}),
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
    },
    include: { employee: { select: { id: true, employeeNumber: true, firstName: true, lastName: true } } },
    orderBy: { createdAt: "desc" },
  });
  return loans;
}

export async function taxReport(tenantId: string, filters: ReportFilters) {
  const { from, to } = dateRange(filters);
  const items = await prisma.payrollItem.findMany({
    where: {
      tenantId,
      payrollRun: { periodStart: { gte: from }, periodEnd: { lte: to } },
    },
    include: {
      employee: { select: { id: true, employeeNumber: true, firstName: true, lastName: true } },
      payrollRun: { select: { name: true } },
    },
    orderBy: { employeeId: "asc" },
  });
  return items.filter((i) => i.taxAmount.toNumber() > 0);
}

export async function overtimeReport(tenantId: string, filters: ReportFilters) {
  const { from, to } = dateRange(filters);
  return prisma.attendance.findMany({
    where: { tenantId, date: { gte: from, lte: to }, overtimeHours: { gt: 0 } },
    include: { employee: { select: { id: true, employeeNumber: true, firstName: true, lastName: true } } },
    orderBy: { date: "desc" },
  });
}
