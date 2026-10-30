import { Prisma, AttendanceStatus } from "@prisma/client";
import ExcelJS from "exceljs";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { parsePagination, paginationMeta } from "../../lib/response";
import { recordAudit } from "../../services/audit.service";
import { StudentCreateInput, StudentUpdateInput } from "./students.validator";
import { Request } from "express";

export interface StudentListQuery {
  page?: string;
  limit?: string;
  search?: string;
  className?: string;
  section?: string;
  status?: string;
  branchId?: string;
}

async function generateRollNumber(tenantId: string, className?: string): Promise<string> {
  const count = await prisma.student.count({ where: { tenantId } });
  let num = count + 1;
  let roll = `STU-${String(num).padStart(4, "0")}`;
  while (await prisma.student.findFirst({ where: { tenantId, rollNumber: roll } })) {
    num++;
    roll = `STU-${String(num).padStart(4, "0")}`;
  }
  return roll;
}

export async function listStudents(tenantId: string, query: StudentListQuery) {
  const { page, limit, skip } = parsePagination({ page: query.page, limit: query.limit });

  const where: Prisma.StudentWhereInput = { tenantId };
  if (query.search) {
    const s = query.search.trim();
    where.OR = [
      { fullName: { contains: s, mode: "insensitive" } },
      { fatherName: { contains: s, mode: "insensitive" } },
      { rollNumber: { contains: s, mode: "insensitive" } },
      { nationalId: { contains: s, mode: "insensitive" } },
      { phone: { contains: s, mode: "insensitive" } },
    ];
  }
  if (query.className) where.className = query.className;
  if (query.section) where.section = query.section;
  if (query.status) where.status = query.status;
  if (query.branchId) where.branchId = query.branchId;

  const [total, items] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      include: { branch: true },
      orderBy: [{ className: "asc" }, { rollNumber: "asc" }],
      skip,
      take: limit,
    }),
  ]);

  return { items, meta: paginationMeta(total, page, limit) };
}

export async function getStudent(tenantId: string, id: string) {
  const student = await prisma.student.findFirst({
    where: { id, tenantId },
    include: {
      branch: true,
      fees: { orderBy: { month: "desc" }, take: 24 },
      attendances: { orderBy: { date: "desc" }, take: 60 },
    },
  });
  if (!student) throw AppError.notFound("Student not found.");
  return student;
}

export async function createStudent(tenantId: string, input: StudentCreateInput, req: Request) {
  const rollNumber = input.rollNumber?.trim() || (await generateRollNumber(tenantId, input.className));

  const existingRoll = await prisma.student.findFirst({ where: { tenantId, rollNumber } });
  if (existingRoll) throw AppError.conflict(`Roll number "${rollNumber}" already exists.`);

  const student = await prisma.student.create({
    data: {
      tenantId,
      rollNumber,
      fullName: input.fullName.trim(),
      fatherName: input.fatherName.trim(),
      nationalId: input.nationalId.trim(),
      className: input.className.trim(),
      section: input.section?.trim() || null,
      monthlyFee: new Prisma.Decimal(input.monthlyFee || 0),
      phone: input.phone || null,
      email: input.email || null,
      gender: input.gender || null,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
      address: input.address || null,
      branchId: input.branchId || null,
      status: "ACTIVE",
    },
    include: { branch: true },
  });

  await recordAudit({
    req,
    action: "student.created",
    module: "student",
    recordId: student.id,
    recordType: "Student",
    next: { id: student.id, rollNumber: student.rollNumber, name: student.fullName },
  });

  return student;
}

export async function updateStudent(tenantId: string, id: string, input: StudentUpdateInput, req: Request) {
  const existing = await prisma.student.findFirst({ where: { id, tenantId } });
  if (!existing) throw AppError.notFound("Student not found.");

  if (input.rollNumber && input.rollNumber !== existing.rollNumber) {
    const dup = await prisma.student.findFirst({
      where: { tenantId, rollNumber: input.rollNumber, NOT: { id } },
    });
    if (dup) throw AppError.conflict(`Roll number "${input.rollNumber}" already exists.`);
  }

  const data: Prisma.StudentUncheckedUpdateInput = {
    ...input,
    rollNumber: input.rollNumber || undefined,
    monthlyFee: input.monthlyFee !== undefined ? new Prisma.Decimal(input.monthlyFee) : undefined,
    dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
  };

  const updated = await prisma.student.update({
    where: { id },
    data,
    include: { branch: true },
  });

  await recordAudit({
    req,
    action: "student.updated",
    module: "student",
    recordId: updated.id,
    recordType: "Student",
    previous: { id: existing.id, rollNumber: existing.rollNumber },
    next: { id: updated.id, rollNumber: updated.rollNumber },
  });

  return updated;
}

export async function deleteStudent(tenantId: string, id: string, req: Request) {
  const existing = await prisma.student.findFirst({ where: { id, tenantId } });
  if (!existing) throw AppError.notFound("Student not found.");

  await prisma.student.delete({ where: { id } });

  await recordAudit({
    req,
    action: "student.deleted",
    module: "student",
    recordId: id,
    recordType: "Student",
    previous: { id: existing.id, rollNumber: existing.rollNumber, fullName: existing.fullName },
  });
}

// ----------------------------------------------------------------------------
// BULK STUDENT IMPORT & TEMPLATE
// ----------------------------------------------------------------------------

export async function generateStudentTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Students Template");
  sheet.columns = [
    { header: "Roll Number", key: "rollNumber", width: 15 },
    { header: "Student Name", key: "fullName", width: 20 },
    { header: "Father Name", key: "fatherName", width: 20 },
    { header: "B-Form / CNIC", key: "nationalId", width: 18 },
    { header: "Class", key: "className", width: 15 },
    { header: "Section", key: "section", width: 10 },
    { header: "Monthly Fee", key: "monthlyFee", width: 15 },
    { header: "Phone / Contact", key: "phone", width: 18 },
    { header: "Gender", key: "gender", width: 12 },
    { header: "Date of Birth", key: "dateOfBirth", width: 15 },
    { header: "Address", key: "address", width: 25 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.addRow({
    rollNumber: "STU-0001",
    fullName: "Muhammad Hamza",
    fatherName: "Tariq Mahmood",
    nationalId: "35201-1122334-1",
    className: "Class 9",
    section: "A",
    monthlyFee: 5000,
    phone: "0300-1122334",
    gender: "MALE",
    dateOfBirth: "2010-04-15",
    address: "Model Town, Lahore",
  });
  sheet.addRow({
    rollNumber: "STU-0002",
    fullName: "Ayesha Bibi",
    fatherName: "Muhammad Asif",
    nationalId: "35202-9988776-2",
    className: "Class 10",
    section: "B",
    monthlyFee: 5500,
    phone: "0321-9988776",
    gender: "FEMALE",
    dateOfBirth: "2009-08-20",
    address: "Johar Town, Lahore",
  });
  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
}

function normalizeHeaderKey(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseCellString(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "object" && val !== null && "text" in val) {
    return String((val as { text: string }).text).trim();
  }
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10);
  }
  return String(val).trim();
}

export async function importStudentsFile(
  tenantId: string,
  file: Express.Multer.File,
  req: Request,
): Promise<{ imported: number; failed: { row: number; name?: string; reason: string }[] }> {
  let rows: string[][] = [];
  const fileName = file.originalname.toLowerCase();

  if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as never);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw AppError.badRequest("Uploaded workbook has no worksheets.");
    worksheet.eachRow((row) => {
      const values: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        values[colNumber - 1] = parseCellString(cell.value);
      });
      rows.push(values);
    });
  } else {
    const text = file.buffer.toString("utf-8").replace(/^\uFEFF/, "");
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    rows = lines.map((line) => {
      const delimiter = line.includes(";") ? ";" : line.includes("\t") ? "\t" : ",";
      return line.split(delimiter).map((c) => c.replace(/^["']|["']$/g, "").trim());
    });
  }

  if (rows.length < 2) {
    throw AppError.badRequest("File must contain a header row and at least one data row.");
  }

  const rawHeaders = rows[0];
  const headers = rawHeaders.map(normalizeHeaderKey);
  const col = (candidates: string[]) => headers.findIndex((h) => candidates.includes(h));

  const rollCol = col(["rollnumber", "rollno", "roll", "studentid"]);
  const nameCol = col(["studentname", "fullname", "name"]);
  const fatherCol = col(["fathername", "father", "guardian"]);
  const bformCol = col(["bform", "cnic", "nationalid", "bformcnic", "nic"]);
  const classCol = col(["class", "classname", "grade"]);
  const sectionCol = col(["section", "sec"]);
  const feeCol = col(["monthlyfee", "fee", "tuitionfee"]);
  const phoneCol = col(["phone", "contact", "mobile", "guardianphone"]);
  const genderCol = col(["gender", "sex"]);
  const dobCol = col(["dateofbirth", "dob"]);
  const addressCol = col(["address"]);

  const failed: { row: number; name?: string; reason: string }[] = [];
  let imported = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0 || r.every((c) => !c)) continue;
    const rowNumber = i + 1;

    const fullName = nameCol >= 0 ? r[nameCol]?.trim() : "";
    const fatherName = fatherCol >= 0 ? r[fatherCol]?.trim() : "";
    const nationalId = bformCol >= 0 ? r[bformCol]?.trim() : "";
    const className = classCol >= 0 ? r[classCol]?.trim() : "";

    if (!fullName || !fatherName || !nationalId || !className) {
      failed.push({
        row: rowNumber,
        name: fullName || "Row " + rowNumber,
        reason: "Name, Father Name, B-Form/CNIC, and Class are required fields.",
      });
      continue;
    }

    let rollNumber = rollCol >= 0 && r[rollCol]?.trim() ? r[rollCol]?.trim() : await generateRollNumber(tenantId, className);

    // If roll number exists, generate unique
    if (await prisma.student.findFirst({ where: { tenantId, rollNumber } })) {
      rollNumber = await generateRollNumber(tenantId, className);
    }

    const section = sectionCol >= 0 && r[sectionCol]?.trim() ? r[sectionCol]?.trim() : null;
    const rawFee = feeCol >= 0 ? r[feeCol]?.replace(/[^0-9.]/g, "") : "0";
    const monthlyFee = parseFloat(rawFee || "0") || 0;
    const phone = phoneCol >= 0 ? r[phoneCol]?.trim() || null : null;
    const address = addressCol >= 0 ? r[addressCol]?.trim() || null : null;
    const rawGender = genderCol >= 0 ? (r[genderCol] ?? "").toUpperCase() : null;
    const gender = ["MALE", "FEMALE", "OTHER"].includes(rawGender ?? "") ? (rawGender as never) : null;

    let dateOfBirth: Date | null = null;
    if (dobCol >= 0 && r[dobCol]) {
      const d = new Date(r[dobCol]);
      if (!Number.isNaN(d.getTime())) dateOfBirth = d;
    }

    try {
      await prisma.student.create({
        data: {
          tenantId,
          rollNumber,
          fullName,
          fatherName,
          nationalId,
          className,
          section,
          monthlyFee: new Prisma.Decimal(monthlyFee),
          phone,
          address,
          gender,
          dateOfBirth,
          status: "ACTIVE",
        },
      });
      imported++;
    } catch (err: unknown) {
      failed.push({
        row: rowNumber,
        name: fullName,
        reason: err instanceof Error ? err.message : "Failed to insert student.",
      });
    }
  }

  await recordAudit({
    req,
    action: "student.bulk_import",
    module: "student",
    recordId: tenantId,
    recordType: "Tenant",
    next: { imported, failedCount: failed.length },
  });

  return { imported, failed };
}

// ----------------------------------------------------------------------------
// STUDENT ATTENDANCE
// ----------------------------------------------------------------------------

export async function getStudentAttendance(
  tenantId: string,
  params: { date: string; className?: string; section?: string },
) {
  const d = new Date(params.date);
  if (Number.isNaN(d.getTime())) throw AppError.badRequest("Invalid date.");
  d.setUTCHours(0, 0, 0, 0);

  const studentWhere: Prisma.StudentWhereInput = { tenantId, status: "ACTIVE" };
  if (params.className) studentWhere.className = params.className;
  if (params.section) studentWhere.section = params.section;

  const students = await prisma.student.findMany({
    where: studentWhere,
    orderBy: [{ className: "asc" }, { rollNumber: "asc" }],
  });

  const attendances = await prisma.studentAttendance.findMany({
    where: {
      tenantId,
      date: d,
      studentId: { in: students.map((s) => s.id) },
    },
  });

  const attMap = new Map(attendances.map((a) => [a.studentId, a]));

  return students.map((s) => {
    const att = attMap.get(s.id);
    return {
      studentId: s.id,
      rollNumber: s.rollNumber,
      fullName: s.fullName,
      fatherName: s.fatherName,
      className: s.className,
      section: s.section,
      status: att?.status ?? "PRESENT",
      remarks: att?.remarks ?? "",
      recorded: !!att,
    };
  });
}

export async function markStudentAttendance(
  tenantId: string,
  dateStr: string,
  records: { studentId: string; status: AttendanceStatus; remarks?: string | null }[],
  req: Request,
) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) throw AppError.badRequest("Invalid date.");
  d.setUTCHours(0, 0, 0, 0);

  let updatedCount = 0;
  for (const rec of records) {
    let st: AttendanceStatus = "PRESENT";
    if (rec.status === "ABSENT") st = "ABSENT";
    else if (rec.status === "LATE") st = "LATE";
    else if (rec.status === "HALF_DAY") st = "HALF_DAY";
    else if ((rec.status as string) === "LEAVE" || (rec.status as string) === "PAID_LEAVE") st = "PAID_LEAVE";
    else if ((rec.status as string) === "UNPAID_LEAVE") st = "UNPAID_LEAVE";

    await prisma.studentAttendance.upsert({
      where: {
        tenantId_studentId_date: {
          tenantId,
          studentId: rec.studentId,
          date: d,
        },
      },
      update: {
        status: st,
        remarks: rec.remarks || null,
      },
      create: {
        tenantId,
        studentId: rec.studentId,
        date: d,
        status: st,
        remarks: rec.remarks || null,
      },
    });
    updatedCount++;
  }

  await recordAudit({
    req,
    action: "student.attendance_marked",
    module: "student",
    recordId: tenantId,
    recordType: "Tenant",
    next: { date: dateStr, count: updatedCount },
  });

  return { success: true, count: updatedCount };
}

export async function generateStudentAttendanceTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Attendance Template");
  sheet.columns = [
    { header: "Roll Number", key: "rollNumber", width: 16 },
    { header: "Date (YYYY-MM-DD)", key: "date", width: 20 },
    { header: "Status (PRESENT/ABSENT/LATE/LEAVE)", key: "status", width: 30 },
    { header: "Remarks", key: "remarks", width: 25 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.addRow({
    rollNumber: "STU-0001",
    date: new Date().toISOString().slice(0, 10),
    status: "PRESENT",
    remarks: "On time",
  });
  sheet.addRow({
    rollNumber: "STU-0002",
    date: new Date().toISOString().slice(0, 10),
    status: "ABSENT",
    remarks: "Unexcused",
  });
  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
}

export async function importStudentAttendanceFile(
  tenantId: string,
  file: Express.Multer.File,
  req: Request,
) {
  let rows: string[][] = [];
  const fileName = file.originalname.toLowerCase();

  if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as never);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw AppError.badRequest("Workbook has no sheets.");
    worksheet.eachRow((row) => {
      const vals: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, idx) => {
        vals[idx - 1] = parseCellString(cell.value);
      });
      rows.push(vals);
    });
  } else {
    const lines = file.buffer.toString("utf-8").replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim().length > 0);
    rows = lines.map((l) => l.split(",").map((c) => c.replace(/^["']|["']$/g, "").trim()));
  }

  if (rows.length < 2) throw AppError.badRequest("File must have header and data rows.");

  const headers = rows[0].map(normalizeHeaderKey);
  const col = (candidates: string[]) => headers.findIndex((h) => candidates.includes(h));
  const rollCol = col(["rollnumber", "rollno", "roll", "bform", "cnic"]);
  const dateCol = col(["date", "attendance", "attendancedate"]);
  const statusCol = col(["status", "attendancestatus"]);
  const remarksCol = col(["remarks", "notes"]);

  let imported = 0;
  const failed: { row: number; reason: string }[] = [];

  const students = await prisma.student.findMany({
    where: { tenantId },
    select: { id: true, rollNumber: true, nationalId: true },
  });
  const studentMap = new Map<string, string>();
  for (const s of students) {
    studentMap.set(s.rollNumber.toLowerCase(), s.id);
    if (s.nationalId) studentMap.set(s.nationalId.toLowerCase().replace(/[^a-z0-9]/g, ""), s.id);
  }

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0 || r.every((c) => !c)) continue;
    const rowNum = i + 1;

    const roll = rollCol >= 0 ? r[rollCol]?.trim() : "";
    const cleanRoll = roll.toLowerCase().replace(/[^a-z0-9]/g, "");
    const studentId = studentMap.get(roll.toLowerCase()) || studentMap.get(cleanRoll);

    if (!studentId) {
      failed.push({ row: rowNum, reason: `Student "${roll}" not found.` });
      continue;
    }

    const rawDate = dateCol >= 0 ? r[dateCol]?.trim() : "";
    const d = new Date(rawDate || new Date().toISOString().slice(0, 10));
    if (Number.isNaN(d.getTime())) {
      failed.push({ row: rowNum, reason: `Invalid date "${rawDate}".` });
      continue;
    }
    d.setUTCHours(0, 0, 0, 0);

    const rawStatus = (statusCol >= 0 ? r[statusCol]?.trim() : "PRESENT").toUpperCase();
    let status: AttendanceStatus = "PRESENT";
    if (rawStatus === "ABSENT") status = "ABSENT";
    else if (rawStatus === "LATE") status = "LATE";
    else if (rawStatus === "HALF_DAY") status = "HALF_DAY";
    else if (rawStatus === "LEAVE" || rawStatus === "PAID_LEAVE") status = "PAID_LEAVE";
    else if (rawStatus === "UNPAID_LEAVE") status = "UNPAID_LEAVE";
    const remarks = remarksCol >= 0 ? r[remarksCol]?.trim() : null;

    try {
      await prisma.studentAttendance.upsert({
        where: {
          tenantId_studentId_date: {
            tenantId,
            studentId,
            date: d,
          },
        },
        update: { status, remarks },
        create: { tenantId, studentId, date: d, status, remarks },
      });
      imported++;
    } catch {
      failed.push({ row: rowNum, reason: "Database update error." });
    }
  }

  return { imported, failed };
}

// ----------------------------------------------------------------------------
// STUDENT FEES
// ----------------------------------------------------------------------------

export async function getStudentFees(
  tenantId: string,
  params: {
    month: string;
    className?: string;
    section?: string;
    status?: string;
    search?: string;
    page?: string;
    limit?: string;
  },
) {
  const { page, limit, skip } = parsePagination({ page: params.page, limit: params.limit });
  const month = params.month; // e.g. "2026-10"

  // Base student filter
  const studentWhere: Prisma.StudentWhereInput = { tenantId };
  if (params.className) studentWhere.className = params.className;
  if (params.section) studentWhere.section = params.section;
  if (params.search) {
    const s = params.search.trim();
    studentWhere.OR = [
      { fullName: { contains: s, mode: "insensitive" } },
      { fatherName: { contains: s, mode: "insensitive" } },
      { rollNumber: { contains: s, mode: "insensitive" } },
      { nationalId: { contains: s, mode: "insensitive" } },
    ];
  }

  const where: Prisma.StudentFeeWhereInput = {
    tenantId,
    month,
    student: studentWhere,
  };
  if (params.status) where.status = params.status;

  // Compute metrics across entire tenant for the month
  const [allStudentsCount, monthFees] = await Promise.all([
    prisma.student.count({ where: { tenantId, status: "ACTIVE" } }),
    prisma.studentFee.findMany({
      where: { tenantId, month },
      select: { feeAmount: true, paidAmount: true, dueAmount: true, status: true },
    }),
  ]);

  let totalExpectedFee = 0;
  let totalCollectedFee = 0;
  let totalPendingDues = 0;

  for (const f of monthFees) {
    totalExpectedFee += Number(f.feeAmount);
    totalCollectedFee += Number(f.paidAmount);
    totalPendingDues += Number(f.dueAmount);
  }

  const [total, items] = await Promise.all([
    prisma.studentFee.count({ where }),
    prisma.studentFee.findMany({
      where,
      include: { student: { include: { branch: true } } },
      orderBy: [{ student: { className: "asc" } }, { student: { rollNumber: "asc" } }],
      skip,
      take: limit,
    }),
  ]);

  return {
    items,
    summary: {
      totalStudents: allStudentsCount,
      totalExpectedFee,
      totalCollectedFee,
      totalPendingDues,
    },
    meta: paginationMeta(total, page, limit),
  };
}

export async function generateMonthlyFees(
  tenantId: string,
  params: { month: string; className?: string; section?: string },
  req: Request,
) {
  const month = params.month;
  const where: Prisma.StudentWhereInput = { tenantId, status: "ACTIVE" };
  if (params.className) where.className = params.className;
  if (params.section) where.section = params.section;

  const students = await prisma.student.findMany({ where });
  let generated = 0;

  for (const s of students) {
    const feeAmount = Number(s.monthlyFee || 0);
    const existing = await prisma.studentFee.findUnique({
      where: {
        tenantId_studentId_month: {
          tenantId,
          studentId: s.id,
          month,
        },
      },
    });

    if (!existing) {
      await prisma.studentFee.create({
        data: {
          tenantId,
          studentId: s.id,
          month,
          feeAmount: new Prisma.Decimal(feeAmount),
          paidAmount: new Prisma.Decimal(0),
          dueAmount: new Prisma.Decimal(feeAmount),
          status: feeAmount === 0 ? "PAID" : "PENDING",
        },
      });
      generated++;
    }
  }

  await recordAudit({
    req,
    action: "student.fees_generated",
    module: "student",
    recordId: tenantId,
    recordType: "Tenant",
    next: { month, count: generated },
  });

  return { generated, totalEligible: students.length };
}

export async function payStudentFee(
  tenantId: string,
  params: {
    studentId: string;
    month: string;
    paidAmount: number;
    paymentMethod?: string;
    receiptNumber?: string | null;
    notes?: string | null;
  },
  req: Request,
) {
  const student = await prisma.student.findFirst({
    where: { id: params.studentId, tenantId },
  });
  if (!student) throw AppError.notFound("Student not found.");

  let feeRecord = await prisma.studentFee.findUnique({
    where: {
      tenantId_studentId_month: {
        tenantId,
        studentId: params.studentId,
        month: params.month,
      },
    },
  });

  if (!feeRecord) {
    // Auto-create fee record if paying first
    const feeAmount = Number(student.monthlyFee || 0);
    feeRecord = await prisma.studentFee.create({
      data: {
        tenantId,
        studentId: params.studentId,
        month: params.month,
        feeAmount: new Prisma.Decimal(feeAmount),
        paidAmount: new Prisma.Decimal(0),
        dueAmount: new Prisma.Decimal(feeAmount),
        status: "PENDING",
      },
    });
  }

  const currentPaid = Number(feeRecord.paidAmount || 0);
  const feeAmount = Number(feeRecord.feeAmount);
  const newPaid = currentPaid + params.paidAmount;
  const newDue = Math.max(0, feeAmount - newPaid);
  const status = newPaid >= feeAmount ? "PAID" : newPaid > 0 ? "PARTIAL" : "PENDING";
  const receipt = params.receiptNumber || `RCP-${Date.now().toString().slice(-6)}`;

  const updated = await prisma.studentFee.update({
    where: { id: feeRecord.id },
    data: {
      paidAmount: new Prisma.Decimal(newPaid),
      dueAmount: new Prisma.Decimal(newDue),
      status,
      paymentMethod: params.paymentMethod || "CASH",
      receiptNumber: receipt,
      paidAt: new Date(),
      notes: params.notes || null,
      recordedBy: req.user?.id || null,
    },
    include: { student: true },
  });

  await recordAudit({
    req,
    action: "student.fee_paid",
    module: "student",
    recordId: updated.id,
    recordType: "StudentFee",
    next: {
      studentId: student.id,
      month: params.month,
      paidAmount: params.paidAmount,
      totalPaid: newPaid,
      due: newDue,
      receipt,
    },
  });

  return updated;
}

export async function exportStudentFeesCsv(tenantId: string, params: { month: string; status?: string }) {
  const where: Prisma.StudentFeeWhereInput = { tenantId, month: params.month };
  if (params.status) where.status = params.status;

  const fees = await prisma.studentFee.findMany({
    where,
    include: { student: true },
    orderBy: [{ student: { className: "asc" } }, { student: { rollNumber: "asc" } }],
  });

  const header = "Roll Number,Student Name,Father Name,B-Form / CNIC,Class,Section,Month,Fee Amount,Paid Amount,Due Amount,Status,Receipt No,Payment Method,Paid Date\n";
  const rows = fees.map((f) => {
    const s = f.student;
    return [
      `"${s.rollNumber}"`,
      `"${s.fullName}"`,
      `"${s.fatherName}"`,
      `"${s.nationalId}"`,
      `"${s.className}"`,
      `"${s.section || ""}"`,
      `"${f.month}"`,
      f.feeAmount.toString(),
      f.paidAmount.toString(),
      f.dueAmount.toString(),
      f.status,
      `"${f.receiptNumber || ""}"`,
      `"${f.paymentMethod || ""}"`,
      `"${f.paidAt ? f.paidAt.toISOString().slice(0, 10) : ""}"`,
    ].join(",");
  });

  return header + rows.join("\n");
}
