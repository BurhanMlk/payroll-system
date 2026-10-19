import { z } from "zod";

export const createBiometricDeviceSchema = z.object({
  branchId: z.string().min(1).optional().nullable(),

  name: z
    .string()
    .trim()
    .min(2, "Device name must be at least 2 characters")
    .max(100),

  code: z
    .string()
    .trim()
    .min(2, "Device code is required")
    .max(50),

  serialNumber: z
    .string()
    .trim()
    .max(100)
    .optional()
    .nullable(),

  manufacturer: z
    .string()
    .trim()
    .max(100)
    .optional()
    .nullable(),

  model: z
    .string()
    .trim()
    .max(100)
    .optional()
    .nullable(),

  ipAddress: z
    .string()
    .trim()
    .max(100)
    .optional()
    .nullable(),

  port: z
    .coerce
    .number()
    .int()
    .min(1)
    .max(65535)
    .optional()
    .nullable(),

  timezone: z
    .string()
    .trim()
    .max(100)
    .optional()
    .nullable(),
});

export const updateBiometricDeviceSchema =
  createBiometricDeviceSchema
    .partial()
    .extend({
      status: z
        .enum([
          "ACTIVE",
          "INACTIVE",
          "OFFLINE",
          "DISABLED",
        ])
        .optional(),
    });

export const createBiometricMappingSchema = z.object({
  deviceId: z
    .string()
    .min(1, "Device ID is required"),

  employeeId: z
    .string()
    .min(1, "Employee ID is required"),

  biometricUserId: z
    .string()
    .trim()
    .min(1, "Biometric user ID is required")
    .max(100),
});

export const createBiometricPunchSchema = z.object({
  deviceId: z
    .string()
    .min(1, "Device ID is required"),

  biometricUserId: z
    .string()
    .trim()
    .min(1, "Biometric user ID is required")
    .max(100),

  punchedAt: z
    .string()
    .datetime(),

  punchType: z
    .enum([
      "IN",
      "OUT",
      "BREAK_IN",
      "BREAK_OUT",
      "UNKNOWN",
    ])
    .default("UNKNOWN"),

  externalPunchId: z
    .string()
    .max(150)
    .optional()
    .nullable(),

  rawPayload: z
    .record(z.any())
    .optional(),
});