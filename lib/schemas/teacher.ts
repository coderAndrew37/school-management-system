// lib/schemas/teacher.ts
// Kibali Academy — Teacher Registration Validation Schema
//
// Strictly maps user UI input boundaries ahead of server pipeline normalization.
// Omit explicit use of `any` — strongly inferred typing.

import { z } from "zod";

export const teacherRegistrationSchema = z.object({
  fullName: z
    .string()
    .min(3, "Full name must be at least 3 characters")
    .max(100, "Full name is too long"),
  email: z
    .string()
    .email("Please enter a valid work email"),
  phone: z
    .string()
    .regex(
      /^(07|01)\d{8}$/,
      "Phone number must start with 07 or 01 and be exactly 10 digits"
    ),
  tscNumber: z
    .string()
    .regex(
      /^\d{7}$/,
      "TSC Number must be exactly 7 digits"
    ),
});

export type TeacherFormValues = z.infer<typeof teacherRegistrationSchema>;