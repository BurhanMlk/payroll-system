import { NextFunction, Request, Response } from "express";
import { listTenantRoles, createRole, updateRole, deleteRole, listPermissions } from "./rbac.service";
import { ok, created, noContent } from "../../lib/response";

export async function listRoles(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await listTenantRoles(req.tenant!.id));
  } catch (e) {
    next(e);
  }
}

export async function createRoleC(req: Request, res: Response, next: NextFunction) {
  try {
    created(res, await createRole(req.tenant!.id, req.body));
  } catch (e) {
    next(e);
  }
}

export async function updateRoleC(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await updateRole(req.tenant!.id, req.params.id, req.body));
  } catch (e) {
    next(e);
  }
}

export async function deleteRoleC(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteRole(req.tenant!.id, req.params.id);
    noContent(res);
  } catch (e) {
    next(e);
  }
}

export async function listPerms(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await listPermissions());
  } catch (e) {
    next(e);
  }
}
