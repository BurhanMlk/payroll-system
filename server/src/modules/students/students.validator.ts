import { z } from "zod";

export const studentCreateSchema = z.object({
  fullName: z.string().min(2, "Student name must be at least 2 characters."),
  fatherName: z.string().min(2, "Father name must be at least 2 characters."),
  nationalId: z.string().min(5, "CNIC or B-Form is required."),
  className: z.string().min(1, "Class is required."),
  section: z.string().optional().nullable(),
  rollNumber: z.string().optional().nullable(),
  monthlyFee: z.coerce.number().min(0, "Monthly fee cannot be negative.").default(0),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  branchId: z.string().optional().nullable(),
});

export const studentUpdateSchema = studentCreateSchema.partial().extend({
  status: z.enum(["ACTIVE", "INACTIVE", "ALUMNI"]).optional(),
});

export const studentAttendanceRecordSchema = z.object({
  date: z.string().min(1, "Date is required (YYYY-MM-DD)."),
  records: z.array(
    z.object({
      studentId: z.string().min(1),
      status: z.enum(["PRESENT", "ABSENT", "LATE", "HALF_DAY", "LEAVE"]),
      remarks: z.string().optional().nullable(),
    }),
  ),
});

export const studentFeePaySchema = z.object({
  studentId: z.string().min(1, "Student ID is required."),
  month: z.string().min(4, "Month is required (e.g. 2026-10)."),
  paidAmount: z.coerce.number().min(1, "Paid amount must be greater than 0."),
  paymentMethod: z.string().default("CASH"),
  receiptNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const studentFeeGenerateSchema = z.object({
  month: z.string().min(4, "Month is required (e.g. 2026-10)."),
  className: z.string().optional(),
  section: z.string().optional(),
});

export type StudentCreateInput = z.infer<typeof studentCreateSchema>;
export type StudentUpdateInput = z.infer<typeof studentUpdateSchema>;

