import { NextFunction, Request, Response } from "express";
import { listOrg, createOrg, updateOrg, deleteOrg } from "./org.service";
import { ok, created, noContent } from "../../lib/response";

type OrgModel = "department" | "designation" | "branch";

export function orgController(model: OrgModel) {
  return {
    async list(req: Request, res: Response, next: NextFunction) {
      try {
        const result = await listOrg(model, req.tenant!.id, req.query as { page?: string; limit?: string; search?: string });
        ok(res, result.items, result.meta);
      } catch (err) {
        next(err);
      }
    },
    async create(req: Request, res: Response, next: NextFunction) {
      try {
        const item = await createOrg(model, req.tenant!.id, req.body as Record<string, unknown>, req);
        created(res, item);
      } catch (err) {
        next(err);
      }
    },
    async update(req: Request, res: Response, next: NextFunction) {
      try {
        const item = await updateOrg(model, req.tenant!.id, req.params.id, req.body as Record<string, unknown>, req);
        ok(res, item);
      } catch (err) {
        next(err);
      }
    },
    async remove(req: Request, res: Response, next: NextFunction) {
      try {
        await deleteOrg(model, req.tenant!.id, req.params.id, req);
        noContent(res);
      } catch (err) {
        next(err);
      }
    },
  };
}
