import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { recordAudit } from "../../services/audit.service";
import { Request } from "express";

export interface HolidayInput {
  name: string;
  date: Date;
  branchId?: string | null;
  isRecurring?: boolean;
}

export async function listHolidays(tenantId: string, year?: number) {
  const where: { tenantId: string; date?: { gte: Date; lte: Date } } = { tenantId };
  if (year) {
    where.date = { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31, 23, 59, 59) };
  }
  return prisma.holiday.findMany({
    where,
    include: { branch: { select: { id: true, name: true } } },
    orderBy: { date: "asc" },
  });
}

export async function createHoliday(tenantId: string, input: HolidayInput, req: Request) {
  const holiday = await prisma.holiday.create({
    data: {
      tenantId,
      name: input.name,
      date: new Date(input.date),
      branchId: input.branchId ?? null,
      isRecurring: input.isRecurring ?? false,
    },
  });
  await recordAudit({ req, action: "holiday.created", module: "attendance", recordId: holiday.id, recordType: "Holiday", next: input });
  return holiday;
}

export async function updateHoliday(tenantId: string, id: string, input: Partial<HolidayInput>, req: Request) {
  const existing = await prisma.holiday.findFirst({ where: { id, tenantId } });
  if (!existing) throw AppError.notFound("Holiday not found.");
  const data: { name?: string; date?: Date; branchId?: string | null; isRecurring?: boolean } = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.date !== undefined) data.date = new Date(input.date);
  if (input.branchId !== undefined) data.branchId = input.branchId ?? null;
  if (input.isRecurring !== undefined) data.isRecurring = input.isRecurring;
  const holiday = await prisma.holiday.update({ where: { id }, data });
  await recordAudit({ req, action: "holiday.updated", module: "attendance", recordId: id, recordType: "Holiday", previous: existing, next: input });
  return holiday;
}

export async function deleteHoliday(tenantId: string, id: string, req: Request) {
  const existing = await prisma.holiday.findFirst({ where: { id, tenantId } });
  if (!existing) throw AppError.notFound("Holiday not found.");
  await prisma.holiday.delete({ where: { id } });
  await recordAudit({ req, action: "holiday.deleted", module: "attendance", recordId: id, recordType: "Holiday", previous: existing });
}
