import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { parsePagination, paginationMeta } from "../../lib/response";
import { recordAudit } from "../../services/audit.service";
import { startOfDay, endOfDay, isWeekend } from "../../utils/dates";
import { MarkAttendanceInput, UpdateAttendanceInput } from "./attendance.validator";
import { Request } from "express";
import JSZip from "jszip";

export async function markAttendance(tenantId: string, input: MarkAttendanceInput, req: Request) {
  await ensureEmployee(tenantId, input.employeeId);

  const date = startOfDay(input.date);
  let status = input.status;

  // Auto-recognize holidays and weekends.
  if (input.source === "MANUAL" || input.source === "CSV") {
    const holiday = await prisma.holiday.findFirst({
      where: { tenantId, date: { gte: startOfDay(date), lte: endOfDay(date) } },
    });
    if (holiday) status = "HOLIDAY";
    else if (isWeekend(date)) status = "WEEKEND";
  }

  const attendance = await prisma.attendance.upsert({
    where: { tenantId_employeeId_date: { tenantId, employeeId: input.employeeId, date } },
    update: {
      status,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      workHours: input.workHours !== undefined ? new Prisma.Decimal(input.workHours) : undefined,
      overtimeHours: new Prisma.Decimal(input.overtimeHours),
      lateMinutes: input.lateMinutes,
      earlyDepartureMinutes: input.earlyDepartureMinutes,
      source: input.source,
      notes: input.notes,
    },
    create: {
      tenantId,
      employeeId: input.employeeId,
      date,
      status,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      workHours: input.workHours !== undefined ? new Prisma.Decimal(input.workHours) : undefined,
      overtimeHours: new Prisma.Decimal(input.overtimeHours),
      lateMinutes: input.lateMinutes,
      earlyDepartureMinutes: input.earlyDepartureMinutes,
      source: input.source,
      notes: input.notes,
    },
  });

  await recordAudit({
    req,
    action: "attendance.marked",
    module: "attendance",
    recordId: attendance.id,
    recordType: "Attendance",
    metadata: { employeeId: input.employeeId, date, status },
  });

  return attendance;
}

export async function bulkMarkAttendance(
  tenantId: string,
  input: { date: Date; employeeIds: string[]; status: string; source: string },
  req: Request,
) {
  const date = startOfDay(input.date);
  const results: { employeeId: string; id: string }[] = [];

  for (const employeeId of input.employeeIds) {
    await ensureEmployee(tenantId, employeeId);
    const record = await prisma.attendance.upsert({
      where: { tenantId_employeeId_date: { tenantId, employeeId, date } },
      update: { status: input.status as Prisma.EnumAttendanceStatusFilter["equals"], source: input.source as Prisma.EnumAttendanceSourceFilter["equals"] },
      create: { tenantId, employeeId, date, status: input.status as Prisma.EnumAttendanceStatusFilter["equals"], source: input.source as Prisma.EnumAttendanceSourceFilter["equals"] },
    });
    results.push({ employeeId, id: record.id });
  }

  await recordAudit({
    req,
    action: "attendance.bulk_marked",
    module: "attendance",
    recordType: "Attendance",
    metadata: { date, count: results.length, status: input.status },
  });

  return results;
}

export async function updateAttendance(tenantId: string, id: string, input: UpdateAttendanceInput, req: Request) {
  const existing = await prisma.attendance.findFirst({ where: { id, tenantId } });
  if (!existing) throw AppError.notFound("Attendance record not found.");

  const data: Prisma.AttendanceUncheckedUpdateInput = {};
  if (input.status !== undefined) data.status = input.status;
  if (input.checkIn !== undefined) data.checkIn = input.checkIn;
  if (input.checkOut !== undefined) data.checkOut = input.checkOut;
  if (input.workHours !== undefined) data.workHours = new Prisma.Decimal(input.workHours);
  if (input.overtimeHours !== undefined) data.overtimeHours = new Prisma.Decimal(input.overtimeHours);
  if (input.lateMinutes !== undefined) data.lateMinutes = input.lateMinutes;
  if (input.earlyDepartureMinutes !== undefined) data.earlyDepartureMinutes = input.earlyDepartureMinutes;
  if (input.notes !== undefined) data.notes = input.notes;

  const updated = await prisma.attendance.update({ where: { id }, data });

  await recordAudit({
    req,
    action: "attendance.updated",
    module: "attendance",
    recordId: id,
    recordType: "Attendance",
    previous: { status: existing.status, lateMinutes: existing.lateMinutes },
    next: { status: updated.status, lateMinutes: updated.lateMinutes },
  });
  return updated;
}

export async function deleteAttendance(tenantId: string, id: string, req: Request) {
  const existing = await prisma.attendance.findFirst({ where: { id, tenantId } });
  if (!existing) throw AppError.notFound("Attendance record not found.");

  await prisma.attendance.delete({ where: { id } });

  await recordAudit({
    req,
    action: "attendance.deleted",
    module: "attendance",
    recordId: id,
    recordType: "Attendance",
    previous: { employeeId: existing.employeeId, date: existing.date, status: existing.status },
  });
}

export async function listAttendance(
  tenantId: string,
  query: {
    page?: string;
    limit?: string;
    date?: string;
    from?: string;
    to?: string;
    status?: string;
    branchId?: string;
    departmentId?: string;
    employeeId?: string;
  },
) {
  const { page, limit, skip } = parsePagination(query);

  const where: Prisma.AttendanceWhereInput = { tenantId };
  if (query.date) {
    const d = startOfDay(new Date(query.date));
    where.date = { gte: d, lte: endOfDay(d) };
  } else if (query.from || query.to) {
    where.date = {
      gte: query.from ? startOfDay(new Date(query.from)) : undefined,
      lte: query.to ? endOfDay(new Date(query.to)) : undefined,
    };
  }
  if (query.status) where.status = query.status as Prisma.EnumAttendanceStatusFilter["equals"];
  if (query.employeeId) where.employeeId = query.employeeId;

  const employeeWhere: Prisma.EmployeeWhereInput = {};
  if (query.branchId) employeeWhere.branchId = query.branchId;
  if (query.departmentId) employeeWhere.departmentId = query.departmentId;
  if (Object.keys(employeeWhere).length > 0) where.employee = employeeWhere;

  const [total, items] = await Promise.all([
    prisma.attendance.count({ where }),
    prisma.attendance.findMany({
      where,
      include: {
        employee: {
          select: { id: true, employeeNumber: true, firstName: true, lastName: true, branchId: true, departmentId: true },
        },
      },
      orderBy: { date: "desc" },
      skip,
      take: limit,
    }),
  ]);

  return { items, meta: paginationMeta(total, page, limit) };
}

export async function attendanceSummary(tenantId: string, date: Date) {
  const d = startOfDay(date);
  const grouped = await prisma.attendance.groupBy({
    by: ["status"],
    where: { tenantId, date: { gte: d, lte: endOfDay(d) } },
    _count: { _all: true },
  });
  const summary: Record<string, number> = {};
  for (const g of grouped) summary[g.status] = g._count._all;
  return { date: d, summary };
}

export async function employeeMonthlyAttendance(tenantId: string, employeeId: string, month: Date) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59);
  return prisma.attendance.findMany({
    where: { tenantId, employeeId, date: { gte: start, lte: end } },
    orderBy: { date: "asc" },
  });
}

async function ensureEmployee(tenantId: string, employeeId: string) {
  const employee = await prisma.employee.findFirst({ where: { id: employeeId, tenantId } });
  if (!employee) throw AppError.notFound("Employee not found.");
}

// ---- CSV / Excel attendance import ----------------------------------------

interface ImportedRow {
  employeeNumber: string;
  date: string;
  status: string;
}

function normalizeStatus(raw: string | undefined): string {
  const s = (raw ?? "PRESENT").trim().toUpperCase().replace(/[\s-]/g, "_");
  const map: Record<string, string> = {
    PRESENT: "PRESENT",
    P: "PRESENT",
    ABSENT: "ABSENT",
    A: "ABSENT",
    LATE: "LATE",
    HALF_DAY: "HALF_DAY",
    HALFDAY: "HALF_DAY",
    PAID_LEAVE: "PAID_LEAVE",
    LEAVE: "PAID_LEAVE",
    UNPAID_LEAVE: "UNPAID_LEAVE",
    UNPAID: "UNPAID_LEAVE",
    HOLIDAY: "HOLIDAY",
    WEEKEND: "WEEKEND",
    WORK_FROM_HOME: "WORK_FROM_HOME",
    WFH: "WORK_FROM_HOME",
  };
  return map[s] ?? "PRESENT";
}

function pickCell(row: Record<string, string>, keys: string[]): string {
  const normalized: Record<string, string> = {};
  for (const [header, value] of Object.entries(row)) {
    normalized[header.trim().toLowerCase().replace(/[\s_]/g, "")] = String(value ?? "").trim();
  }
  for (const k of keys) {
    if (normalized[k]) return normalized[k];
  }
  return "";
}

async function parseXlsx(buffer: Buffer): Promise<Record<string, string>[]> {
  const zip = await JSZip.loadAsync(buffer as unknown as ArrayBuffer);

  // Shared strings (some tools write text via a shared string table).
  const shared: string[] = [];
  const sharedFile = zip.file("xl/sharedStrings.xml");
  if (sharedFile) {
    const xml = await sharedFile.async("string");
    for (const m of xml.matchAll(/<si>(.*?)<\/si>/gs)) {
      const texts = [...m[1].matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map((t) => t[1]).join("");
      shared.push(texts);
    }
  }

  const sheet = zip.file("xl/worksheets/sheet1.xml");
  if (!sheet) return [];
  const xml = await sheet.async("string");

  const rows: Record<string, string>[] = [];
  const headerValues: string[] = [];
  let first = true;
  for (const rm of xml.matchAll(/<row[^>]*>(.*?)<\/row>/gs)) {
    const rowXml = rm[1];
    const values: string[] = [];
    for (const cm of rowXml.matchAll(/<c\s+([^>]*)>(.*?)<\/c>/gs)) {
      const attrs = cm[1];
      const body = cm[2];
      const tMatch = attrs.match(/t="([^"]*)"/);
      const type = tMatch ? tMatch[1] : undefined;
      let val = "";
      if (type === "inlineStr") {
        val = body.match(/<t[^>]*>(.*?)<\/t>/s)?.[1] ?? "";
      } else if (type === "s") {
        const idx = parseInt(body.match(/<v>(.*?)<\/v>/s)?.[1] ?? "0", 10) || 0;
        val = shared[idx] ?? "";
      } else {
        val = body.match(/<v>(.*?)<\/v>/s)?.[1] ?? "";
      }
      values.push(val);
    }
    if (first) {
      headerValues.push(...values);
      first = false;
    } else {
      const obj: Record<string, string> = {};
      headerValues.forEach((h, i) => { obj[h] = values[i] ?? ""; });
      rows.push(obj);
    }
  }
  return rows;
}

async function parseFile(file: Express.Multer.File): Promise<ImportedRow[]> {
  const name = file.originalname.toLowerCase();
  const rawRows: Record<string, string>[] = [];

  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    try {
      rawRows.push(...(await parseXlsx(file.buffer)));
    } catch {
      throw AppError.badRequest("Could not read this Excel file. Please use .xlsx or .csv format.", "INVALID_FILE");
    }
  } else {
    const text = file.buffer.toString("utf-8");
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return [];
    const headers = lines[0].split(",").map((h) => h.trim());
    for (const line of lines.slice(1)) {
      const cells = line.split(",").map((c) => c.trim());
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = cells[i] ?? ""; });
      rawRows.push(obj);
    }
  }

  return rawRows.map((r) => ({
    employeeNumber: pickCell(r, ["employeenumber", "employeeid", "empno", "cnic", "nationalid", "id"]),
    date: pickCell(r, ["date"]),
    status: pickCell(r, ["status", "attendance"]),
  }));
}

export async function importAttendanceFile(tenantId: string, file: Express.Multer.File, req: Request) {
  const rows = await parseFile(file);
  const failed: { employeeNumber: string; reason: string }[] = [];
  let imported = 0;
  const fallbackDate = startOfDay(new Date());

  for (const row of rows) {
    const identifier = row.employeeNumber;
    if (!identifier) {
      failed.push({ employeeNumber: "", reason: "Missing employee number" });
      continue;
    }
    const employee = await prisma.employee.findFirst({
      where: { tenantId, OR: [{ employeeNumber: identifier }, { nationalId: identifier }] },
    });
    if (!employee) {
      failed.push({ employeeNumber: identifier, reason: "Employee not found" });
      continue;
    }
    const parsedDate = row.date ? new Date(row.date) : fallbackDate;
    const date = Number.isNaN(parsedDate.getTime()) ? fallbackDate : startOfDay(parsedDate);
    const status = normalizeStatus(row.status) as Prisma.EnumAttendanceStatusFilter["equals"];
    await prisma.attendance.upsert({
      where: { tenantId_employeeId_date: { tenantId, employeeId: employee.id, date } },
      update: { status, source: "CSV" },
      create: { tenantId, employeeId: employee.id, date, status, source: "CSV" },
    });
    imported++;
  }

  await recordAudit({
    req,
    action: "attendance.imported",
    module: "attendance",
    recordType: "Attendance",
    metadata: { imported, failed: failed.length },
  });

  return { imported, failed };
}
