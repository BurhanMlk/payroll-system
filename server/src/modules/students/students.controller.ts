import { NextFunction, Request, Response } from "express";
import {
  listStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  generateStudentTemplate,
  importStudentsFile,
  getStudentAttendance,
  markStudentAttendance,
  generateStudentAttendanceTemplate,
  importStudentAttendanceFile,
  getStudentFees,
  generateMonthlyFees,
  payStudentFee,
  exportStudentFeesCsv,
} from "./students.service";
import { ok, created, noContent } from "../../lib/response";
import { AppError } from "../../lib/errors";

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await listStudents(req.tenant!.id, req.query);
    ok(res, result.items, result.meta);
  } catch (err) {
    next(err);
  }
}

export async function get(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await getStudent(req.tenant!.id, req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    created(res, await createStudent(req.tenant!.id, req.body, req));
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await updateStudent(req.tenant!.id, req.params.id, req.body, req));
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteStudent(req.tenant!.id, req.params.id, req);
    noContent(res);
  } catch (err) {
    next(err);
  }
}

export async function downloadTemplate(_req: Request, res: Response, next: NextFunction) {
  try {
    const buffer = await generateStudentTemplate();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="student_import_template.xlsx"');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

export async function bulkImport(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw AppError.badRequest("Please upload an Excel (.xlsx) or CSV file.");
    const result = await importStudentsFile(req.tenant!.id, req.file, req);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------------------
// ATTENDANCE
// ----------------------------------------------------------------------------

export async function getAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    const { date, className, section } = req.query;
    if (!date) throw AppError.badRequest("Date query parameter is required.");
    const records = await getStudentAttendance(req.tenant!.id, {
      date: String(date),
      className: className ? String(className) : undefined,
      section: section ? String(section) : undefined,
    });
    ok(res, records);
  } catch (err) {
    next(err);
  }
}

export async function markAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    const { date, records } = req.body;
    const result = await markStudentAttendance(req.tenant!.id, date, records, req);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function downloadAttendanceTemplate(_req: Request, res: Response, next: NextFunction) {
  try {
    const buffer = await generateStudentAttendanceTemplate();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="student_attendance_template.xlsx"');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

export async function importAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw AppError.badRequest("Please upload an Excel (.xlsx) or CSV file.");
    const result = await importStudentAttendanceFile(req.tenant!.id, req.file, req);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------------------
// FEES
// ----------------------------------------------------------------------------

export async function getFees(req: Request, res: Response, next: NextFunction) {
  try {
    const { month, className, section, status, search, page, limit } = req.query;
    const currentMonth = month ? String(month) : new Date().toISOString().slice(0, 7);
    const result = await getStudentFees(req.tenant!.id, {
      month: currentMonth,
      className: className ? String(className) : undefined,
      section: section ? String(section) : undefined,
      status: status ? String(status) : undefined,
      search: search ? String(search) : undefined,
      page: page ? String(page) : undefined,
      limit: limit ? String(limit) : undefined,
    });
    res.json({
      success: true,
      data: result.items,
      summary: result.summary,
      meta: result.meta,
    });
  } catch (err) {
    next(err);
  }
}

export async function generateFees(req: Request, res: Response, next: NextFunction) {
  try {
    const { month, className, section } = req.body;
    const result = await generateMonthlyFees(req.tenant!.id, { month, className, section }, req);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function payFee(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await payStudentFee(req.tenant!.id, req.body, req);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function exportFees(req: Request, res: Response, next: NextFunction) {
  try {
    const { month, status } = req.query;
    const currentMonth = month ? String(month) : new Date().toISOString().slice(0, 7);
    const csv = await exportStudentFeesCsv(req.tenant!.id, {
      month: currentMonth,
      status: status ? String(status) : undefined,
    });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="student_fees_${currentMonth}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
}

