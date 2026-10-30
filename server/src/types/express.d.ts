import "express";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  tenantId: string | null;
  scope: "PLATFORM" | "TENANT";
  roles: string[];
  permissions: string[];
}

export interface TenantContext {
  id: string;
  name: string;
  slug: string;
  status: string;
  currency: string;
  timezone: string;
  subscription?: {
    id: string;
    planKey: string;
    planName: string;
    status: string;
    renewalDate: Date | null;
    gracePeriodEnd: Date | null;
    features: Record<string, boolean>;
    employeeLimit: number;
    branchLimit: number;
    userLimit: number;
  };
}

export interface EmployeeContext {
  id: string;
  tenantId: string;
  employeeNumber: string;
  fullName: string;
}

export interface StudentContext {
  id: string;
  tenantId: string;
  rollNumber: string;
  fullName: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      tenant?: TenantContext;
      employee?: EmployeeContext;
      student?: StudentContext;
      requestId?: string;
    }
  }
}

export interface PaginationQuery {
  page?: string;
  limit?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export type OrderDirection = "asc" | "desc";
