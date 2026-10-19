import { NextFunction, Request, Response } from "express";
import { getBillingOverview, listInvoices, listPaymentHistory, checkout, recordPayment, deleteInvoice, deletePayment } from "./billing.service";
import { ok, noContent } from "../../lib/response";

export async function overview(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await getBillingOverview(req.tenant!.id));
  } catch (err) {
    next(err);
  }
}

export async function invoices(req: Request, res: Response, next: NextFunction) {
  try {
    const r = await listInvoices(req.tenant!.id, req.query);
    ok(res, r.items, r.meta);
  } catch (err) {
    next(err);
  }
}

export async function payments(req: Request, res: Response, next: NextFunction) {
  try {
    const r = await listPaymentHistory(req.tenant!.id, req.query);
    ok(res, r.items, r.meta);
  } catch (err) {
    next(err);
  }
}

export async function checkoutC(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await checkout(req.tenant!.id, req));
  } catch (err) {
    next(err);
  }
}

export async function recordPaymentC(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await recordPayment(req.tenant!.id, req.body.amount, req.body.reference, req));
  } catch (err) {
    next(err);
  }
}

export async function removeInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteInvoice(req.tenant!.id, req.params.id, req);
    noContent(res);
  } catch (err) {
    next(err);
  }
}

export async function removePayment(req: Request, res: Response, next: NextFunction) {
  try {
    await deletePayment(req.tenant!.id, req.params.id, req);
    noContent(res);
  } catch (err) {
    next(err);
  }
}
