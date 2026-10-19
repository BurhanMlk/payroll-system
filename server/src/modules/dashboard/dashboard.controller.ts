import { NextFunction, Request, Response } from "express";
import { getDashboard } from "./dashboard.service";
import { ok } from "../../lib/response";

export async function dashboard(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await getDashboard(req.tenant!.id));
  } catch (err) {
    next(err);
  }
}
