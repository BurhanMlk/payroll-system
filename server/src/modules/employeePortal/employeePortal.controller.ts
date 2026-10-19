import { NextFunction, Request, Response } from "express";
import { employeeLogin, getEmployeeSelf } from "./employeePortal.service";
import { ok } from "../../lib/response";
import { prisma } from "../../lib/prisma";
import { getPayslip } from "../payroll/payroll.service";
import { buildPayslipPdf } from "../../utils/payslipPdf";

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { cnic, password } = req.body as { cnic: string; password: string };
    ok(res, await employeeLogin(cnic, password));
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await getEmployeeSelf(req.employee!.id, req.employee!.tenantId));
  } catch (err) {
    next(err);
  }
}

export async function payslipPdf(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getPayslip(req.employee!.tenantId, req.params.id);
    if (data.employeeId !== req.employee!.id) {
      res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "You can only view your own payslips." } });
      return;
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: req.employee!.tenantId } });
    const pdf = await buildPayslipPdf({
      payslip: data,
      employee: data.employee,
      payrollItem: data.payrollItem,
      payrollRun: data.payrollRun,
      institution: {
        name: tenant?.name ?? "Institution",
        address: tenant?.address,
        logoUrl: tenant?.logoUrl,
      },
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="payslip-${data.employee.employeeNumber}.pdf"`);
    res.send(pdf);
  } catch (err) {
    next(err);
  }
}
