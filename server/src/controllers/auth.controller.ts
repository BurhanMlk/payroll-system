import { NextFunction, Request, Response } from "express";
import * as authService from "../services/auth.service";
import { ok, noContent } from "../lib/response";
import { env, cookieSecure } from "../config/env";

const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body as { email: string; password: string };
    const tokens = await authService.login(email, password, req.ip);
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    ok(res, { user: tokens.user, accessToken: tokens.accessToken });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token =
      (req.body as { refreshToken?: string })?.refreshToken ?? (req.cookies?.[REFRESH_COOKIE] as string | undefined);
    if (!token) {
      res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "No refresh token provided." } });
      return;
    }
    const tokens = await authService.refresh(token);
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    ok(res, { user: tokens.user, accessToken: tokens.accessToken });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const refreshToken = (req.cookies?.[REFRESH_COOKIE] as string | undefined) ?? (req.body as { refreshToken?: string })?.refreshToken;
    await authService.logout(refreshToken);
    res.clearCookie(ACCESS_COOKIE, cookieOptions());
    res.clearCookie(REFRESH_COOKIE, cookieOptions());
    noContent(res);
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await authService.getSafeUserById(req.user!.id);
    ok(res, { user: user ?? req.user });
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
    await authService.changePassword(req.user!.id, currentPassword, newPassword);
    ok(res, { success: true });
  } catch (err) {
    next(err);
  }
}

function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(ACCESS_COOKIE, accessToken, cookieOptions());
  res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions(30 * 24 * 60 * 60 * 1000));
}

function cookieOptions(maxAgeMs = 15 * 60 * 1000) {
  return {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: "lax" as const,
    domain: env.COOKIE_DOMAIN || undefined,
    maxAge: maxAgeMs,
    path: "/",
  };
}
