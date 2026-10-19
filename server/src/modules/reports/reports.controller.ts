import { NextFunction, Request, Response } from "express";
import { monthlyPayrollReport, attendanceReport, leaveReport, loanReport, taxReport, overtimeReport } from "./reports.service";
import { ok } from "../../lib/response";
import { toCsv } from "../../utils/csv";
import { buildExcel } from "../../utils/excel";

function sendCsv(res: Response, filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const csv = toCsv(headers, rows);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
}

export async function payrollReport(req: Request, res: Response, next: NextFunction) {
  try {
    const items = await monthlyPayrollReport(req.tenant!.id, req.query);
    if (req.query.format === "csv") {
      sendCsv(
        res,
        "payroll-report.csv",
        ["Employee ID", "Name", "Branch", "Department", "Payroll", "Basic", "Gross", "Deductions", "Net", "Status"],
        items.map((i) => [
          i.employee.employeeNumber,
          `${i.employee.firstName} ${i.employee.lastName}`,
          i.employee.branch?.name ?? "",
          i.employee.department?.name ?? "",
          i.payrollRun.name,
          i.basicSalary.toNumber(),
          i.grossSalary.toNumber(),
          i.totalDeductions.toNumber(),
          i.netSalary.toNumber(),
          i.payrollRun.status,
        ]),
      );
      return;
    }
    if (req.query.format === "excel") {
      const buffer = await buildExcel([
        {
          name: "Payroll",
          headers: ["Employee ID", "Name", "Branch", "Department", "Payroll", "Basic", "Gross", "Deductions", "Net", "Status"],
          rows: items.map((i) => [
            i.employee.employeeNumber,
            `${i.employee.firstName} ${i.employee.lastName}`,
            i.employee.branch?.name ?? "",
            i.employee.department?.name ?? "",
            i.payrollRun.name,
            i.basicSalary.toNumber(),
            i.grossSalary.toNumber(),
            i.totalDeductions.toNumber(),
            i.netSalary.toNumber(),
            i.payrollRun.status,
          ]),
        },
      ]);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", 'attachment; filename="payroll-report.xlsx"');
      res.send(buffer);
      return;
    }
    ok(res, items);
  } catch (err) {
    next(err);
  }
}

export async function attendanceRep(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await attendanceReport(req.tenant!.id, req.query, req.query);
    if (req.query.format === "csv") {
      sendCsv(
        res,
        "attendance-report.csv",
        ["Date", "Employee ID", "Name", "Status", "Check In", "Check Out", "Late (min)", "Overtime (h)"],
        result.items.map((a) => [
          a.date.toISOString().slice(0, 10),
          a.employee.employeeNumber,
          `${a.employee.firstName} ${a.employee.lastName}`,
          a.status,
          a.checkIn?.toISOString() ?? "",
          a.checkOut?.toISOString() ?? "",
          a.lateMinutes,
          a.overtimeHours.toNumber(),
        ]),
      );
      return;
    }
    ok(res, result.items, result.meta);
  } catch (err) {
    next(err);
  }
}

export async function leaveRep(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await leaveReport(req.tenant!.id, req.query, req.query);
    if (req.query.format === "csv") {
      sendCsv(
        res,
        "leave-report.csv",
        ["Employee ID", "Name", "Type", "Start", "End", "Days", "Status"],
        result.items.map((l) => [
          l.employee.employeeNumber,
          `${l.employee.firstName} ${l.employee.lastName}`,
          l.leaveType.name,
          l.startDate.toISOString().slice(0, 10),
          l.endDate.toISOString().slice(0, 10),
          l.days.toNumber(),
          l.status,
        ]),
      );
      return;
    }
    ok(res, result.items, result.meta);
  } catch (err) {
    next(err);
  }
}

export async function loanRep(req: Request, res: Response, next: NextFunction) {
  try {
    const items = await loanReport(req.tenant!.id, req.query);
    if (req.query.format === "csv") {
      sendCsv(
        res,
        "loan-report.csv",
        ["Loan #", "Employee ID", "Name", "Amount", "Remaining", "Installments", "Status"],
        items.map((l) => [
          l.loanNumber,
          l.employee.employeeNumber,
          `${l.employee.firstName} ${l.employee.lastName}`,
          l.loanAmount.toNumber(),
          l.remainingBalance.toNumber(),
          l.installmentCount,
          l.status,
        ]),
      );
      return;
    }
    ok(res, items);
  } catch (err) {
    next(err);
  }
}

export async function taxRep(req: Request, res: Response, next: NextFunction) {
  try {
    const items = await taxReport(req.tenant!.id, req.query);
    if (req.query.format === "csv") {
      sendCsv(
        res,
        "tax-report.csv",
        ["Employee ID", "Name", "Payroll", "Tax Amount"],
        items.map((i) => [i.employee.employeeNumber, `${i.employee.firstName} ${i.employee.lastName}`, i.payrollRun.name, i.taxAmount.toNumber()]),
      );
      return;
    }
    ok(res, items);
  } catch (err) {
    next(err);
  }
}

export async function overtimeRep(req: Request, res: Response, next: NextFunction) {
  try {
    const items = await overtimeReport(req.tenant!.id, req.query);
    if (req.query.format === "csv") {
      sendCsv(
        res,
        "overtime-report.csv",
        ["Date", "Employee ID", "Name", "Hours"],
        items.map((a) => [a.date.toISOString().slice(0, 10), a.employee.employeeNumber, `${a.employee.firstName} ${a.employee.lastName}`, a.overtimeHours.toNumber()]),
      );
      return;
    }
    ok(res, items);
  } catch (err) {
    next(err);
  }
}
