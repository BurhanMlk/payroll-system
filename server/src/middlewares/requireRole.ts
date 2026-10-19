import { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors";

/** Requires the user to hold at least one of the given role keys. */
export function requireRole(...roleKeys: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      next(AppError.unauthorized());
      return;
    }
    if (!roleKeys.some((r) => user.roles.includes(r))) {
      next(AppError.forbidden("You do not have the required role to perform this action."));
      return;
    }
    next();
  };
}

/** Requires the user to hold at least one of the given permissions. */
export function requirePermission(...permissionKeys: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      next(AppError.unauthorized());
      return;
    }
    if (!permissionKeys.some((p) => user.permissions.includes(p))) {
      next(AppError.forbidden("You do not have permission to perform this action."));
      return;
    }
    next();
  };
}
