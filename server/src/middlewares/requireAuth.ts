import { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors";
import { verifyAccessToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";
import { redis } from "../lib/redis";

/**
 * Authenticates the request via `Authorization: Bearer <token>` or the
 * `access_token` httpOnly cookie. Loads the user's current roles and
 * permissions with high-performance Redis caching to keep API responses instant.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    let token: string | undefined;

    if (header?.startsWith("Bearer ")) {
      token = header.slice(7);
    } else if (req.cookies?.access_token) {
      token = req.cookies.access_token as string;
    }

    if (!token) {
      throw AppError.unauthorized("Authentication required. Please sign in.");
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw AppError.unauthorized("Your session has expired. Please sign in again.", "TOKEN_EXPIRED");
    }

    const cacheKey = `cache:user:auth:${payload.sub}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        req.user = JSON.parse(cached);
        next();
        return;
      }
    } catch {
      // Redis error fallback to db
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      },
    });

    if (!user || user.status !== "ACTIVE") {
      throw AppError.unauthorized("Account is not active.", "ACCOUNT_INACTIVE");
    }

    const roles = user.roles.map((ur) => ur.role.key);
    const permissions = Array.from(
      new Set(user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.key))),
    );

    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      tenantId: user.tenantId,
      scope: user.tenantId ? "TENANT" : "PLATFORM",
      roles,
      permissions,
    };

    void redis.set(cacheKey, JSON.stringify(req.user), "EX", 30).catch(() => {});

    next();
  } catch (err) {
    next(err);
  }
}
