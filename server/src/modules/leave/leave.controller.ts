import { NextFunction, Request, Response } from "express";
import {
  listLeaveTypes,
  createLeaveType,
  updateLeaveType,
  deleteLeaveType,
  requestLeave,
  listLeaveRequests,
  decideLeave,
  getLeaveBalances,
  deleteLeaveRequest,
} from "./leave.service";
import { prisma } from "../../lib/prisma";
import { ok, created, noContent } from "../../lib/response";

export async function listTypes(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await listLeaveTypes(req.tenant!.id));
  } catch (err) {
    next(err);
  }
}

export async function createType(req: Request, res: Response, next: NextFunction) {
  try {
    created(res, await createLeaveType(req.tenant!.id, req.body, req));
  } catch (err) {
    next(err);
  }
}

export async function updateType(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await updateLeaveType(req.tenant!.id, req.params.id, req.body, req));
  } catch (err) {
    next(err);
  }
}

export async function deleteType(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteLeaveType(req.tenant!.id, req.params.id, req);
    noContent(res);
  } catch (err) {
    next(err);
  }
}

export async function createRequest(req: Request, res: Response, next: NextFunction) {
  try {
    // Employees request for themselves; admins can request on behalf of others.
    const tenantId = req.tenant!.id;
    let employeeId: string | undefined = req.params.employeeId;
    if (!employeeId) {
      const linked = await prisma.employee.findFirst({ where: { tenantId, userId: req.user!.id }, select: { id: true } });
      employeeId = linked?.id;
    }
    if (!employeeId) {
      res.status(400).json({ success: false, error: { code: "BAD_REQUEST", message: "employeeId is required" } });
      return;
    }
    created(res, await requestLeave(tenantId, employeeId, req.body, req));
  } catch (err) {
    next(err);
  }
}

export async function listRequests(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await listLeaveRequests(req.tenant!.id, req.query);
    ok(res, result.items, result.meta);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteLeaveRequest(req.tenant!.id, req.params.id, req);
    noContent(res);
  } catch (err) {
    next(err);
  }
}

export async function decide(req: Request, res: Response, next: NextFunction) {
  try {
    ok(
      res,
      await decideLeave(
        req.tenant!.id,
        req.params.id,
        req.body.decision,
        req.user!.id,
        req.body.rejectionReason,
        req,
      ),
    );
  } catch (err) {
    next(err);
  }
}

export async function balances(req: Request, res: Response, next: NextFunction) {
  try {
    const year = req.query.year ? parseInt(String(req.query.year), 10) : undefined;
    ok(res, await getLeaveBalances(req.tenant!.id, req.params.employeeId, year));
  } catch (err) {
    next(err);
  }
}
