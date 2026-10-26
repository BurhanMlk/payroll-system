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

export async function attendanceSummary(tenantId: string, from: Date, to: Date) {
  const grouped = await prisma.attendance.groupBy({
    by: ["status"],
    where: { tenantId, date: { gte: startOfDay(from), lte: endOfDay(to) } },
    _count: { _all: true },
  });
  const summary: Record<string, number> = {};
  for (const g of grouped) summary[g.status] = g._count._all;
  return { from: startOfDay(from), to: endOfDay(to), summary };
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
  leaves?: number;
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
    PAID: "PAID_LEAVE",
    // Generic "leave" values in attendance CSVs are treated as deductible
    // unpaid leave so that the configured per-leave-day deduction applies.
    LEAVE: "UNPAID_LEAVE",
    LEAVES: "UNPAID_LEAVE",
    L: "UNPAID_LEAVE",
    UNPAID_LEAVE: "UNPAID_LEAVE",
    UNPAID: "UNPAID_LEAVE",
    HOLIDAY: "HOLIDAY",
    WEEKEND: "WEEKEND",
    WEEKLY_OFF: "WEEKEND",
    WEEKLYOFF: "WEEKEND",
    WEEK_OFF: "WEEKEND",
    OFF: "WEEKEND",
    WORK_FROM_HOME: "WORK_FROM_HOME",
    WFH: "WORK_FROM_HOME",
  };
  return map[s] ?? "PRESENT";
}

function parseLeavesCount(raw: string | undefined): number | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? Math.max(1, Math.round(n)) : 0;
  }
  if (/^(leave|leaves|l|yes|true|y)$/i.test(s)) return 1;
  return null;
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function normalizeHeader(s: string): string {
  return s.trim().toLowerCase().replace(/[\s_-]/g, "");
}

function colIndexFromRef(ref: string): number {
  const m = ref.match(/^([A-Z]+)\d+$/);
  if (!m) return -1;
  let idx = 0;
  for (const ch of m[1]) idx = idx * 26 + (ch.charCodeAt(0) - 64);
  return idx - 1;
}

async function parseXlsxRows(buffer: Buffer): Promise<string[][]> {
  const zip = await JSZip.loadAsync(buffer as unknown as ArrayBuffer);

  const shared: string[] = [];
  const sharedFile = zip.file("xl/sharedStrings.xml");
  if (sharedFile) {
    const xml = await sharedFile.async("string");
    for (const m of xml.matchAll(/<(?:x:)?si>([\s\S]*?)<\/(?:x:)?si>/g)) {
      const texts = [...m[1].matchAll(/<(?:x:)?t[^>]*>([\s\S]*?)<\/(?:x:)?t>/g)].map((t) => decodeXml(t[1])).join("");
      shared.push(texts);
    }
  }

  const sheet = zip.file("xl/worksheets/sheet1.xml");
  if (!sheet) return [];
  const xml = await sheet.async("string");

  const rows: string[][] = [];
  for (const rm of xml.matchAll(/<(?:x:)?row\b[^>]*>([\s\S]*?)<\/(?:x:)?row>/g)) {
    const rowXml = rm[1];
    const values: string[] = [];
    for (const cm of rowXml.matchAll(/<(?:x:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:x:)?c>)/g)) {
      const attrs = cm[1];
      const body = cm[2] ?? "";
      const refMatch = attrs.match(/\br="([A-Z]+\d+)"/);
      const colIdx = refMatch ? colIndexFromRef(refMatch[1]) : values.length;
      const tMatch = attrs.match(/\bt="([^"]*)"/);
      const type = tMatch ? tMatch[1] : undefined;
      let val = "";
      if (type === "inlineStr") {
        val = body.match(/<(?:x:)?t[^>]*>([\s\S]*?)<\/(?:x:)?t>/)?.[1] ?? "";
      } else if (type === "s") {
        const idx = parseInt(body.match(/<(?:x:)?v>([\s\S]*?)<\/(?:x:)?v>/)?.[1] ?? "0", 10) || 0;
        val = shared[idx] ?? "";
      } else {
        val = body.match(/<(?:x:)?v>([\s\S]*?)<\/(?:x:)?v>/)?.[1] ?? "";
      }
      if (colIdx >= 0) values[colIdx] = decodeXml(val).trim();
    }
    rows.push(values);
  }
  return rows;
}

function detectDelimiter(firstLine: string): string {
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const semiCount = (firstLine.match(/;/g) ?? []).length;
  const tabCount = (firstLine.match(/\t/g) ?? []).length;
  if (semiCount > commaCount && semiCount > tabCount) return ";";
  if (tabCount > commaCount && tabCount > semiCount) return "\t";
  return ",";
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function parseCsvRows(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const delimiter = detectDelimiter(lines[0]);
  return lines.map((line) => parseCsvLine(line, delimiter));
}

function findHeaderRowIndex(rows: string[][]): number {
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].map(normalizeHeader);
    const hasDate = cells.includes("date");
    const hasStatus = cells.includes("attendance") || cells.includes("status") || cells.includes("leaves");
    if (hasDate && hasStatus) return i;
  }
  return 0;
}

function extractEmployeeIdentifier(rows: string[][]): string {
  for (const row of rows) {
    for (const cell of row) {
      if (!cell) continue;
      const match =
        cell.match(/\bemployee\s*(?:id|no|number)\s*[:•\-]?\s*([A-Za-z0-9-]+)/i) ??
        cell.match(/\bemp\s*(?:id|no)\s*[:•\-]?\s*([A-Za-z0-9-]+)/i) ??
        cell.match(/\bcnic\s*[:•\-]?\s*([0-9-]+)/i);
      if (match) return match[1];
    }
  }
  return "";
}

function excelSerialToIso(serial: number): string {
  const ms = Math.round((serial - 25569) * 86400000);
  return new Date(ms).toISOString().slice(0, 10);
}

function normalizeDateCell(raw: string): string {
  const s = raw.trim();
  if (/^\d+(\.\d+)?$/.test(s)) {
    const serial = Number(s);
    if (serial > 20000 && serial < 80000) return excelSerialToIso(serial);
  }
  return s;
}

function buildImportedRows(rows: string[][]): ImportedRow[] {
  if (rows.length === 0) return [];
  const headerIndex = findHeaderRowIndex(rows);
  const header = rows[headerIndex].map(normalizeHeader);
  const col = (keys: string[]) => header.findIndex((h) => h && keys.includes(h));

  const empCol = col(["employeenumber", "employeeid", "empno", "cnic", "nationalid", "id"]);
  const dateCol = col(["date"]);
  const statusCol = col(["status", "attendance"]);
  const leavesCol = col(["leaves", "leavedays", "leavecount", "noofleaves", "totalleaves", "leave"]);
  const paidUnpaidCol = col(["paid/unpaid", "paidunpaid", "leavepaid", "leavetype"]);

  const fallbackEmployee = extractEmployeeIdentifier(rows);

  const result: ImportedRow[] = [];
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row.some((c) => c)) continue;

    const dateRaw = dateCol >= 0 ? (row[dateCol] ?? "") : "";
    const statusRaw = statusCol >= 0 ? (row[statusCol] ?? "") : "";
    const leavesRaw = leavesCol >= 0 ? (row[leavesCol] ?? "") : "";
    // Skip summary/total rows (e.g. "Attendance Summary") that carry no data.
    const normalizedDate = dateRaw.trim() ? normalizeDateCell(dateRaw) : "";
    const dateParsable = !normalizedDate || !Number.isNaN(new Date(normalizedDate).getTime());
    if (!dateParsable && !statusRaw.trim() && !leavesRaw.trim()) continue;

    let status = statusRaw;
    const paidUnpaid = paidUnpaidCol >= 0 ? (row[paidUnpaidCol] ?? "").toLowerCase() : "";
    const statusKey = status.trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (["leave", "leaves", "l", "unpaid_leave", "unpaid", "paid_leave", "paid"].includes(statusKey) && paidUnpaid) {
      status = paidUnpaid.includes("unpaid") ? "Unpaid Leave" : paidUnpaid.includes("paid") ? "Paid Leave" : status;
    }

    result.push({
      employeeNumber: empCol >= 0 ? (row[empCol] ?? "") : fallbackEmployee,
      date: dateCol >= 0 ? normalizedDate : "",
      status,
      leaves: parseLeavesCount(leavesRaw) ?? undefined,
    });
  }
  return result;
}

async function parseFile(file: Express.Multer.File): Promise<ImportedRow[]> {
  const name = file.originalname.toLowerCase();
  let rows: string[][] = [];

  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    try {
      rows = await parseXlsxRows(file.buffer);
    } catch {
      throw AppError.badRequest("Could not read this Excel file. Please use .xlsx or .csv format.", "INVALID_FILE");
    }
  } else {
    rows = parseCsvRows(file.buffer.toString("utf-8"));
  }

  return buildImportedRows(rows);
}

export async function importAttendanceFile(
  tenantId: string,
  file: Express.Multer.File,
  req: Request,
): Promise<{
  imported: number;
  failed: { employeeNumber: string; reason: string }[];
  periodStart: Date | null;
  periodEnd: Date | null;
}> {
  const rows = await parseFile(file);
  const failed: { employeeNumber: string; reason: string }[] = [];
  let imported = 0;
  let minDate: Date | null = null;
  let maxDate: Date | null = null;
  const fallbackDate = startOfDay(new Date());

  // Pre-fetch the tenant's employees once and match leniently: CSVs exported
  // from Excel often drop leading zeros (001 -> 1) or format CNICs with dashes.
  const employees = await prisma.employee.findMany({
    where: { tenantId },
    select: { id: true, employeeNumber: true, nationalId: true },
  });

  const findEmployee = (identifier: string) => {
    const digits = identifier.replace(/\D/g, "");
    return employees.find((e) => {
      if (e.employeeNumber === identifier || e.nationalId === identifier) return true;
      if (e.nationalId && digits && e.nationalId.replace(/\D/g, "") === digits) return true;
      if (/^\d+$/.test(identifier) && /^\d+$/.test(e.employeeNumber)) {
        if (String(Number(e.employeeNumber)) === String(Number(identifier))) return true;
      }
      return false;
    });
  };

  for (const row of rows) {
    const identifier = row.employeeNumber;
    if (!identifier) {
      failed.push({ employeeNumber: "", reason: "Missing employee number" });
      continue;
    }
    const employee = findEmployee(identifier);
    if (!employee) {
      failed.push({ employeeNumber: identifier, reason: "Employee not found" });
      continue;
    }
    const parsedDate = row.date ? new Date(row.date) : fallbackDate;
    const baseDate = Number.isNaN(parsedDate.getTime()) ? fallbackDate : startOfDay(parsedDate);
    const explicitStatus = row.status ? (normalizeStatus(row.status) as Prisma.EnumAttendanceStatusFilter["equals"]) : null;
    const leaveCount = row.leaves && row.leaves > 0 ? row.leaves : 0;

    const upsertAttendance = async (date: Date, status: Prisma.EnumAttendanceStatusFilter["equals"]) => {
      await prisma.attendance.upsert({
        where: { tenantId_employeeId_date: { tenantId, employeeId: employee.id, date } },
        update: { status, source: "CSV" },
        create: { tenantId, employeeId: employee.id, date, status, source: "CSV" },
      });
      imported++;
      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;
    };

    if (explicitStatus) {
      await upsertAttendance(baseDate, explicitStatus);
    } else if (leaveCount > 0) {
      // A numeric "Leaves" column represents whole leave days. Without a date
      // column, anchor the records going backwards from today so they fall
      // inside the payroll period that is auto-generated right after import.
      for (let i = 0; i < leaveCount; i++) {
        const leaveDate = row.date
          ? new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000)
          : new Date(baseDate.getTime() - i * 24 * 60 * 60 * 1000);
        await upsertAttendance(leaveDate, "UNPAID_LEAVE");
      }
    } else {
      await upsertAttendance(baseDate, "PRESENT");
    }
  }

  await recordAudit({
    req,
    action: "attendance.imported",
    module: "attendance",
    recordType: "Attendance",
    metadata: { imported, failed: failed.length },
  });

  return { imported, failed, periodStart: minDate, periodEnd: maxDate };
}
