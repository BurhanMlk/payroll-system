import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { parsePagination, paginationMeta } from "../../lib/response";
import { recordAudit } from "../../services/audit.service";
import { dayjs, startOfDay, endOfDay, isWeekend } from "../../utils/dates";
import { Request } from "express";

export interface LeaveTypeInput {
  name: string;
  code: string;
  annualQuota: number;
  isPaid: boolean;
  carryForward: boolean;
  maxCarryForward?: number;
  approvalRequired: boolean;
  isActive?: boolean;
}

// ---- Leave types -----------------------------------------------------------

export async function listLeaveTypes(tenantId: string) {
  return prisma.leaveType.findMany({ where: { tenantId }, orderBy: { name: "asc" } });
}

export async function createLeaveType(tenantId: string, input: LeaveTypeInput, req: Request) {
  const exists = await prisma.leaveType.findFirst({ where: { tenantId, code: input.code } });
  if (exists) throw AppError.conflict(`Leave type "${input.code}" already exists.`);
  const type = await prisma.leaveType.create({ data: { tenantId, ...input } });
  await recordAudit({ req, action: "leave_type.created", module: "leave", recordId: type.id, recordType: "LeaveType", next: input });
  return type;
}

export async function updateLeaveType(tenantId: string, id: string, input: Partial<LeaveTypeInput>, req: Request) {
  const existing = await prisma.leaveType.findFirst({ where: { id, tenantId } });
  if (!existing) throw AppError.notFound("Leave type not found.");
  const type = await prisma.leaveType.update({ where: { id }, data: input });
  await recordAudit({ req, action: "leave_type.updated", module: "leave", recordId: id, recordType: "LeaveType", previous: existing, next: input });
  return type;
}

export async function deleteLeaveType(tenantId: string, id: string, req: Request) {
  const existing = await prisma.leaveType.findFirst({ where: { id, tenantId } });
  if (!existing) throw AppError.notFound("Leave type not found.");
  const used = await prisma.leaveRequest.count({ where: { leaveTypeId: id, tenantId } });
  if (used > 0) throw AppError.badRequest("Cannot delete a leave type that has requests.");
  await prisma.leaveType.delete({ where: { id } });
  await recordAudit({ req, action: "leave_type.deleted", module: "leave", recordId: id, recordType: "LeaveType", previous: existing });
}

// ---- Leave requests --------------------------------------------------------

export async function requestLeave(
  tenantId: string,
  employeeId: string,
  input: { leaveTypeId: string; startDate: Date; endDate: Date; reason?: string },
  req: Request,
) {
  const employee = await prisma.employee.findFirst({ where: { id: employeeId, tenantId } });
  if (!employee) throw AppError.notFound("Employee not found.");
  const type = await prisma.leaveType.findFirst({ where: { id: input.leaveTypeId, tenantId } });
  if (!type) throw AppError.notFound("Leave type not found.");
  if (!type.isActive) throw AppError.badRequest("This leave type is not active.");

  if (dayjs(input.endDate).isBefore(dayjs(input.startDate))) {
    throw AppError.badRequest("End date must be after start date.");
  }

  const days = await computeLeaveDays(tenantId, input.startDate, input.endDate);
  if (days <= 0) throw AppError.badRequest("The requested period contains no working days.");

  // Quota validation for paid leave types with a quota.
  if (type.annualQuota > 0) {
    const balance = await getOrCreateBalance(tenantId, employeeId, type.id, dayjs(input.startDate).year());
    const remaining = balance.remaining.toNumber();
    if (days > remaining) {
      throw AppError.badRequest(`Insufficient leave balance. Remaining: ${remaining} day(s), requested: ${days}.`);
    }
  }

  const request = await prisma.leaveRequest.create({
    data: {
      tenantId,
      employeeId,
      leaveTypeId: type.id,
      startDate: startOfDay(input.startDate),
      endDate: endOfDay(input.endDate),
      days: new Prisma.Decimal(days),
      reason: input.reason,
      status: type.approvalRequired ? "PENDING" : "APPROVED",
      approvedAt: type.approvalRequired ? null : new Date(),
    },
  });

  // Auto-approve flow still updates balance + attendance.
  if (!type.approvalRequired) {
    await applyApprovedLeave(tenantId, request.id, req);
  }

  await recordAudit({
    req,
    action: "leave.requested",
    module: "leave",
    recordId: request.id,
    recordType: "LeaveRequest",
    metadata: { employeeId, leaveTypeId: type.id, days },
  });
  return request;
}

export async function deleteLeaveRequest(tenantId: string, id: string, req?: Request) {
  const existing = await prisma.leaveRequest.findFirst({ where: { id, tenantId } });
  if (!existing) throw AppError.notFound("Leave request not found.");
  if (existing.status === "APPROVED") throw AppError.badRequest("Approved leave requests cannot be deleted.");

  await prisma.leaveRequest.delete({ where: { id } });

  if (req) {
    await recordAudit({
      req,
      action: "leave.deleted",
      module: "leave",
      recordId: id,
      recordType: "LeaveRequest",
      previous: { status: existing.status, employeeId: existing.employeeId },
    });
  }
}

export async function listLeaveRequests(
  tenantId: string,
  query: { page?: string; limit?: string; status?: string; employeeId?: string; from?: string; to?: string },
) {
  const { page, limit, skip } = parsePagination(query);
  const where: Prisma.LeaveRequestWhereInput = { tenantId };
  if (query.status) where.status = query.status as Prisma.EnumLeaveStatusFilter["equals"];
  if (query.employeeId) where.employeeId = query.employeeId;
  if (query.from || query.to) {
    where.startDate = {
      gte: query.from ? startOfDay(new Date(query.from)) : undefined,
      lte: query.to ? endOfDay(new Date(query.to)) : undefined,
    };
  }
  const [total, items] = await Promise.all([
    prisma.leaveRequest.count({ where }),
    prisma.leaveRequest.findMany({
      where,
      include: {
        employee: { select: { id: true, employeeNumber: true, firstName: true, lastName: true } },
        leaveType: { select: { id: true, name: true, code: true, isPaid: true } },
        approver: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
  ]);
  return { items, meta: paginationMeta(total, page, limit) };
}

export async function decideLeave(
  tenantId: string,
  requestId: string,
  decision: "APPROVED" | "REJECTED",
  approverId: string,
  rejectionReason?: string,
  req?: Request,
) {
  const request = await prisma.leaveRequest.findFirst({ where: { id: requestId, tenantId } });
  if (!request) throw AppError.notFound("Leave request not found.");
  if (request.status !== "PENDING") throw AppError.badRequest("This request has already been processed.");

  const updated = await prisma.leaveRequest.update({
    where: { id: requestId },
    data: {
      status: decision,
      approverId,
      rejectionReason: decision === "REJECTED" ? rejectionReason : null,
      approvedAt: decision === "APPROVED" ? new Date() : null,
    },
  });

  if (decision === "APPROVED") {
    await applyApprovedLeave(tenantId, requestId, req);
  }

  if (req) {
    await recordAudit({
      req,
      action: `leave.${decision === "APPROVED" ? "approved" : "rejected"}`,
      module: "leave",
      recordId: requestId,
      recordType: "LeaveRequest",
      previous: { status: "PENDING" },
      next: { status: decision, rejectionReason },
    });
  }
  return updated;
}

/** Updates leave balance and attendance records for an approved request. */
async function applyApprovedLeave(tenantId: string, requestId: string, req?: Request) {
  const request = await prisma.leaveRequest.findFirst({
    where: { id: requestId, tenantId },
    include: { leaveType: true },
  });
  if (!request || request.status !== "APPROVED") return;

  const days = request.days.toNumber();
  const year = dayjs(request.startDate).year();
  await incrementBalance(tenantId, request.employeeId, request.leaveTypeId, year, days);

  // Update attendance for each working day in the range.
  const cursor = dayjs(request.startDate);
  const last = dayjs(request.endDate);
  const status = request.leaveType.isPaid ? "PAID_LEAVE" : "UNPAID_LEAVE";
  while (cursor.isBefore(last) || cursor.isSame(last, "day")) {
    const d = cursor.toDate();
    const holiday = await prisma.holiday.findFirst({
      where: { tenantId, date: { gte: startOfDay(d), lte: endOfDay(d) } },
    });
    if (!holiday && !isWeekend(d)) {
      await prisma.attendance.upsert({
        where: { tenantId_employeeId_date: { tenantId, employeeId: request.employeeId, date: startOfDay(d) } },
        update: { status },
        create: { tenantId, employeeId: request.employeeId, date: startOfDay(d), status, source: "MANUAL" },
      });
    }
    cursor.add(1, "day");
  }
}

async function computeLeaveDays(tenantId: string, startDate: Date, endDate: Date): Promise<number> {
  const holidays = await prisma.holiday.findMany({
    where: { tenantId, date: { gte: startOfDay(startDate), lte: endOfDay(endDate) } },
    select: { date: true },
  });
  const holidayDays = new Set(holidays.map((h) => dayjs(h.date).format("YYYY-MM-DD")));
  let days = 0;
  const cursor = dayjs(startDate);
  const last = dayjs(endDate);
  while (cursor.isBefore(last) || cursor.isSame(last, "day")) {
    const key = cursor.format("YYYY-MM-DD");
    if (!isWeekend(cursor.toDate()) && !holidayDays.has(key)) days++;
    cursor.add(1, "day");
  }
  return days;
}

async function getOrCreateBalance(tenantId: string, employeeId: string, leaveTypeId: string, year: number) {
  const existing = await prisma.leaveBalance.findUnique({
    where: { tenantId_employeeId_leaveTypeId_year: { tenantId, employeeId, leaveTypeId, year } },
  });
  if (existing) return existing;

  const type = await prisma.leaveType.findFirst({ where: { id: leaveTypeId, tenantId } });
  const quota = type?.annualQuota ?? 0;
  return prisma.leaveBalance.create({
    data: {
      tenantId,
      employeeId,
      leaveTypeId,
      year,
      totalQuota: new Prisma.Decimal(quota),
      usedDays: new Prisma.Decimal(0),
      carriedForward: new Prisma.Decimal(0),
      remaining: new Prisma.Decimal(quota),
    },
  });
}

async function incrementBalance(tenantId: string, employeeId: string, leaveTypeId: string, year: number, days: number) {
  const balance = await getOrCreateBalance(tenantId, employeeId, leaveTypeId, year);
  const used = balance.usedDays.plus(days);
  const remaining = balance.totalQuota.plus(balance.carriedForward).minus(used);
  await prisma.leaveBalance.update({
    where: { id: balance.id },
    data: {
      usedDays: used,
      remaining: remaining.gte(0) ? remaining : new Prisma.Decimal(0),
    },
  });
}

export async function getLeaveBalances(tenantId: string, employeeId: string, year?: number) {
  const y = year ?? dayjs().year();
  const balances = await prisma.leaveBalance.findMany({
    where: { tenantId, employeeId, year: y },
    include: { leaveType: true },
  });
  return balances;
}
