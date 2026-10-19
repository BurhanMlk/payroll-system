import { NextFunction, Request, Response } from "express";
import { myProfile, myAttendance, myPayslips, myLeaveRequests, myLeaveBalances, myLoans, myRequestLeave, updateMyProfile } from "./me.service";
import { ok, created } from "../../lib/response";

export async function profile(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await myProfile(req.tenant!.id, req.user!.id));
  } catch (e) {
    next(e);
  }
}

export async function attendance(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await myAttendance(req.tenant!.id, req.user!.id, req.query.month as string | undefined));
  } catch (e) {
    next(e);
  }
}

export async function payslips(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await myPayslips(req.tenant!.id, req.user!.id));
  } catch (e) {
    next(e);
  }
}

export async function leaveRequests(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await myLeaveRequests(req.tenant!.id, req.user!.id));
  } catch (e) {
    next(e);
  }
}

export async function leaveBalances(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await myLeaveBalances(req.tenant!.id, req.user!.id));
  } catch (e) {
    next(e);
  }
}

export async function loans(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await myLoans(req.tenant!.id, req.user!.id));
  } catch (e) {
    next(e);
  }
}

export async function requestLeaveC(req: Request, res: Response, next: NextFunction) {
  try {
    created(res, await myRequestLeave(req.tenant!.id, req.user!.id, req.body, req));
  } catch (e) {
    next(e);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await updateMyProfile(req.tenant!.id, req.user!.id, req.body));
  } catch (e) {
    next(e);
  }
}
