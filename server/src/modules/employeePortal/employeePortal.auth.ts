import { NextFunction, Request, Response } from "express";
import { AppError } from "../../lib/errors";
import { verifyEmployeeToken } from "../../lib/jwt";

export async function requireEmployee(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) throw AppError.unauthorized("Authentication required.");

    let payload;
    try {
      payload = verifyEmployeeToken(token);
    } catch {
      throw AppError.unauthorized("Your session has expired. Please sign in again.", "TOKEN_EXPIRED");
    }

    if (payload.scope !== "EMPLOYEE") throw AppError.unauthorized("Invalid token.");

    req.employee = {
      id: payload.sub,
      tenantId: payload.tenantId,
      employeeNumber: payload.employeeNumber,
      fullName: payload.fullName,
    };

    next();
  } catch (err) {
    next(err);
  }
}
