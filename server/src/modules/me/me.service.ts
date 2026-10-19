import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { dayjs, startOfDay, endOfDay } from "../../utils/dates";
import { requestLeave } from "../leave/leave.service";
import { Request } from "express";

export async function myProfile(tenantId: string, userId: string) {
  const employee = await prisma.employee.findFirst({
    where: { tenantId, userId },
    include: {
      branch: true,
      department: true,
      designation: true,
      salaryStructures: { where: { isActive: true }, take: 1, orderBy: { effectiveFrom: "desc" } },
    },
  });
  if (!employee) throw AppError.notFound("No employee profile is linked to this account.");
  return employee;
}

export async function myAttendance(tenantId: string, userId: string, month?: string) {
  const employee = await myProfile(tenantId, userId);
  const base = month ? new Date(month) : new Date();
  const from = new Date(base.getFullYear(), base.getMonth(), 1);
  const to = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59);
  return prisma.attendance.findMany({
    where: { tenantId, employeeId: employee.id, date: { gte: from, lte: to } },
    orderBy: { date: "asc" },
  });
}

export async function myPayslips(tenantId: string, userId: string) {
  const employee = await myProfile(tenantId, userId);
  return prisma.payslip.findMany({
    where: { tenantId, employeeId: employee.id },
    orderBy: { createdAt: "desc" },
  });
}

export async function myLeaveRequests(tenantId: string, userId: string) {
  const employee = await myProfile(tenantId, userId);
  return prisma.leaveRequest.findMany({
    where: { tenantId, employeeId: employee.id },
    include: { leaveType: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function myLeaveBalances(tenantId: string, userId: string) {
  const employee = await myProfile(tenantId, userId);
  return prisma.leaveBalance.findMany({
    where: { tenantId, employeeId: employee.id, year: dayjs().year() },
    include: { leaveType: true },
  });
}

export async function myLoans(tenantId: string, userId: string) {
  const employee = await myProfile(tenantId, userId);
  return prisma.employeeLoan.findMany({
    where: { tenantId, employeeId: employee.id },
    include: { installments: { orderBy: { dueDate: "desc" }, take: 12 } },
    orderBy: { createdAt: "desc" },
  });
}

export async function myRequestLeave(tenantId: string, userId: string, input: { leaveTypeId: string; startDate: Date; endDate: Date; reason?: string }, req: Request) {
  const employee = await myProfile(tenantId, userId);
  return requestLeave(tenantId, employee.id, input, req);
}

export async function updateMyProfile(tenantId: string, userId: string, input: { phone?: string; address?: string; emergencyContact?: string }) {
  const employee = await myProfile(tenantId, userId);
  return prisma.employee.update({ where: { id: employee.id }, data: input });
}
