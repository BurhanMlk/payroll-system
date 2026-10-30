import jwt, { SignOptions, JwtPayload } from "jsonwebtoken";
import { env } from "../config/env";

export interface AccessTokenPayload extends JwtPayload {
  sub: string; // user id
  email: string;
  tenantId: string | null;
  scope: "PLATFORM" | "TENANT";
  fullName: string;
  roles: string[];
}

export interface RefreshTokenPayload extends JwtPayload {
  sub: string;
  jti: string; // unique id for rotation tracking
  sessionVersion: number;
}

export function signAccessToken(payload: Omit<AccessTokenPayload, keyof JwtPayload>): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  } as SignOptions);
}

export function signRefreshToken(payload: Omit<RefreshTokenPayload, keyof JwtPayload>): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}

export interface EmployeeTokenPayload extends JwtPayload {
  sub: string; // employee id
  tenantId: string;
  employeeNumber: string;
  fullName: string;
  scope: "EMPLOYEE";
}

export function signEmployeeToken(payload: Omit<EmployeeTokenPayload, keyof JwtPayload>): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  } as SignOptions);
}

export function verifyEmployeeToken(token: string): EmployeeTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as EmployeeTokenPayload;
}

export interface StudentTokenPayload extends JwtPayload {
  sub: string; // student id
  tenantId: string;
  rollNumber: string;
  fullName: string;
  scope: "STUDENT";
}

export function signStudentToken(payload: Omit<StudentTokenPayload, keyof JwtPayload>): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  } as SignOptions);
}

export function verifyStudentToken(token: string): StudentTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as StudentTokenPayload;
}
