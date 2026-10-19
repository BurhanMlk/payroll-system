import { z } from "zod";

export const employeeCreateSchema = z.object({
  employeeNumber: z.string().optional(),
  currency: z.string().length(3, "Currency must be a 3-letter ISO code").optional(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  fatherName: z.string().optional(),
  nationalId: z.string().optional(),
  dateOfBirth: z.coerce.date().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  phone: z.string().optional(),
  alternatePhone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  emergencyContact: z.string().optional(),

  branchId: z.string().optional(),
  departmentId: z.string().optional(),
  departmentName: z.string().optional(),
  designationId: z.string().optional(),
  designationName: z.string().optional(),
  employmentType: z.enum(["PERMANENT", "CONTRACT", "PART_TIME", "VISITING", "TEMPORARY"]).default("PERMANENT"),
  status: z.enum(["ACTIVE", "INACTIVE", "RESIGNED", "TERMINATED", "RETIRED", "SUSPENDED"]).default("ACTIVE"),
  joiningDate: z.coerce.date().optional(),
  confirmationDate: z.coerce.date().optional(),
  contractStart: z.coerce.date().optional(),
  contractEnd: z.coerce.date().optional(),

  bankName: z.string().optional(),
  accountTitle: z.string().optional(),
  accountNumber: z.string().optional(),
  bankBranchName: z.string().optional(),

  basicSalary: z.coerce.number().min(0).default(0),
  salaryType: z.string().default("MONTHLY"),
  paymentMethod: z.string().default("BANK_TRANSFER"),
});

export const employeeUpdateSchema = employeeCreateSchema.partial().omit({ employeeNumber: true, currency: true });

export type EmployeeCreateInput = z.infer<typeof employeeCreateSchema>;
export type EmployeeUpdateInput = z.infer<typeof employeeUpdateSchema>;
