import { z } from "zod";

export const attendanceStatusEnum = z.enum([
  "PRESENT",
  "ABSENT",
  "LATE",
  "HALF_DAY",
  "PAID_LEAVE",
  "UNPAID_LEAVE",
  "HOLIDAY",
  "WEEKEND",
  "WORK_FROM_HOME",
]);

export const markAttendanceSchema = z.object({
  employeeId: z.string().min(1),
  date: z.coerce.date(),
  status: attendanceStatusEnum,
  checkIn: z.coerce.date().optional(),
  checkOut: z.coerce.date().optional(),
  workHours: z.coerce.number().optional(),
  overtimeHours: z.coerce.number().default(0),
  lateMinutes: z.coerce.number().default(0),
  earlyDepartureMinutes: z.coerce.number().default(0),
  source: z.enum(["MANUAL", "CSV", "API", "BIOMETRIC"]).default("MANUAL"),
  notes: z.string().optional(),
});

export const bulkMarkSchema = z.object({
  date: z.coerce.date(),
  employeeIds: z.array(z.string()).min(1),
  status: attendanceStatusEnum,
  source: z.enum(["MANUAL", "CSV", "API", "BIOMETRIC"]).default("MANUAL"),
});

export const updateAttendanceSchema = z.object({
  status: attendanceStatusEnum.optional(),
  checkIn: z.coerce.date().optional(),
  checkOut: z.coerce.date().optional(),
  workHours: z.coerce.number().optional(),
  overtimeHours: z.coerce.number().optional(),
  lateMinutes: z.coerce.number().optional(),
  earlyDepartureMinutes: z.coerce.number().optional(),
  source: z.enum(["MANUAL", "CSV", "API", "BIOMETRIC"]).optional(),
  notes: z.string().optional(),
});

export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;
