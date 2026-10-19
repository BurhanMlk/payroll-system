import { NextFunction, Request, Response } from "express";
import { listNotifications, markRead } from "./notifications.service";
import { ok, noContent } from "../../lib/response";

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await listNotifications(req.tenant?.id ?? null, req.user!.id, req.query);
    ok(res, { items: result.items, unread: result.unread }, result.meta);
  } catch (err) {
    next(err);
  }
}

export async function read(req: Request, res: Response, next: NextFunction) {
  try {
    await markRead(req.user!.id, req.params.id);
    noContent(res);
  } catch (err) {
    next(err);
  }
}

export async function readAll(req: Request, res: Response, next: NextFunction) {
  try {
    await markRead(req.user!.id);
    noContent(res);
  } catch (err) {
    next(err);
  }
}
