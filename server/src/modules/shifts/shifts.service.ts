import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { recordAudit } from "../../services/audit.service";
import { Request } from "express";
import { Prisma } from "@prisma/client";

export interface ShiftInput {
  name: string;
  type: "MORNING" | "EVENING" | "NIGHT" | "CUSTOM";
  startTime: string;
  endTime: string;
  graceMinutes?: number;
  breakMinutes?: number;
  minHours?: number;
  overtimeAfter?: number;
  lateRule?: Prisma.InputJsonValue;
  isActive?: boolean;
}

export async function listShifts(tenantId: string) {
  return prisma.shift.findMany({ where: { tenantId }, orderBy: { name: "asc" } });
}

export async function createShift(tenantId: string, input: ShiftInput, req: Request) {
  const shift = await prisma.shift.create({ data: { tenantId, ...input, lateRule: input.lateRule as Prisma.InputJsonValue } });
  await recordAudit({ req, action: "shift.created", module: "attendance", recordId: shift.id, recordType: "Shift", next: input });
  return shift;
}

export async function updateShift(tenantId: string, id: string, input: Partial<ShiftInput>, req: Request) {
  const existing = await prisma.shift.findFirst({ where: { id, tenantId } });
  if (!existing) throw AppError.notFound("Shift not found.");
  const shift = await prisma.shift.update({ where: { id }, data: input });
  await recordAudit({ req, action: "shift.updated", module: "attendance", recordId: id, recordType: "Shift", previous: existing, next: input });
  return shift;
}

export async function deleteShift(tenantId: string, id: string, req: Request) {
  const existing = await prisma.shift.findFirst({ where: { id, tenantId } });
  if (!existing) throw AppError.notFound("Shift not found.");
  await prisma.shift.delete({ where: { id } });
  await recordAudit({ req, action: "shift.deleted", module: "attendance", recordId: id, recordType: "Shift", previous: existing });
}

export async function assignShiftToEmployee(tenantId: string, employeeId: string, shiftId: string, req: Request) {
  await prisma.employee.findFirstOrThrow({ where: { id: employeeId, tenantId } });
  await prisma.shift.findFirstOrThrow({ where: { id: shiftId, tenantId } });
  const assignment = await prisma.employeeShift.create({ data: { tenantId, employeeId, shiftId } });
  await recordAudit({ req, action: "shift.assigned", module: "attendance", recordId: assignment.id, recordType: "EmployeeShift", metadata: { employeeId, shiftId } });
  return assignment;
}
