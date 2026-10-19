import { NextFunction, Request, Response } from "express";
import { markAttendance, bulkMarkAttendance, listAttendance, attendanceSummary, employeeMonthlyAttendance, importAttendanceFile, updateAttendance, deleteAttendance } from "./attendance.service";
import { autoGeneratePayslips } from "../payroll/payroll.service";
import { ok, created, noContent } from "../../lib/response";

export async function mark(req: Request, res: Response, next: NextFunction) {
  try {
    created(res, await markAttendance(req.tenant!.id, req.body, req));
  } catch (err) {
    next(err);
  }
}

export async function bulkMark(req: Request, res: Response, next: NextFunction) {
  try {
    created(res, await bulkMarkAttendance(req.tenant!.id, req.body, req));
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await updateAttendance(req.tenant!.id, req.params.id, req.body, req));
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteAttendance(req.tenant!.id, req.params.id, req);
    noContent(res);
  } catch (err) {
    next(err);
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await listAttendance(req.tenant!.id, req.query);
    ok(res, result.items, result.meta);
  } catch (err) {
    next(err);
  }
}

export async function summary(req: Request, res: Response, next: NextFunction) {
  try {
    const date = req.query.date ? new Date(String(req.query.date)) : new Date();
    ok(res, await attendanceSummary(req.tenant!.id, date));
  } catch (err) {
    next(err);
  }
}

export async function employeeMonthly(req: Request, res: Response, next: NextFunction) {
  try {
    const month = req.query.month ? new Date(String(req.query.month)) : new Date();
    ok(res, await employeeMonthlyAttendance(req.tenant!.id, req.params.employeeId, month));
  } catch (err) {
    next(err);
  }
}

export async function importFile(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: { code: "BAD_REQUEST", message: "No file uploaded." } });
      return;
    }
    const result = await importAttendanceFile(req.tenant!.id, req.file, req);

    // Auto-generate payslips for the current month after attendance is imported.
    let payslipsGenerated = 0;
    try {
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      const run = await autoGeneratePayslips(req.tenant!.id, periodStart, periodEnd, req);
      payslipsGenerated = run.employeeCount;
    } catch {
      payslipsGenerated = 0;
    }

    created(res, { ...result, payslipsGenerated });
  } catch (err) {
    next(err);
  }
}
