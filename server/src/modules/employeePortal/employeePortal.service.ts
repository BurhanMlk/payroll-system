import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { signEmployeeToken } from "../../lib/jwt";

function formatCnic(digits: string): string {
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12, 13)}`;
}

/** Employee self-service login: CNIC as username, last 4 digits of CNIC as password. */
export async function employeeLogin(cnic: string, password: string) {
  const raw = (cnic || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) throw AppError.unauthorized("Invalid CNIC or password.", "INVALID_CREDENTIALS");

  const candidates = Array.from(
    new Set([raw, digits, digits.length === 13 ? formatCnic(digits) : null].filter((v): v is string => Boolean(v))),
  );

  const employee = await prisma.employee.findFirst({
    where: { nationalId: { in: candidates } },
    include: { tenant: { select: { id: true, name: true } } },
  });

  if (!employee) throw AppError.unauthorized("Invalid CNIC or password.", "INVALID_CREDENTIALS");
  if (["TERMINATED", "RESIGNED", "RETIRED", "SUSPENDED"].includes(employee.status)) {
    throw AppError.unauthorized("Your account is not active.", "ACCOUNT_INACTIVE");
  }

  const expected = digits.slice(-4);
  if (password !== expected) throw AppError.unauthorized("Invalid CNIC or password.", "INVALID_CREDENTIALS");

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
