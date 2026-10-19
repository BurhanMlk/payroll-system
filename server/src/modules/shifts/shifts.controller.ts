import { NextFunction, Request, Response } from "express";
import { listShifts, createShift, updateShift, deleteShift, assignShiftToEmployee } from "./shifts.service";
import { ok, created, noContent } from "../../lib/response";

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await listShifts(req.tenant!.id));
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    created(res, await createShift(req.tenant!.id, req.body, req));
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await updateShift(req.tenant!.id, req.params.id, req.body, req));
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteShift(req.tenant!.id, req.params.id, req);
    noContent(res);
  } catch (err) {
    next(err);
  }
}

export async function assign(req: Request, res: Response, next: NextFunction) {
  try {
    created(res, await assignShiftToEmployee(req.tenant!.id, req.params.employeeId, req.body.shiftId, req));
  } catch (err) {
    next(err);
  }
}
