import { NextFunction, Request, Response } from "express";
import { listUsers, createUser, updateUser, deleteUser, getSettings, updateSettings } from "./users.service";
import { listTenantRoles } from "../rbac/rbac.service";
import { ok, created, noContent } from "../../lib/response";

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const r = await listUsers(req.tenant!.id, req.query);
    ok(res, r.items, r.meta);
  } catch (e) {
    next(e);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    created(res, await createUser(req.tenant!.id, req.body, req));
  } catch (e) {
    next(e);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await updateUser(req.tenant!.id, req.params.id, req.body, req));
  } catch (e) {
    next(e);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteUser(req.tenant!.id, req.params.id, req);
    noContent(res);
  } catch (e) {
    next(e);
  }
}

export async function roles(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await listTenantRoles(req.tenant!.id));
  } catch (e) {
    next(e);
  }
}

export async function settings(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await getSettings(req.tenant!.id));
  } catch (e) {
    next(e);
  }
}

export async function updateSetting(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await updateSettings(req.tenant!.id, req.body.key, req.body.value, req));
  } catch (e) {
    next(e);
  }
}
