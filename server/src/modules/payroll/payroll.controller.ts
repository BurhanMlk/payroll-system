import { NextFunction, Request, Response } from "express";
import {
  generatePayroll,
  listPayrollRuns,
  getPayrollRun,
  updatePayrollRun,
  deletePayrollRun,
  reviewPayroll,
  approvePayroll,
  markPayrollPaid,
  lockPayroll,
  unlockPayroll,
  generatePayslips,
  listPayslips,
  getPayslip,
  autoGeneratePayslips,
  salaryOverview,
  salaryCsv,
  getDeductionSetting,
  setDeductionSetting,
} from "./payroll.service";
import { ok, created, noContent } from "../../lib/response";
import { prisma } from "../../lib/prisma";
import { buildPayslipPdf } from "../../utils/payslipPdf";
import { startOfDay, endOfDay } from "../../utils/dates";

export async function generate(req: Request, res: Response, next: NextFunction) {
  try {
    created(res, await generatePayroll(req.tenant!.id, req.body, req));
  } catch (err) {
    next(err);
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await listPayrollRuns(req.tenant!.id, req.query);
    ok(res, result.items, result.meta);
  } catch (err) {
    next(err);
  }
}

export async function get(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await getPayrollRun(req.tenant!.id, req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await updatePayrollRun(req.tenant!.id, req.params.id, req.body, req));
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await deletePayrollRun(req.tenant!.id, req.params.id, req);
    noContent(res);
  } catch (err) {
    next(err);
  }
}

export async function review(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await reviewPayroll(req.tenant!.id, req.params.id, req));
  } catch (err) {
    next(err);
  }
}

export async function approve(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await approvePayroll(req.tenant!.id, req.params.id, req.body?.remarks, req));
  } catch (err) {
    next(err);
  }
}

export async function markPaid(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await markPayrollPaid(req.tenant!.id, req.params.id, req));
  } catch (err) {
    next(err);
  }
}

export async function lock(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await lockPayroll(req.tenant!.id, req.params.id, req));
  } catch (err) {
    next(err);
  }
}

export async function unlock(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await unlockPayroll(req.tenant!.id, req.params.id, req.body?.reason, req));
  } catch (err) {
    next(err);
  }
}

// Payslips
export async function makePayslips(req: Request, res: Response, next: NextFunction) {
  try {
    created(res, await generatePayslips(req.tenant!.id, req.params.id, req));
  } catch (err) {
    next(err);
  }
}

export async function listSlips(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await listPayslips(req.tenant!.id, req.query);
    ok(res, result.items, result.meta);
  } catch (err) {
    next(err);
  }
}

export async function getSlip(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await getPayslip(req.tenant!.id, req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function getSlipPdf(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getPayslip(req.tenant!.id, req.params.id);
    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenant!.id } });
    const pdf = await buildPayslipPdf({
      payslip: data,
      employee: data.employee,
      payrollItem: data.payrollItem,
      payrollRun: data.payrollRun,
      institution: {
        name: tenant?.name ?? req.tenant!.name,
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

export async function autoPayslips(req: Request, res: Response, next: NextFunction) {
  try {
    const { periodStart, periodEnd } = req.body as { periodStart?: string; periodEnd?: string };
    const now = new Date();
    const start = periodStart ? startOfDay(new Date(periodStart)) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = periodEnd ? endOfDay(new Date(periodEnd)) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    created(res, await autoGeneratePayslips(req.tenant!.id, start, end, req));
  } catch (err) {
    next(err);
  }
}

export async function salaries(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await salaryOverview(req.tenant!.id));
  } catch (err) {
    next(err);
  }
}

export async function salariesCsv(req: Request, res: Response, next: NextFunction) {
  try {
    const overview = await salaryOverview(req.tenant!.id);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="salaries.csv"');
    res.send(salaryCsv(overview));
  } catch (err) {
    next(err);
  }
}

export async function getDeduction(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, { amount: await getDeductionSetting(req.tenant!.id) });
  } catch (err) {
    next(err);
  }
}

export async function setDeduction(req: Request, res: Response, next: NextFunction) {
  try {
    const amount = Math.max(0, Number((req.body as { amount?: number }).amount ?? 0));
    await setDeductionSetting(req.tenant!.id, amount);
    ok(res, { amount });
  } catch (err) {
    next(err);
  }
}
