import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { Prisma, User } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { redis } from "../lib/redis";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/jwt";
import { AppError } from "../lib/errors";
import { env } from "../config/env";

const MAX_FAILED_ATTEMPTS = 3;
const LOCK_MINUTES = 30;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: SafeUser;
}

export interface SafeUser {
  id: string;
  email: string;
  fullName: string;
  tenantId: string | null;
  scope: "PLATFORM" | "TENANT";
  roles: string[];
  permissions: string[];
  tenant?: { id: string; name: string; slug: string; status: string; currency: string; institutionType?: string } | null;
}

const safeUserInclude = {
  roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
  tenant: true,
} satisfies Prisma.UserInclude;

type LoadedUser = Prisma.UserGetPayload<{ include: typeof safeUserInclude }>;

function buildSafeUserFromLoaded(withRoles: LoadedUser): SafeUser {
  const roles = withRoles.roles.map((ur) => ur.role.key);
  const permissions = Array.from(
    new Set(withRoles.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.key))),
  );
  return {
    id: withRoles.id,
    email: withRoles.email,
    fullName: withRoles.fullName,
    tenantId: withRoles.tenantId,
    scope: withRoles.tenantId ? "TENANT" : "PLATFORM",
    roles,
    permissions,
    tenant: withRoles.tenant
      ? {
          id: withRoles.tenant.id,
          name: withRoles.tenant.name,
          slug: withRoles.tenant.slug,
          status: withRoles.tenant.status,
          currency: withRoles.tenant.currency,
          institutionType: withRoles.tenant.institutionType,
        }
      : null,
  };
}

async function loadSafeUser(userId: string): Promise<SafeUser | null> {
  const withRoles = await prisma.user.findUnique({
    where: { id: userId },
    include: safeUserInclude,
  });
  return withRoles ? buildSafeUserFromLoaded(withRoles) : null;
}

function denyListKey(jti: string): string {
  return `refresh:denylist:${jti}`;
}

/** Fetches and builds the full safe user (with tenant currency) for /auth/me. */
export async function getSafeUserById(userId: string): Promise<SafeUser | null> {
  return loadSafeUser(userId);
}

export async function login(email: string, password: string, ip?: string): Promise<AuthTokens> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) {
    // Constant-ish error to avoid user enumeration; hash compare still runs.
    await bcrypt.compare(password, "$2a$12$C6UzMDM.H6dfI/f/IKcEeO7Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5");
    throw AppError.unauthorized("Invalid email or password.", "INVALID_CREDENTIALS");
  }

  if (user.status !== "ACTIVE") {
    throw AppError.forbidden("Your account is not active. Contact your administrator.", "ACCOUNT_INACTIVE");
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    throw new AppError(
      "ACCOUNT_LOCKED",
      "Account temporarily locked due to too many failed attempts.",
      429,
      { details: { lockedUntil: user.lockedUntil.toISOString(), remainingMinutes } },
    );
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const failedAttempts = user.failedLoginAttempts + 1;
    const locked = failedAttempts >= MAX_FAILED_ATTEMPTS;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: locked ? 0 : failedAttempts,
        lockedUntil: locked ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000) : null,
      },
    });
    throw AppError.unauthorized("Invalid email or password.", "INVALID_CREDENTIALS");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  return issueTokens(user, ip);
}

async function issueTokens(user: User, _ip?: string): Promise<AuthTokens> {
  const safeUser = (await loadSafeUser(user.id)) ?? {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    tenantId: user.tenantId,
    scope: user.tenantId ? ("TENANT" as const) : ("PLATFORM" as const),
    roles: [],
    permissions: [],
    tenant: null,
  };
  const jti = randomUUID();
  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    tenantId: user.tenantId,
    scope: safeUser.scope,
    fullName: user.fullName,
    roles: safeUser.roles,
  });
  const refreshToken = signRefreshToken({ sub: user.id, jti, sessionVersion: 1 });

  return { accessToken, refreshToken, user: safeUser };
}

export async function refresh(refreshToken: string): Promise<AuthTokens> {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw AppError.unauthorized("Invalid refresh token.", "INVALID_REFRESH_TOKEN");
  }

  // Reject revoked tokens.
  const revoked = await redis.get(denyListKey(payload.jti));
  if (revoked) {
    throw AppError.unauthorized("Refresh token has been revoked.", "INVALID_REFRESH_TOKEN");
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.status !== "ACTIVE") {
    throw AppError.unauthorized("Account is not active.", "ACCOUNT_INACTIVE");
  }

  const tokens = await issueTokens(user);

  // Rotate: revoke the old refresh token.
  const ttl = Math.max(1, Math.floor((payload.exp! - Math.floor(Date.now() / 1000)) * 1000));
  await redis.set(denyListKey(payload.jti), "1", "PX", ttl);

  return tokens;
}

export async function logout(refreshToken: string | undefined, accessToken?: string): Promise<void> {
  if (refreshToken) {
    try {
      const payload = verifyRefreshToken(refreshToken);
      const ttl = Math.max(1, Math.floor((payload.exp! - Math.floor(Date.now() / 1000)) * 1000));
      await redis.set(denyListKey(payload.jti), "1", "PX", ttl);
    } catch {
      // token already invalid — nothing to revoke
    }
  }
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.notFound("User not found.");

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw AppError.badRequest("Current password is incorrect.", "INVALID_PASSWORD");

  const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, env.BCRYPT_ROUNDS);
}
