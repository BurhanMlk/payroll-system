import { z } from "zod";

export const leaveTypeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().min(1, "Code is required").regex(/^[A-Z0-9_]+$/, "Uppercase letters, numbers and underscores only"),
  annualQuota: z.coerce.number().min(0).default(0),
  isPaid: z.boolean().default(true),
  carryForward: z.boolean().default(false),
  maxCarryForward: z.coerce.number().min(0).optional(),
  approvalRequired: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

export const leaveRequestSchema = z.object({
  leaveTypeId: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  reason: z.string().optional(),
});

export const leaveDecisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  rejectionReason: z.string().optional(),
});
