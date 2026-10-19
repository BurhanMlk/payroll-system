import { NextFunction, Request, Response } from "express";
import {
  listLoans,
  getLoan,
  createLoan,
  approveLoan,
  cancelLoan,
  getLoanRepaymentHistory,
  listAdvances,
  createAdvance,
  approveAdvance,
} from "./finance.service";
import { ok, created } from "../../lib/response";

export async function listLoan(req: Request, res: Response, next: NextFunction) {
  try {
    const r = await listLoans(req.tenant!.id, req.query);
    ok(res, r.items, r.meta);
  } catch (e) {
    next(e);
  }
}

export async function getLoanById(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await getLoan(req.tenant!.id, req.params.id));
  } catch (e) {
    next(e);
  }
}

export async function createLoanC(req: Request, res: Response, next: NextFunction) {
  try {
    created(res, await createLoan(req.tenant!.id, req.body, req));
  } catch (e) {
    next(e);
  }
}

export async function approveLoanC(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await approveLoan(req.tenant!.id, req.params.id, req));
  } catch (e) {
    next(e);
  }
}

export async function cancelLoanC(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await cancelLoan(req.tenant!.id, req.params.id, req));
  } catch (e) {
    next(e);
  }
}

export async function loanHistory(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await getLoanRepaymentHistory(req.tenant!.id, req.params.id));
  } catch (e) {
    next(e);
  }
}

export async function listAdv(req: Request, res: Response, next: NextFunction) {
  try {
    const r = await listAdvances(req.tenant!.id, req.query);
    ok(res, r.items, r.meta);
  } catch (e) {
    next(e);
  }
}

export async function createAdv(req: Request, res: Response, next: NextFunction) {
  try {
    created(res, await createAdvance(req.tenant!.id, req.body, req));
  } catch (e) {
    next(e);
  }
}

export async function approveAdv(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await approveAdvance(req.tenant!.id, req.params.id, req));
  } catch (e) {
    next(e);
  }
}
