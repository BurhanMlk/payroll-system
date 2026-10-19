import { NextFunction, Request, Response } from "express";
import { listHolidays, createHoliday, updateHoliday, deleteHoliday } from "./holidays.service";
import { ok, created, noContent } from "../../lib/response";

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const year = req.query.year ? parseInt(String(req.query.year), 10) : undefined;
    ok(res, await listHolidays(req.tenant!.id, year));
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    created(res, await createHoliday(req.tenant!.id, req.body, req));
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await updateHoliday(req.tenant!.id, req.params.id, req.body, req));
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteHoliday(req.tenant!.id, req.params.id, req);
    noContent(res);
  } catch (err) {
    next(err);
  }
}
