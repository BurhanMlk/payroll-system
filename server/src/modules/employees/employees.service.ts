import { Prisma, EmploymentType } from "@prisma/client";
import ExcelJS from "exceljs";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { parsePagination, paginationMeta } from "../../lib/response";
import { recordAudit } from "../../services/audit.service";
import { EmployeeCreateInput, EmployeeUpdateInput } from "./employees.validator";
import { Request } from "express";

export interface EmployeeListQuery {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
  branchId?: string;
  departmentId?: string;
  employmentType?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

const SORTABLE = new Set(["firstName", "lastName", "employeeNumber", "basicSalary", "joiningDate", "createdAt"]);

export async function listEmployees(tenantId: string, query: EmployeeListQuery) {
  const { page, limit, skip } = parsePagination({ page: query.page, limit: query.limit });

  const where: Prisma.EmployeeWhereInput = { tenantId };
  if (query.search) {
    const search = query.search.trim();
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { employeeNumber: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { nationalId: { contains: search, mode: "insensitive" } },
    ];
  }
  if (query.status) where.status = query.status as Prisma.EnumEmployeeStatusFilter["equals"];
  if (query.branchId) where.branchId = query.branchId;
  if (query.departmentId) where.departmentId = query.departmentId;
  if (query.employmentType) where.employmentType = query.employmentType as Prisma.EnumEmploymentTypeFilter["equals"];

  const sortBy = query.sortBy && SORTABLE.has(query.sortBy) ? query.sortBy : "createdAt";
  const orderBy: Prisma.EmployeeOrderByWithRelationInput = { [sortBy]: query.sortOrder ?? "asc" } as Prisma.EmployeeOrderByWithRelationInput;

  const [total, items] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      include: { branch: true, department: true, designation: true },
      orderBy,
      skip,
      take: limit,
    }),
  ]);

  return { items, meta: paginationMeta(total, page, limit) };
}

export async function getEmployee(tenantId: string, id: string) {
  const employee = await prisma.employee.findFirst({
    where: { id, tenantId },
    include: {
      branch: true,
      department: true,
      designation: true,
      user: { select: { id: true, email: true, fullName: true, status: true } },
      salaryStructures: { where: { isActive: true }, take: 1, orderBy: { effectiveFrom: "desc" } },
    },
  });
  if (!employee) throw AppError.notFound("Employee not found.");
  return employee;
}

/** Full employee profile by CNIC — personal info through payroll history. */
export async function getEmployeePortal(tenantId: string, cnic: string) {
  // Accept any CNIC format: with/without dashes or spaces.
  const digits = (cnic || "").replace(/\D/g, "");
  if (!digits) throw AppError.badRequest("Please provide a valid CNIC.");

  const candidates = Array.from(
    new Set([
      cnic.trim(),
      digits,
      digits.length === 13 ? `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12, 13)}` : null,
    ].filter((v): v is string => Boolean(v))),
  );

  const employee = await prisma.employee.findFirst({
    where: { tenantId, nationalId: { in: candidates } },
    include: {
      branch: true,
      department: true,
      designation: true,
      user: { select: { id: true, email: true, fullName: true, status: true } },
      salaryStructures: { where: { isActive: true }, take: 1, orderBy: { effectiveFrom: "desc" } },
      payslips: { orderBy: { createdAt: "desc" }, take: 12 },
      loans: { orderBy: { issueDate: "desc" }, take: 10 },
      advances: { orderBy: { issueDate: "desc" }, take: 10 },
      leaveRequests: { include: { leaveType: true }, orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!employee) throw AppError.notFound("No employee found with this CNIC.");

  const attendance = await prisma.attendance.findMany({
    where: { tenantId, employeeId: employee.id },
    orderBy: { date: "desc" },
    take: 30,
  });

  return { ...employee, attendance };
}

export async function createEmployee(tenantId: string, input: EmployeeCreateInput, req: Request) {
  const employeeNumber = input.employeeNumber?.trim() || (await generateEmployeeNumber(tenantId));

  const duplicate = await prisma.employee.findFirst({ where: { tenantId, employeeNumber } });
  if (duplicate) throw AppError.conflict(`Employee number "${employeeNumber}" already exists.`);

  // If a country/currency is selected on the form, update the tenant's currency
  // so salaries, payroll and payslips are shown in that currency.
  if (input.currency) {
    await prisma.tenant.update({ where: { id: tenantId }, data: { currency: input.currency } });
  }

  // Enforce plan employee limit.
  const subscription = await prisma.subscription.findUnique({
    where: { tenantId },
    include: { plan: true },
  });
  if (subscription) {
    const count = await prisma.employee.count({ where: { tenantId, status: "ACTIVE" } });
    if (count >= subscription.plan.employeeLimit) {
      throw new AppError(
        "EMPLOYEE_LIMIT_REACHED",
        `Your plan allows ${subscription.plan.employeeLimit} employees. Upgrade to add more.`,
        402,
      );
    }
  }

  if (input.branchId) await ensureTenantBranch(tenantId, input.branchId);
  const departmentId = await resolveDepartment(tenantId, input.departmentId, input.departmentName);
  const designationId = await resolveDesignation(tenantId, input.designationId, input.designationName);

  const employee = await prisma.employee.create({
    data: {
      tenantId,
      employeeNumber,
      firstName: input.firstName,
      lastName: input.lastName,
      fatherName: input.fatherName,
      nationalId: input.nationalId,
      dateOfBirth: input.dateOfBirth,
      gender: input.gender,
      phone: input.phone,
      alternatePhone: input.alternatePhone,
      email: input.email || null,
      address: input.address,
      emergencyContact: input.emergencyContact,
      branchId: input.branchId,
      departmentId,
      designationId,
      employmentType: input.employmentType,
      status: input.status,
      joiningDate: input.joiningDate,
      confirmationDate: input.confirmationDate,
      contractStart: input.contractStart,
      contractEnd: input.contractEnd,
      bankName: input.bankName,
      accountTitle: input.accountTitle,
      accountNumber: input.accountNumber,
      bankBranchName: input.bankBranchName,
      basicSalary: new Prisma.Decimal(input.basicSalary),
      salaryType: input.salaryType,
      paymentMethod: input.paymentMethod,
    },
    include: { branch: true, department: true, designation: true },
  });

  await recordAudit({
    req,
    action: "employee.created",
    module: "employee",
    recordId: employee.id,
    recordType: "Employee",
    next: { id: employee.id, employeeNumber: employee.employeeNumber },
  });

  return employee;
}

export async function updateEmployee(tenantId: string, id: string, input: EmployeeUpdateInput, req: Request) {
  const existing = await prisma.employee.findFirst({ where: { id, tenantId } });
  if (!existing) throw AppError.notFound("Employee not found.");

  if (input.branchId) await ensureTenantBranch(tenantId, input.branchId);

  const { departmentName, designationName, ...rest } = input;
  const data: Prisma.EmployeeUncheckedUpdateInput = { ...rest };
  if (departmentName) {
    data.departmentId = await resolveDepartment(tenantId, input.departmentId, departmentName);
  } else if (input.departmentId) {
    await ensureTenantDepartment(tenantId, input.departmentId);
  }
  if (designationName) {
    data.designationId = await resolveDesignation(tenantId, input.designationId, designationName);
  } else if (input.designationId) {
    await ensureTenantDesignation(tenantId, input.designationId);
  }

  if (input.email === "") data.email = null;
  if (input.basicSalary !== undefined) data.basicSalary = new Prisma.Decimal(input.basicSalary);

  const updated = await prisma.employee.update({
    where: { id },
    data,
    include: { branch: true, department: true, designation: true },
  });

  await recordAudit({
    req,
    action: "employee.updated",
    module: "employee",
    recordId: id,
    recordType: "Employee",
    previous: pick(existing, ["basicSalary", "status", "departmentId", "designationId"]),
    next: pick(updated, ["basicSalary", "status", "departmentId", "designationId"]),
  });

  return updated;
}

export async function archiveEmployee(tenantId: string, id: string, req: Request) {
  const existing = await prisma.employee.findFirst({ where: { id, tenantId } });
  if (!existing) throw AppError.notFound("Employee not found.");
  if (existing.status === "RESIGNED") throw AppError.badRequest("Employee is already archived.");

  const updated = await prisma.employee.update({
    where: { id },
    data: { status: "RESIGNED", contractEnd: new Date() },
  });

  await recordAudit({
    req,
    action: "employee.archived",
    module: "employee",
    recordId: id,
    recordType: "Employee",
    previous: { status: existing.status },
    next: { status: "RESIGNED" },
  });
  return updated;
}

export async function deleteEmployee(tenantId: string, id: string, req: Request) {
  const existing = await prisma.employee.findFirst({ where: { id, tenantId } });
  if (!existing) throw AppError.notFound("Employee not found.");

  await prisma.employee.delete({ where: { id } });

  await recordAudit({
    req,
    action: "employee.deleted",
    module: "employee",
    recordId: id,
    recordType: "Employee",
    previous: {
      employeeNumber: existing.employeeNumber,
      firstName: existing.firstName,
      lastName: existing.lastName,
    },
  });
}

export async function getEmployeeSalaryHistory(tenantId: string, id: string) {
  await getEmployee(tenantId, id);
  return prisma.employeeSalaryStructure.findMany({
    where: { tenantId, employeeId: id },
    orderBy: { effectiveFrom: "desc" },
  });
}

export async function listEmployeeDocuments(tenantId: string, employeeId: string) {
  await getEmployee(tenantId, employeeId);
  return prisma.employeeDocument.findMany({ where: { tenantId, employeeId }, orderBy: { createdAt: "desc" } });
}

async function ensureTenantBranch(tenantId: string, branchId: string) {
  const branch = await prisma.branch.findFirst({ where: { id: branchId, tenantId } });
  if (!branch) throw AppError.badRequest("Selected branch does not exist.");
}

async function ensureTenantDepartment(tenantId: string, departmentId: string) {
  const dept = await prisma.department.findFirst({ where: { id: departmentId, tenantId } });
  if (!dept) throw AppError.badRequest("Selected department does not exist.");
}

async function ensureTenantDesignation(tenantId: string, designationId: string) {
  const desig = await prisma.designation.findFirst({ where: { id: designationId, tenantId } });
  if (!desig) throw AppError.badRequest("Selected designation does not exist.");
}

async function generateEmployeeNumber(tenantId: string): Promise<string> {
  const count = await prisma.employee.count({ where: { tenantId } });
  let number = String(count + 1);
  while (await prisma.employee.findFirst({ where: { tenantId, employeeNumber: number } })) {
    number = String(parseInt(number, 10) + 1);
  }
  return number;
}

async function resolveDepartment(tenantId: string, departmentId?: string, departmentName?: string): Promise<string | undefined> {
  if (departmentId) {
    await ensureTenantDepartment(tenantId, departmentId);
    return departmentId;
  }
  const name = departmentName?.trim();
  if (!name) return undefined;
  const existing = await prisma.department.findFirst({ where: { tenantId, name } });
  if (existing) return existing.id;
  const created = await prisma.department.create({ data: { tenantId, name } });
  return created.id;
}

async function resolveDesignation(tenantId: string, designationId?: string, designationName?: string): Promise<string | undefined> {
  if (designationId) {
    await ensureTenantDesignation(tenantId, designationId);
    return designationId;
  }
  const name = designationName?.trim();
  if (!name) return undefined;
  const existing = await prisma.designation.findFirst({ where: { tenantId, name } });
  if (existing) return existing.id;
  const created = await prisma.designation.create({ data: { tenantId, name } });
  return created.id;
}

function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Partial<T> {
  const result: Partial<T> = {};
  for (const k of keys) result[k] = obj[k];
  return result;
}

export async function generateEmployeeTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Employees Template");
  sheet.columns = [
    { header: "First Name", key: "firstName", width: 16 },
    { header: "Last Name", key: "lastName", width: 16 },
    { header: "Father Name", key: "fatherName", width: 20 },
    { header: "CNIC", key: "nationalId", width: 18 },
    { header: "Email", key: "email", width: 25 },
    { header: "Phone", key: "phone", width: 18 },
    { header: "Department", key: "department", width: 18 },
    { header: "Designation", key: "designation", width: 18 },
    { header: "Employment Type", key: "employmentType", width: 18 },
    { header: "Basic Salary", key: "basicSalary", width: 15 },
    { header: "Joining Date", key: "joiningDate", width: 15 },
    { header: "Gender", key: "gender", width: 12 },
    { header: "Date of Birth", key: "dateOfBirth", width: 15 },
    { header: "Address", key: "address", width: 30 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.addRow({
    firstName: "Ahmed",
    lastName: "Raza",
    fatherName: "Tariq Mahmood",
    nationalId: "35201-1234567-1",
    email: "ahmed.raza@example.com",
    phone: "0300-1234567",
    department: "Academics",
    designation: "Lecturer",
    employmentType: "FULL_TIME",
    basicSalary: 60000,
    joiningDate: "2026-01-15",
    gender: "MALE",
    dateOfBirth: "1992-05-12",
    address: "Gulberg III, Lahore",
  });
  sheet.addRow({
    firstName: "Fatima",
    lastName: "Noor",
    fatherName: "Muhammad Aslam",
    nationalId: "35202-7654321-2",
    email: "fatima.noor@example.com",
    phone: "0321-7654321",
    department: "Administration",
    designation: "Assistant Manager",
    employmentType: "FULL_TIME",
    basicSalary: 75000,
    joiningDate: "2026-02-01",
    gender: "FEMALE",
    dateOfBirth: "1990-10-24",
    address: "DHA Phase 5, Lahore",
  });
  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
}

function normalizeHeaderKey(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseCellString(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "object" && val !== null && "text" in val) {
    return String((val as { text: string }).text).trim();
  }
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10);
  }
  return String(val).trim();
}

export async function importEmployeesFile(
  tenantId: string,
  file: Express.Multer.File,
  req: Request,
): Promise<{ imported: number; failed: { row: number; name?: string; reason: string }[] }> {
  let rows: string[][] = [];
  const fileName = file.originalname.toLowerCase();

  if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as never);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw AppError.badRequest("Uploaded workbook has no worksheets.");
    worksheet.eachRow((row) => {
      const values: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        values[colNumber - 1] = parseCellString(cell.value);
      });
      rows.push(values);
    });
  } else {
    // Parse CSV
    const text = file.buffer.toString("utf-8").replace(/^\uFEFF/, "");
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    rows = lines.map((line) => {
      // Basic comma/semicolon/tab delimiter splitting
      const delimiter = line.includes(";") ? ";" : line.includes("\t") ? "\t" : ",";
      return line.split(delimiter).map((c) => c.replace(/^["']|["']$/g, "").trim());
    });
  }

  if (rows.length < 2) {
    throw AppError.badRequest("File must contain a header row and at least one data row.");
  }

  const rawHeaders = rows[0];
  const headers = rawHeaders.map(normalizeHeaderKey);
  const col = (candidates: string[]) => headers.findIndex((h) => candidates.includes(h));

  const firstNameCol = col(["firstname", "first", "fname", "name"]);
  const lastNameCol = col(["lastname", "last", "lname", "surname"]);
  const fatherNameCol = col(["fathername", "father", "guardian"]);
  const nationalIdCol = col(["cnic", "nationalid", "bform", "nic", "identity"]);
  const emailCol = col(["email", "emailaddress"]);
  const phoneCol = col(["phone", "phonenumber", "mobile", "contact"]);
  const deptCol = col(["department", "dept"]);
  const desigCol = col(["designation", "title", "role"]);
  const typeCol = col(["employmenttype", "type"]);
  const salaryCol = col(["basicsalary", "salary", "grosssalary", "pay"]);
  const joinCol = col(["joiningdate", "doj", "joined"]);
  const genderCol = col(["gender", "sex"]);
  const dobCol = col(["dateofbirth", "dob", "birthdate"]);
  const addressCol = col(["address", "residence"]);

  const failed: { row: number; name?: string; reason: string }[] = [];
  let imported = 0;

  // Plan limit check
  const subscription = await prisma.subscription.findUnique({
    where: { tenantId },
    include: { plan: true },
  });

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0 || r.every((c) => !c)) continue;

    const rowNumber = i + 1;
    let firstName = firstNameCol >= 0 ? r[firstNameCol] ?? "" : "";
    let lastName = lastNameCol >= 0 ? r[lastNameCol] ?? "" : "";

    // If only one Name column was present and has spaces, split into first/last
    if (firstName && !lastName && firstNameCol >= 0 && lastNameCol < 0) {
      const parts = firstName.split(/\s+/);
      firstName = parts[0];
      lastName = parts.slice(1).join(" ") || parts[0];
    }

    if (!firstName) {
      failed.push({ row: rowNumber, reason: "First name is required." });
      continue;
    }
    if (!lastName) lastName = firstName;

    const rawSalary = salaryCol >= 0 ? r[salaryCol]?.replace(/[^0-9.]/g, "") : "0";
    const basicSalary = parseFloat(rawSalary || "0") || 0;

    const fatherName = fatherNameCol >= 0 ? r[fatherNameCol] : null;
    const nationalId = nationalIdCol >= 0 ? r[nationalIdCol] : null;
    const email = emailCol >= 0 ? r[emailCol] : null;
    const phone = phoneCol >= 0 ? r[phoneCol] : null;
    const deptName = deptCol >= 0 ? r[deptCol] : undefined;
    const desigName = desigCol >= 0 ? r[desigCol] : undefined;
    const rawType = typeCol >= 0 ? (r[typeCol] ?? "").toUpperCase().replace(/[\s-]/g, "_") : "FULL_TIME";
    const employmentType: EmploymentType = (["FULL_TIME", "PART_TIME", "CONTRACT", "VISITING", "INTERN", "PROBATION"].includes(rawType)
      ? rawType
      : "FULL_TIME") as EmploymentType;
    const rawGender = genderCol >= 0 ? (r[genderCol] ?? "").toUpperCase() : null;
    const gender = ["MALE", "FEMALE", "OTHER"].includes(rawGender ?? "") ? (rawGender as never) : null;
    const address = addressCol >= 0 ? r[addressCol] : null;

    let joiningDate: Date | null = null;
    if (joinCol >= 0 && r[joinCol]) {
      const d = new Date(r[joinCol]);
      if (!Number.isNaN(d.getTime())) joiningDate = d;
    }

    let dateOfBirth: Date | null = null;
    if (dobCol >= 0 && r[dobCol]) {
      const d = new Date(r[dobCol]);
      if (!Number.isNaN(d.getTime())) dateOfBirth = d;
    }

    // Check duplicate nationalId if provided
    if (nationalId) {
      const existing = await prisma.employee.findFirst({
        where: { tenantId, nationalId: { equals: nationalId.trim(), mode: "insensitive" } },
      });
      if (existing) {
        failed.push({ row: rowNumber, name: `${firstName} ${lastName}`, reason: `CNIC ${nationalId} already exists.` });
        continue;
      }
    }

    // Check plan limits
    if (subscription) {
      const count = await prisma.employee.count({ where: { tenantId, status: "ACTIVE" } });
      if (count >= subscription.plan.employeeLimit) {
        failed.push({
          row: rowNumber,
          name: `${firstName} ${lastName}`,
          reason: `Plan limit of ${subscription.plan.employeeLimit} employees reached.`,
        });
        break;
      }
    }

    try {
      const departmentId = deptName ? await resolveDepartment(tenantId, undefined, deptName) : undefined;
      const designationId = desigName ? await resolveDesignation(tenantId, undefined, desigName) : undefined;
      const employeeNumber = await generateEmployeeNumber(tenantId);

      await prisma.employee.create({
        data: {
          tenantId,
          employeeNumber,
          firstName,
          lastName,
          fatherName: fatherName || null,
          nationalId: nationalId || null,
          email: email || null,
          phone: phone || null,
          departmentId,
          designationId,
          employmentType,
          basicSalary: new Prisma.Decimal(basicSalary),
          joiningDate: joiningDate || new Date(),
          gender,
          dateOfBirth,
          address: address || null,
          status: "ACTIVE",
          salaryType: "FIXED",
          paymentMethod: "BANK_TRANSFER",
        },
      });
      imported++;
    } catch (err: unknown) {
      failed.push({
        row: rowNumber,
        name: `${firstName} ${lastName}`,
        reason: err instanceof Error ? err.message : "Failed to insert employee.",
      });
    }
  }

  await recordAudit({
    req,
    action: "employee.bulk_import",
    module: "employee",
    recordId: tenantId,
    recordType: "Tenant",
    next: { imported, failedCount: failed.length },
  });

  return { imported, failed };
}
