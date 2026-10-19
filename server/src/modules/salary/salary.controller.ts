import { NextFunction, Request, Response } from "express";
import {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  assignSalaryStructure,
  getEmployeeStructure,
} from "./salary.service";
import { ok, created, noContent } from "../../lib/response";

export async function listT(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await listTemplates(req.tenant!.id));
  } catch (err) {
    next(err);
  }
}

export async function getT(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await getTemplate(req.tenant!.id, req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function createT(req: Request, res: Response, next: NextFunction) {
  try {
    created(res, await createTemplate(req.tenant!.id, req.body, req));
  } catch (err) {
    next(err);
  }
}

export async function updateT(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await updateTemplate(req.tenant!.id, req.params.id, req.body, req));
  } catch (err) {
    next(err);
  }
}

export async function deleteT(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteTemplate(req.tenant!.id, req.params.id, req);
    noContent(res);
  } catch (err) {
    next(err);
  }
}

export async function assign(req: Request, res: Response, next: NextFunction) {
  try {
    created(res, await assignSalaryStructure(req.tenant!.id, req.params.employeeId, req.body, req));
  } catch (err) {
    next(err);
  }
}

export async function structure(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await getEmployeeStructure(req.tenant!.id, req.params.employeeId));
  } catch (err) {
    next(err);
  }
}
