import { NextFunction, Request, Response } from "express";
import {
  loginStudent,
  getStudentPortalMe,
  getStudentPortalFees,
  getStudentPortalAttendance,
} from "./studentPortal.service";
import { ok } from "../../lib/response";

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await loginStudent(req.body);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const student = req.student!;
    const profile = await getStudentPortalMe(student.id, student.tenantId);
    ok(res, profile);
  } catch (err) {
    next(err);
  }
}

export async function fees(req: Request, res: Response, next: NextFunction) {
  try {
    const student = req.student!;
    const list = await getStudentPortalFees(student.id, student.tenantId);
    ok(res, list);
  } catch (err) {
    next(err);
  }
}

export async function attendance(req: Request, res: Response, next: NextFunction) {
  try {
    const student = req.student!;
    const month = req.query.month ? String(req.query.month) : undefined;
    const list = await getStudentPortalAttendance(student.id, student.tenantId, month);
    ok(res, list);
  } catch (err) {
    next(err);
  }
}

