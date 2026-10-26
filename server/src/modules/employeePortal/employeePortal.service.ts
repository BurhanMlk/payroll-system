import { Request } from "express";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { signEmployeeToken } from "../../lib/jwt";
import { listLeaveTypes, requestLeave } from "../leave/leave.service";

function formatCnic(digits: string): string {
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12, 13)}`;
}

function cnicCandidates(raw: string, digits: string): string[] {
  return Array.from(
    new Set([raw, digits, digits.length === 13 ? formatCnic(digits) : null].filter((v): v is string => Boolean(v))),
  );
}

const INACTIVE_STATUSES = ["TERMINATED", "RESIGNED", "RETIRED", "SUSPENDED"];

interface EmployeeWithTenant {
  id: string;
  tenantId: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  tenant: { name: string } | null;
}

function signInEmployee(employee: EmployeeWithTenant) {
  const accessToken = signEmployeeToken({
    sub: employee.id,
    tenantId: employee.tenantId,
    employeeNumber: employee.employeeNumber,
    fullName: `${employee.firstName} ${employee.lastName}`,
    scope: "EMPLOYEE",
  });

  return {
    accessToken,
    employee: {
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      firstName: employee.firstName,
      lastName: employee.lastName,
      tenantName: employee.tenant?.name ?? "",
    },
  };
}

/**
 * Employee self-service login: CNIC as username, last 4 digits of CNIC as password.
 * A CNIC can belong to more than one institution (e.g. a college and its academy),
 * so when several active records match, the caller gets a list to choose from.
 */
export async function employeeLogin(cnic: string, password: string) {
  const raw = (cnic || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) throw AppError.unauthorized("Invalid CNIC or password.", "INVALID_CREDENTIALS");

  const candidates = cnicCandidates(raw, digits);
  const employees = await prisma.employee.findMany({
    where: { nationalId: { in: candidates } },
    include: { tenant: { select: { id: true, name: true } } },
  });

  if (employees.length === 0) throw AppError.unauthorized("Invalid CNIC or password.", "INVALID_CREDENTIALS");

  const expected = digits.slice(-4);
  if (password !== expected) throw AppError.unauthorized("Invalid CNIC or password.", "INVALID_CREDENTIALS");

  const active = employees.filter((e) => !INACTIVE_STATUSES.includes(e.status));
  if (active.length === 0) throw AppError.unauthorized("Your account is not active.", "ACCOUNT_INACTIVE");

  if (active.length === 1) return signInEmployee(active[0]);

  // Same CNIC is enrolled in multiple institutions — let the employee pick one.
  return {
    requiresSelection: true,
    accounts: active.map((e) => ({
      employeeId: e.id,
      employeeNumber: e.employeeNumber,
      firstName: e.firstName,
      lastName: e.lastName,
      tenantName: e.tenant?.name ?? "",
    })),
  };
}

/** Pick one institution (employee record) after login and issue its access token. */
export async function employeeSelect(cnic: string, password: string, employeeId: string) {
  const raw = (cnic || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits || !employeeId) throw AppError.unauthorized("Invalid CNIC or password.", "INVALID_CREDENTIALS");

  const candidates = cnicCandidates(raw, digits);
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, nationalId: { in: candidates } },
    include: { tenant: { select: { id: true, name: true } } },
  });

  if (!employee) throw AppError.unauthorized("Invalid CNIC or password.", "INVALID_CREDENTIALS");
  if (INACTIVE_STATUSES.includes(employee.status)) {
    throw AppError.unauthorized("Your account is not active.", "ACCOUNT_INACTIVE");
  }

  const expected = digits.slice(-4);
  if (password !== expected) throw AppError.unauthorized("Invalid CNIC or password.", "INVALID_CREDENTIALS");

  return signInEmployee(employee);
}

/** Full self profile for a logged-in employee. */
export async function getEmployeeSelf(employeeId: string, tenantId: string) {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, tenantId },
    include: {
      tenant: { select: { id: true, name: true, currency: true } },
      branch: true,
      department: true,
      designation: true,
      salaryStructures: { where: { isActive: true }, take: 1, orderBy: { effectiveFrom: "desc" } },
      payslips: { orderBy: { createdAt: "desc" }, take: 12 },
      loans: { orderBy: { issueDate: "desc" }, take: 10 },
      advances: { orderBy: { issueDate: "desc" }, take: 10 },
      leaveRequests: { include: { leaveType: true }, orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!employee) throw AppError.notFound("Employee not found.");

  const attendance = await prisma.attendance.findMany({
    where: { tenantId, employeeId },
    orderBy: { date: "desc" },
    take: 30,
  });

  return { ...employee, attendance };
}

/** Attendance for a single month for the logged-in employee. */
export async function getEmployeeAttendance(employeeId: string, tenantId: string, month?: string) {
  const [y, m] = (month ?? "").split("-").map(Number);
  const valid = Number.isInteger(y) && Number.isInteger(m) && m >= 1 && m <= 12;
  const now = new Date();
  const year = valid ? y : now.getFullYear();
  const monthIndex = valid ? m - 1 : now.getMonth();
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0, 23, 59, 59);

  return prisma.attendance.findMany({
    where: { tenantId, employeeId, date: { gte: start, lte: end } },
    orderBy: { date: "asc" },
  });
}

/** Leave types available to the logged-in employee. */
export async function getEmployeeLeaveTypes(tenantId: string) {
  return listLeaveTypes(tenantId);
}

/** Creates a leave request on behalf of the logged-in employee. */
export async function submitEmployeeLeaveRequest(
  tenantId: string,
  employeeId: string,
  input: { leaveTypeId: string; startDate: string; endDate: string; reason?: string },
) {
  return requestLeave(
    tenantId,
    employeeId,
    {
      leaveTypeId: input.leaveTypeId,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      reason: input.reason,
    },
    { tenant: { id: tenantId }, ip: "employee-portal", headers: {} } as Request,
  );
}
