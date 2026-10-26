import { z } from "zod";

export const onboardingSchema = z.object({
  // Step 1 — account
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email("A valid work email is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain an uppercase letter")
    .regex(/[a-z]/, "Must contain a lowercase letter")
    .regex(/[0-9]/, "Must contain a number"),
  // Step 2 — institution
  institutionName: z.string().min(2, "Institution name is required"),
  institutionType: z.enum(["SCHOOL", "COLLEGE", "UNIVERSITY", "ACADEMY", "TRAINING_INSTITUTE", "OTHER"]),
  institutionEmail: z.string().email("A valid institution email is required"),
  phone: z
    .string()
    .trim()
    .refine((v) => {
      if (!v) return false;
      const digits = v.replace(/\D/g, "");
      return digits.length >= 10 && digits.length <= 15;
    }, "Enter a valid mobile number"),
  website: z.string().optional(),
  address: z.string().min(1, "Address is required"),
  country: z.string().optional(),
  city: z.string().optional(),
  currency: z.string().length(3, "Currency must be a 3-letter ISO code"),
  // Step 3 — plan
  planKey: z.string().min(1),
  billingPeriod: z.enum(["MONTHLY", "YEARLY"]).default("MONTHLY"),
  // Step 4 — payment / trial
  trial: z.boolean().default(true),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
